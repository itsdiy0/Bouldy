"""
Chat endpoint for Bouldy.
Handles: user question → retrieve from Qdrant → stream LLM response
Supports: session persistence, optional conversation memory
"""
import json
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from llama_index.core import VectorStoreIndex, Settings as LISettings
from llama_index.core.llms import ChatMessage as LIChatMessage, MessageRole
from llama_index.vector_stores.qdrant import QdrantVectorStore

from app.database import get_db
from app.models import Chatbot, ChatSession, ChatMessage, User
from app.auth import get_current_user
from app.config import settings
from app.services.indexing import get_qdrant_client, get_embed_model, get_collection_name
from app.services.llm_provider import get_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

RELEVANCE_THRESHOLD = 0.25
MEMORY_MESSAGE_LIMIT = 10


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None  # None = create new session


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []
    session_id: str


def trim_to_sentences(text: str, max_length: int = 300) -> str:
    if len(text) <= max_length:
        return text.strip()
    truncated = text[:max_length]
    last_period = truncated.rfind(".")
    last_question = truncated.rfind("?")
    last_exclaim = truncated.rfind("!")
    boundary = max(last_period, last_question, last_exclaim)
    if boundary > 50:
        return truncated[:boundary + 1].strip()
    return truncated.strip() + "..."


def extract_sources(source_nodes: list) -> list[dict]:
    sources = []
    for node in source_nodes:
        score = node.score if node.score else 0
        if score < RELEVANCE_THRESHOLD:
            continue
        sources.append({
            "text": trim_to_sentences(node.text),
            "score": round(score, 3),
            "filename": node.metadata.get("filename", "Unknown"),
            "document_id": node.metadata.get("document_id"),
            "page": node.metadata.get("page"),
        })
    return sources


def load_chatbot_index(chatbot_id: UUID) -> VectorStoreIndex:
    client = get_qdrant_client()
    collection_name = get_collection_name(chatbot_id)
    collections = [c.name for c in client.get_collections().collections]
    if collection_name not in collections:
        raise ValueError("Chatbot index not found. Documents may still be processing.")
    vector_store = QdrantVectorStore(client=client, collection_name=collection_name)
    LISettings.embed_model = get_embed_model()
    return VectorStoreIndex.from_vector_store(vector_store)


def get_or_create_session(
    chatbot_id: UUID, user_id: UUID, session_id: str | None, db: Session
) -> ChatSession:
    """Get existing session or create a new one."""
    if session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.chatbot_id == chatbot_id,
            ChatSession.user_id == user_id,
        ).first()
        if not session:
            raise ValueError("Session not found")
        return session

    # Create new session
    session = ChatSession(
        chatbot_id=chatbot_id,
        user_id=user_id,
        title="New Chat",
    )
    db.add(session)
    db.flush()  # get the ID without committing
    return session


def auto_title_session(session: ChatSession, first_message: str):
    """Auto-generate session title from the first user message."""
    if session.title == "New Chat":
        title = first_message[:60].strip()
        if len(first_message) > 60:
            title += "..."
        session.title = title


def get_chat_history(session: ChatSession, db: Session) -> list[LIChatMessage]:
    """Get recent messages for memory context."""
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id,
    ).order_by(ChatMessage.created_at.desc()).limit(MEMORY_MESSAGE_LIMIT).all()

    # Reverse to chronological order
    messages = list(reversed(messages))

    history = []
    for msg in messages:
        role = MessageRole.USER if msg.role == "user" else MessageRole.ASSISTANT
        history.append(LIChatMessage(role=role, content=msg.content))

    return history


def save_message(session_id: UUID, role: str, content: str, sources: list | None, db: Session):
    """Save a chat message to the database."""
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sources=json.dumps(sources) if sources else None,
    )
    db.add(msg)


# Non-streaming chat
@router.post("/{chatbot_id}", response_model=ChatResponse)
def chat(
    chatbot_id: UUID,
    req: ChatRequest,
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

    # Get or create session
    try:
        session = get_or_create_session(chatbot_id, current_user.id, req.session_id, db)
    except ValueError as e:
        raise HTTPException(404, str(e))

    auto_title_session(session, req.message)

    # Load index and LLM
    try:
        index = load_chatbot_index(chatbot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    llm = get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key)

    # Build query with optional memory
    if chatbot.memory_enabled == "true":
        chat_history = get_chat_history(session, db)
        chat_engine = index.as_chat_engine(
            llm=llm,
            similarity_top_k=3,
            chat_history=chat_history,
            chat_mode="condense_plus_context",
        )
        response = chat_engine.chat(req.message)
        source_nodes = response.source_nodes if hasattr(response, "source_nodes") else []
    else:
        query_engine = index.as_query_engine(llm=llm, similarity_top_k=3)
        response = query_engine.query(req.message)
        source_nodes = response.source_nodes

    sources = extract_sources(source_nodes)

    # Save messages
    save_message(session.id, "user", req.message, None, db)
    save_message(session.id, "assistant", str(response), sources, db)
    session.updated_at = datetime.utcnow()
    db.commit()

    return ChatResponse(
        response=str(response),
        sources=sources,
        session_id=str(session.id),
    )

# Streaming chat
@router.post("/{chatbot_id}/stream")
def chat_stream(
    chatbot_id: UUID,
    req: ChatRequest,
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

    # Get or create session
    try:
        session = get_or_create_session(chatbot_id, current_user.id, req.session_id, db)
    except ValueError as e:
        raise HTTPException(404, str(e))

    auto_title_session(session, req.message)

    # Save user message immediately
    save_message(session.id, "user", req.message, None, db)

    # Load index and LLM
    try:
        index = load_chatbot_index(chatbot_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    llm = get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key)

    # Build query with optional memory
    use_memory = chatbot.memory_enabled == "true"

    if use_memory:
        chat_history = get_chat_history(session, db)
        chat_engine = index.as_chat_engine(
            llm=llm,
            similarity_top_k=3,
            chat_history=chat_history,
            chat_mode="condense_plus_context",
            streaming=True,
        )
        streaming_response = chat_engine.stream_chat(req.message)
    else:
        query_engine = index.as_query_engine(
            llm=llm, similarity_top_k=3, streaming=True,
        )
        streaming_response = query_engine.query(req.message)

    session_id = str(session.id)
    db.commit()  # commit session + user message before streaming

    def generate():
        full_response = ""
        for text in streaming_response.response_gen:
            full_response += text
            yield text

        # Extract sources
        source_nodes = streaming_response.source_nodes if hasattr(streaming_response, "source_nodes") else []
        sources = extract_sources(source_nodes)

        # Save assistant message after streaming completes
        from app.database import SessionLocal
        save_db = SessionLocal()
        try:
            save_message(UUID(session_id), "assistant", full_response, sources, save_db)
            save_session = save_db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if save_session:
                save_session.updated_at = datetime.utcnow()
            save_db.commit()
        finally:
            save_db.close()

        yield f"\n\n__SOURCES__{json.dumps(sources)}"
        yield f"\n__SESSION__{session_id}"

    return StreamingResponse(generate(), media_type="text/plain")