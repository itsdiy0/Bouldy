"""
Public chat endpoints for Bouldy.
No authentication required — accessed via public_token.
Rate limited to prevent abuse.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address


from app.database import get_db
from app.models import Chatbot
from app.services.llm_provider import get_llm
from app.routers.chat import (
    load_chatbot_index, extract_sources,
)

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/public", tags=["public"])


class PublicChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class PublicChatbotInfo(BaseModel):
    name: str
    description: str | None
    accent_primary: str
    accent_secondary: str
    avatar_url: str | None
    has_avatar: bool


# Get public chatbot info (for rendering the chat page)
@router.get("/{token}")
def get_public_chatbot(
    token: str,
    db: Session = Depends(get_db),
):
    chatbot = db.query(Chatbot).filter(
        Chatbot.public_token == token,
        Chatbot.is_public == "true",
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found or not published")

    return PublicChatbotInfo(
        name=chatbot.name,
        description=chatbot.description,
        accent_primary=chatbot.accent_primary or "#715A5A",
        accent_secondary=chatbot.accent_secondary or "#2D2B33",
        avatar_url=f"/api/chatbots/{chatbot.id}/avatar" if chatbot.avatar_url else None,
        has_avatar=chatbot.avatar_url is not None,
    )


# Public streaming chat
@router.post("/{token}/chat")
@limiter.limit("20/minute")
def public_chat(
    request: Request,
    token: str,
    req: PublicChatRequest,
    db: Session = Depends(get_db),
):
    # 1. Find chatbot by token
    chatbot = db.query(Chatbot).filter(
        Chatbot.public_token == token,
        Chatbot.is_public == "true",
    ).first()

    if not chatbot:
        raise HTTPException(404, "Chatbot not found or not published")

    if not chatbot.llm_provider or not chatbot.llm_model:
        raise HTTPException(400, "Chatbot LLM not configured")

    # 2. Load index
    try:
        index = load_chatbot_index(chatbot.id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 3. Get LLM using chatbot's stored API key
    llm = get_llm(chatbot.llm_provider, chatbot.llm_model, chatbot.llm_api_key)

    # 4. Query (no memory for public chats — stateless)
    query_engine = index.as_query_engine(
        llm=llm,
        similarity_top_k=3,
        streaming=True,
    )

    streaming_response = query_engine.query(req.message)

    def generate():
        full_response = ""
        for text in streaming_response.response_gen:
            full_response += text
            yield text

        source_nodes = streaming_response.source_nodes if hasattr(streaming_response, "source_nodes") else []
        sources = extract_sources(source_nodes)

        yield f"\n\n__SOURCES__{json.dumps(sources)}"

    return StreamingResponse(generate(), media_type="text/plain")