"""
Auto-generate test question + ground truth pairs from a chatbot's documents.
Used by the evaluation pipeline to assess RAG quality without manual input.
"""
import json
import logging
import random
from uuid import UUID

from llama_index.core import VectorStoreIndex
from llama_index.core.schema import TextNode

from app.services.llm_provider import get_llm
from app.services.indexing import get_embed_model, get_qdrant_store

logger = logging.getLogger(__name__)

QUESTION_GENERATION_PROMPT = """You are a test question generator for a document-based Q&A system.

Given the following document excerpts, generate exactly {count} diverse question-answer pairs that can be answered using ONLY the provided text.

Requirements:
- Questions should be specific and answerable from the given text
- Questions should vary in type: factual, analytical, comparison, summarization
- Answers should be concise but complete, directly supported by the text
- Do NOT generate questions that require external knowledge

Document excerpts:
{chunks}

Respond with ONLY a JSON array, no other text or markdown:
[
  {{"question": "...", "ground_truth": "..."}},
  {{"question": "...", "ground_truth": "..."}}
]"""


def _sample_chunks(chatbot_id: UUID, num_chunks: int = 15) -> list[str]:
    """Sample diverse chunks from the chatbot's vector store."""
    embed_model = get_embed_model()
    vector_store = get_qdrant_store(str(chatbot_id))

    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        embed_model=embed_model,
    )

    # Use a broad query to retrieve a spread of chunks
    retriever = index.as_retriever(similarity_top_k=num_chunks)
    broad_queries = [
        "What are the main topics discussed?",
        "Summarize the key information.",
        "What details are provided?",
    ]

    all_chunks = {}
    for query in broad_queries:
        nodes = retriever.retrieve(query)
        for node in nodes:
            # Deduplicate by node ID
            all_chunks[node.node.node_id] = node.node.text

    # Shuffle and limit
    chunk_texts = list(all_chunks.values())
    random.shuffle(chunk_texts)
    return chunk_texts[:num_chunks]


def generate_test_questions(
    chatbot_id: UUID,
    llm_provider: str,
    llm_model: str,
    llm_api_key: str,
    num_questions: int = 10,
) -> list[dict]:
    """
    Generate test question-answer pairs from a chatbot's documents.
    
    Returns list of {"question": str, "ground_truth": str}
    """
    logger.info(f"Generating {num_questions} test questions for chatbot {chatbot_id}")

    # Sample chunks from the chatbot's vector store
    chunks = _sample_chunks(chatbot_id)

    if not chunks:
        raise ValueError("No document chunks found for this chatbot")

    # Format chunks for the prompt
    formatted_chunks = "\n\n---\n\n".join(
        f"[Excerpt {i+1}]:\n{chunk[:800]}"  # cap each chunk to avoid token overflow
        for i, chunk in enumerate(chunks)
    )

    prompt = QUESTION_GENERATION_PROMPT.format(
        count=num_questions,
        chunks=formatted_chunks,
    )

    # Use the chatbot's own LLM
    llm = get_llm(llm_provider, llm_model, llm_api_key)
    response = llm.complete(prompt)
    raw = response.text.strip()

    # Parse JSON — handle markdown fences if the LLM wraps it
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]  # remove first line
        raw = raw.rsplit("```", 1)[0]  # remove last fence
    raw = raw.strip()

    try:
        questions = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}\nRaw: {raw[:500]}")
        raise ValueError("LLM returned invalid JSON for question generation")

    # Validate structure
    validated = []
    for item in questions:
        if isinstance(item, dict) and "question" in item and "ground_truth" in item:
            validated.append({
                "question": str(item["question"]).strip(),
                "ground_truth": str(item["ground_truth"]).strip(),
            })

    if not validated:
        raise ValueError("LLM generated no valid question-answer pairs")

    logger.info(f"Generated {len(validated)} questions for chatbot {chatbot_id}")
    return validated[:num_questions]  # enforce limit