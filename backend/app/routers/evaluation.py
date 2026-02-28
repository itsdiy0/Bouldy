"""
RAGAS evaluation endpoints for Bouldy
Trigger and view RAG quality evaluations per chatbot
"""
import json
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from ragas import evaluate as ragas_evaluate
from ragas.metrics import Faithfulness, AnswerRelevancy, ContextPrecision
from ragas.llms import LlamaIndexLLMWrapper
from ragas.embeddings import LlamaIndexEmbeddingsWrapper
from ragas.dataset_schema import SingleTurnSample, EvaluationDataset

from llama_index.llms.openai import OpenAI

from app.database import get_db, SessionLocal
from app.models import Chatbot, Evaluation, EvaluationResult, User
from app.config import settings
from app.auth import get_current_user
from app.services.indexing import get_embed_model
from app.services.llm_provider import get_llm
from app.services.question_generator import generate_test_questions
from app.routers.chat import load_chatbot_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chatbots/{chatbot_id}/evaluate", tags=["evaluation"])

NUM_QUESTIONS = 10


def run_evaluation_task(chatbot_id: str, evaluation_id: str):
    """Background task: generate questions, run RAG, score with RAGAS."""
    db = SessionLocal()
    try:
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

        if not chatbot or not evaluation:
            return

        # ── Step 1: Generate test questions from documents ──
        logger.info(f"[Eval {evaluation_id}] Generating test questions...")
        evaluation.status = "generating_questions"
        db.commit()

        qa_pairs = generate_test_questions(
            chatbot_id=UUID(chatbot_id),
            llm_provider=chatbot.llm_provider,
            llm_model=chatbot.llm_model,
            llm_api_key=chatbot.llm_api_key,
            num_questions=NUM_QUESTIONS,
        )

        # ── Step 2: Run each question through the RAG pipeline ──
        logger.info(f"[Eval {evaluation_id}] Running {len(qa_pairs)} queries through RAG...")
        evaluation.status = "querying"
        db.commit()

        embed_model = get_embed_model()
        index = load_chatbot_index(UUID(chatbot_id))
        query_engine = index.as_query_engine(
            llm=get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key),
            similarity_top_k=3,
        )

        samples = []
        result_rows = []

        for i, qa in enumerate(qa_pairs):
            question = qa["question"]
            ground_truth = qa["ground_truth"]

            logger.info(f"[Eval {evaluation_id}] Query {i+1}/{len(qa_pairs)}: {question[:80]}")
            response = query_engine.query(question)
            contexts = [node.text for node in response.source_nodes]

            samples.append(SingleTurnSample(
                user_input=question,
                response=str(response),
                retrieved_contexts=contexts,
                reference=ground_truth,
            ))

            result_rows.append({
                "question_index": i,
                "question": question,
                "ground_truth": ground_truth,
                "generated_answer": str(response),
                "retrieved_contexts": json.dumps(contexts),
            })

        # ── Step 3: Score with RAGAS ──
        logger.info(f"[Eval {evaluation_id}] Running RAGAS metrics...")
        evaluation.status = "scoring"
        db.commit()

        evaluator_llm = LlamaIndexLLMWrapper(
            OpenAI(model="gpt-4o-mini", api_key=settings.openai_embedding_key)
        )
        evaluator_embeddings = LlamaIndexEmbeddingsWrapper(embed_model)

        metrics = [
            Faithfulness(llm=evaluator_llm),
            AnswerRelevancy(llm=evaluator_llm, embeddings=evaluator_embeddings),
            ContextPrecision(llm=evaluator_llm),
        ]

        eval_dataset = EvaluationDataset(samples=samples)
        ragas_result = ragas_evaluate(dataset=eval_dataset, metrics=metrics)

        # ── Step 4: Extract per-question scores and store results ──
        logger.info(f"[Eval {evaluation_id}] Storing results...")

        df = ragas_result.to_pandas()

        for i, row_data in enumerate(result_rows):
            per_q_scores = {}
            if i < len(df):
                for metric_name in ["faithfulness", "answer_relevancy", "context_precision"]:
                    val = df.iloc[i].get(metric_name)
                    if val is not None and str(val) != "nan":
                        per_q_scores[metric_name] = round(float(val), 4)

            eval_result = EvaluationResult(
                evaluation_id=UUID(evaluation_id),
                question_index=row_data["question_index"],
                question=row_data["question"],
                ground_truth=row_data["ground_truth"],
                generated_answer=row_data["generated_answer"],
                retrieved_contexts=row_data["retrieved_contexts"],
                faithfulness=per_q_scores.get("faithfulness"),
                answer_relevancy=per_q_scores.get("answer_relevancy"),
                context_precision=per_q_scores.get("context_precision"),
            )
            db.add(eval_result)

        # ── Step 5: Compute aggregates ──
        score_lists = {"faithfulness": [], "answer_relevancy": [], "context_precision": []}

        for metric_name in score_lists:
            col = df.get(metric_name)
            if col is not None:
                for val in col:
                    if val is not None and str(val) != "nan":
                        score_lists[metric_name].append(float(val))

        evaluation.faithfulness = (
            round(sum(score_lists["faithfulness"]) / len(score_lists["faithfulness"]), 4)
            if score_lists["faithfulness"] else None
        )
        evaluation.answer_relevancy = (
            round(sum(score_lists["answer_relevancy"]) / len(score_lists["answer_relevancy"]), 4)
            if score_lists["answer_relevancy"] else None
        )
        evaluation.context_precision = (
            round(sum(score_lists["context_precision"]) / len(score_lists["context_precision"]), 4)
            if score_lists["context_precision"] else None
        )

        evaluation.question_count = len(result_rows)
        evaluation.status = "completed"
        evaluation.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"[Eval {evaluation_id}] Completed — faithfulness={evaluation.faithfulness}, "
                     f"relevancy={evaluation.answer_relevancy}, precision={evaluation.context_precision}")

    except Exception as e:
        logger.error(f"[Eval {evaluation_id}] Failed: {e}", exc_info=True)
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if evaluation:
            evaluation.status = "failed"
            evaluation.error_message = str(e)[:500]
            evaluation.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


