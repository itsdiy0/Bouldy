# RAGAS evaluation endpoints for Bouldy
# Trigger and view RAG quality evaluations per chatbot
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from ragas import evaluate as ragas_evaluate
from ragas.metrics import Faithfulness, AnswerRelevancy, ContextPrecision
from ragas.llms import LlamaIndexLLMWrapper
from ragas.dataset_schema import SingleTurnSample, EvaluationDataset

from llama_index.core import Settings as LISettings
from llama_index.llms.openai import OpenAI

from app.database import get_db, SessionLocal
from app.models import Chatbot, Evaluation, User
from app.schemas import EvaluationResponse
from app.config import settings
from app.auth import get_current_user
from app.services.indexing import get_embed_model
from app.services.llm_provider import get_llm
from app.routers.chat import load_chatbot_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chatbots/{chatbot_id}/evaluate", tags=["evaluation"])

DEFAULT_QUESTIONS = [
    "What is this document about?",
    "What are the main topics covered?",
    "Can you summarize the key findings?",
    "What methodology or approach is described?",
    "What conclusions or recommendations are made?",
]


# Run evaluation in background
def run_evaluation_task(chatbot_id: str, evaluation_id: str):
    db = SessionLocal()
    try:
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

        if not chatbot or not evaluation:
            return

        # Load index and query engine
        LISettings.embed_model = get_embed_model()
        index = load_chatbot_index(UUID(chatbot_id))
        query_engine = index.as_query_engine(
            llm=get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key),
            similarity_top_k=3,
        )

        # Run queries
        samples = []
        per_question = []

        for question in DEFAULT_QUESTIONS:
            logger.info(f"Eval query: {question}")
            response = query_engine.query(question)
            contexts = [node.text for node in response.source_nodes]

            samples.append(SingleTurnSample(
                user_input=question,
                response=str(response),
                retrieved_contexts=contexts,
            ))

            per_question.append({
                "question": question,
                "answer": str(response)[:200],
                "context_count": len(contexts),
            })

        # Set up evaluator
        evaluator_llm = LlamaIndexLLMWrapper(
            OpenAI(model="gpt-4o-mini", api_key=settings.openai_embedding_key)
        )

        metrics = [
            Faithfulness(llm=evaluator_llm),
            AnswerRelevancy(llm=evaluator_llm),
            ContextPrecision(llm=evaluator_llm),
        ]

        eval_dataset = EvaluationDataset(samples=samples)

        logger.info(f"Running RAGAS metrics for chatbot {chatbot_id}...")
        result = ragas_evaluate(dataset=eval_dataset, metrics=metrics)

        # Extract scores
        scores = {}
        for key, value in result.items():
            if isinstance(value, (int, float)):
                scores[key] = round(value, 3)

        # Update evaluation record
        evaluation.faithfulness = str(scores.get("faithfulness", "N/A"))
        evaluation.answer_relevancy = str(scores.get("answer_relevancy", "N/A"))
        evaluation.context_precision = str(scores.get("context_precision", "N/A"))
        evaluation.question_count = len(DEFAULT_QUESTIONS)
        evaluation.status = "completed"
        evaluation.results_json = json.dumps({
            "scores": scores,
            "per_question": per_question,
        })

        db.commit()
        logger.info(f"Evaluation completed for chatbot {chatbot_id}: {scores}")

    except Exception as e:
        logger.error(f"Evaluation failed for chatbot {chatbot_id}: {e}")
        evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if evaluation:
            evaluation.status = "failed"
            evaluation.results_json = json.dumps({"error": str(e)})
            db.commit()
    finally:
        db.close()


# Trigger a new evaluation
@router.post("", response_model=EvaluationResponse)
def start_evaluation(
    chatbot_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    # Check for running evaluation
    running = db.query(Evaluation).filter(
        Evaluation.chatbot_id == chatbot_id,
        Evaluation.status == "running",
    ).first()
    if running:
        raise HTTPException(400, "An evaluation is already running for this chatbot")

    # Create evaluation record
    evaluation = Evaluation(
        chatbot_id=chatbot_id,
        question_count=len(DEFAULT_QUESTIONS),
        status="running",
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    # Run in background
    background_tasks.add_task(run_evaluation_task, str(chatbot_id), str(evaluation.id))
    logger.info(f"Started evaluation {evaluation.id} for chatbot {chatbot_id}")

    return evaluation


# List evaluations for a chatbot
@router.get("")
def list_evaluations(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
            "created_at": e.created_at.isoformat(),
            "details": json.loads(e.results_json) if e.results_json else None,
        }
        for e in evaluations
    ]