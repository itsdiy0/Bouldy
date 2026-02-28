"""Dashboard stats endpoint."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Chatbot, Document, ChatSession, ChatMessage, User
from app.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    total_chatbots: int
    total_documents: int
    total_sessions: int
    total_messages: int
    published_chatbots: int
    storage_bytes: int
    recent_activity: list[dict]
    chatbot_overview: list[dict]


@router.get("", response_model=DashboardStats)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id

    total_chatbots = db.query(func.count(Chatbot.id)).filter(Chatbot.user_id == uid).scalar() or 0
    total_documents = db.query(func.count(Document.id)).filter(Document.user_id == uid).scalar() or 0
    published_chatbots = db.query(func.count(Chatbot.id)).filter(
        Chatbot.user_id == uid, Chatbot.is_public == "true"
    ).scalar() or 0

    # Total sessions across all user's chatbots
    chatbot_ids = [c.id for c in db.query(Chatbot.id).filter(Chatbot.user_id == uid).all()]
    total_sessions = 0
    total_messages = 0
    if chatbot_ids:
        total_sessions = db.query(func.count(ChatSession.id)).filter(
            ChatSession.chatbot_id.in_(chatbot_ids)
        ).scalar() or 0
        session_ids = [s.id for s in db.query(ChatSession.id).filter(
            ChatSession.chatbot_id.in_(chatbot_ids)
        ).all()]
        if session_ids:
            total_messages = db.query(func.count(ChatMessage.id)).filter(
                ChatMessage.session_id.in_(session_ids)
            ).scalar() or 0

    # Storage usage
    storage_bytes = db.query(func.sum(Document.file_size)).filter(
        Document.user_id == uid
    ).scalar() or 0

    # Recent activity — last 10 messages across all chatbots
    recent_activity = []
    if session_ids:
        recent_msgs = db.query(ChatMessage).filter(
            ChatMessage.session_id.in_(session_ids),
            ChatMessage.role == "user",
        ).order_by(ChatMessage.created_at.desc()).limit(8).all()

        for msg in recent_msgs:
            session = db.query(ChatSession).filter(ChatSession.id == msg.session_id).first()
            chatbot = db.query(Chatbot).filter(Chatbot.id == session.chatbot_id).first() if session else None
            recent_activity.append({
                "message": msg.content[:80] + ("..." if len(msg.content) > 80 else ""),
                "chatbot_name": chatbot.name if chatbot else "Unknown",
                "chatbot_id": str(chatbot.id) if chatbot else None,
                "created_at": msg.created_at.isoformat(),
            })

    # Chatbot overview
    chatbot_overview = []
    chatbots = db.query(Chatbot).filter(Chatbot.user_id == uid).order_by(Chatbot.created_at.desc()).limit(6).all()
    for bot in chatbots:
        bot_sessions = db.query(func.count(ChatSession.id)).filter(
            ChatSession.chatbot_id == bot.id
        ).scalar() or 0
        chatbot_overview.append({
            "id": str(bot.id),
            "name": bot.name,
            "llm_provider": bot.llm_provider,
            "document_count": len(bot.documents),
            "session_count": bot_sessions,
            "is_public": bot.is_public,
            "accent_primary": bot.accent_primary or "#715A5A",
        })

    return DashboardStats(
        total_chatbots=total_chatbots,
        total_documents=total_documents,
        total_sessions=total_sessions,
        total_messages=total_messages,
        published_chatbots=published_chatbots,
        storage_bytes=storage_bytes,
        recent_activity=recent_activity,
        chatbot_overview=chatbot_overview,
    )