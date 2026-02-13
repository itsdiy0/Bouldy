"""
Chat endpoint for Bouldy.
Handles: user question → retrieve from Qdrant → stream LLM response
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient

from llama_index.core import VectorStoreIndex, Settings as LISettings
from llama_index.vector_stores.qdrant import QdrantVectorStore

from app.database import get_db
from app.models import Chatbot, User
from app.auth import get_current_user
from app.config import settings
from app.services.indexing import get_qdrant_client, get_embed_model, get_collection_name
from app.services.llm_provider import get_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []


def load_chatbot_index(chatbot_id: UUID) -> VectorStoreIndex:
    """Load an existing Qdrant index for a chatbot."""
    client = get_qdrant_client()
    collection_name = get_collection_name(chatbot_id)

    # Verify collection exists
    collections = [c.name for c in client.get_collections().collections]
    if collection_name not in collections:
        raise ValueError("Chatbot index not found. Documents may still be processing.")

    vector_store = QdrantVectorStore(
        client=client,
        collection_name=collection_name,
    )

    LISettings.embed_model = get_embed_model()

    return VectorStoreIndex.from_vector_store(vector_store)


# Non-streaming chat (simpler, returns full response)
@router.post("/{chatbot_id}", response_model=ChatResponse)
def chat(
    chatbot_id: UUID,
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify chatbot ownership and config
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")

    if not chatbot.llm_provider or not chatbot.llm_model:
        raise HTTPException(400, "Chatbot LLM not configured")

    # 2. Load the chatbot's index from Qdrant
    try:
        index = load_chatbot_index(chatbot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 3. Get the user's LLM
    llm = get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key)

    # 4. Query
    query_engine = index.as_query_engine(
        llm=llm,
        similarity_top_k=3,
    )
    response = query_engine.query(req.message)

    # 5. Extract sources
    sources = []
    for node in response.source_nodes:
        sources.append({
            "text": node.text[:300],
            "score": round(node.score, 3) if node.score else None,
            "filename": node.metadata.get("filename", "Unknown"),
            "document_id": node.metadata.get("document_id"),
        })

    return ChatResponse(response=str(response), sources=sources)


# Streaming chat (for real-time UI)
@router.post("/{chatbot_id}/stream")
def chat_stream(
    chatbot_id: UUID,
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify chatbot ownership and config
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found")

    if not chatbot.llm_provider or not chatbot.llm_model:
        raise HTTPException(400, "Chatbot LLM not configured")

    # 2. Load index
    try:
        index = load_chatbot_index(chatbot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 3. Get the user's LLM
    llm = get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key)

    # 4. Stream response
    query_engine = index.as_query_engine(
        llm=llm,
        similarity_top_k=3,
        streaming=True,
    )

    streaming_response = query_engine.query(req.message)

    def generate():
        for text in streaming_response.response_gen:
            yield text

        # After streaming, send sources as a final JSON chunk
        import json
        sources = []
        for node in streaming_response.source_nodes:
            sources.append({
                "text": node.text[:300],
                "score": round(node.score, 3) if node.score else None,
                "filename": node.metadata.get("filename", "Unknown"),
                "document_id": node.metadata.get("document_id"),
            })
        yield f"\n\n__SOURCES__{json.dumps(sources)}"

    return StreamingResponse(generate(), media_type="text/plain")