# ── Endpoints ──

@router.post("")
def start_evaluation(
    chatbot_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kick off a new evaluation run for a chatbot."""
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")
    if not chatbot.llm_provider or not chatbot.llm_model:
        raise HTTPException(400, "Chatbot LLM not configured")
    if not chatbot.documents:
        raise HTTPException(400, "Chatbot has no documents")

    # Prevent concurrent evaluations
    running = db.query(Evaluation).filter(
        Evaluation.chatbot_id == chatbot_id,
        Evaluation.status.in_(["running", "generating_questions", "querying", "scoring"]),
    ).first()
    if running:
        raise HTTPException(400, "An evaluation is already running for this chatbot")

    evaluation = Evaluation(
        chatbot_id=chatbot_id,
        question_count=NUM_QUESTIONS,
        status="running",
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    background_tasks.add_task(run_evaluation_task, str(chatbot_id), str(evaluation.id))
    logger.info(f"Started evaluation {evaluation.id} for chatbot {chatbot_id}")

    return {
        "id": str(evaluation.id),
        "status": evaluation.status,
        "question_count": evaluation.question_count,
        "created_at": evaluation.created_at.isoformat(),
    }


@router.get("")
def list_evaluations(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List evaluation runs for a chatbot (most recent first)."""
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")

    evaluations = db.query(Evaluation).filter(
        Evaluation.chatbot_id == chatbot_id,
    ).order_by(Evaluation.created_at.desc()).limit(10).all()

    return [
        {
            "id": str(e.id),
            "faithfulness": e.faithfulness,
            "answer_relevancy": e.answer_relevancy,
            "context_precision": e.context_precision,
            "question_count": e.question_count,
            "status": e.status,
            "error_message": e.error_message,
            "created_at": e.created_at.isoformat(),
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        }
        for e in evaluations
    ]


@router.get("/{evaluation_id}")
def get_evaluation_detail(
    chatbot_id: UUID,
    evaluation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single evaluation run with per-question breakdown."""
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")

    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.chatbot_id == chatbot_id,
    ).first()

    if not evaluation:
        raise HTTPException(404, "Evaluation not found")

    results = db.query(EvaluationResult).filter(
        EvaluationResult.evaluation_id == evaluation_id,
    ).order_by(EvaluationResult.question_index).all()

    return {
        "id": str(evaluation.id),
        "faithfulness": evaluation.faithfulness,
        "answer_relevancy": evaluation.answer_relevancy,
        "context_precision": evaluation.context_precision,
        "question_count": evaluation.question_count,
        "status": evaluation.status,
        "error_message": evaluation.error_message,
        "created_at": evaluation.created_at.isoformat(),
        "completed_at": evaluation.completed_at.isoformat() if evaluation.completed_at else None,
        "results": [
            {
                "question_index": r.question_index,
                "question": r.question,
                "ground_truth": r.ground_truth,
                "generated_answer": r.generated_answer,
                "retrieved_contexts": json.loads(r.retrieved_contexts) if r.retrieved_contexts else [],
                "faithfulness": r.faithfulness,
                "answer_relevancy": r.answer_relevancy,
                "context_precision": r.context_precision,
            }
            for r in results
        ],
    }


@router.delete("/{evaluation_id}")
def delete_evaluation(
    chatbot_id: UUID,
    evaluation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an evaluation run and its results."""
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")

    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.chatbot_id == chatbot_id,
    ).first()

    if not evaluation:
        raise HTTPException(404, "Evaluation not found")

    db.delete(evaluation)  # cascade deletes results
    db.commit()

    return {"detail": "Evaluation deleted"}