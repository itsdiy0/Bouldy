"""
Chat session endpoints for Bouldy.
Handles: session CRUD, message history retrieval.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Chatbot, ChatSession, ChatMessage, User
from app.schemas import (
    ChatSessionResponse, ChatSessionDetailResponse,
    ChatSessionListResponse, ChatSessionUpdate,
)
from app.auth import get_current_user

router = APIRouter(prefix="/chatbots/{chatbot_id}/sessions", tags=["sessions"])


def session_to_response(session: ChatSession) -> ChatSessionResponse:
    return ChatSessionResponse(
        id=session.id,
        chatbot_id=session.chatbot_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(session.messages),
    )


def verify_chatbot_access(chatbot_id: UUID, user: User, db: Session) -> Chatbot:
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == user.id,
    ).first()
    if not chatbot:
        raise HTTPException(404, "Chatbot not found")
    return chatbot


# List all sessions for a chatbot
@router.get("", response_model=ChatSessionListResponse)
def list_sessions(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_chatbot_access(chatbot_id, current_user, db)

    sessions = db.query(ChatSession).filter(
        ChatSession.chatbot_id == chatbot_id,
        ChatSession.user_id == current_user.id,
    ).order_by(ChatSession.updated_at.desc()).all()

    return ChatSessionListResponse(
        sessions=[session_to_response(s) for s in sessions],
        total=len(sessions),
    )


# Create a new session
@router.post("", response_model=ChatSessionResponse)
def create_session(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_chatbot_access(chatbot_id, current_user, db)

    session = ChatSession(
        chatbot_id=chatbot_id,
        user_id=current_user.id,
        title="New Chat",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return session_to_response(session)


# Get a session with all messages
@router.get("/{session_id}", response_model=ChatSessionDetailResponse)
def get_session(
    chatbot_id: UUID,
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_chatbot_access(chatbot_id, current_user, db)

    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.chatbot_id == chatbot_id,
        ChatSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(404, "Session not found")

    return ChatSessionDetailResponse(
        id=session.id,
        chatbot_id=session.chatbot_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(session.messages),
        messages=session.messages,
    )


# Update session title
@router.patch("/{session_id}", response_model=ChatSessionResponse)
def update_session(
    chatbot_id: UUID,
    session_id: UUID,
    data: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_chatbot_access(chatbot_id, current_user, db)

    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.chatbot_id == chatbot_id,
        ChatSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(404, "Session not found")

    if data.title is not None:
        session.title = data.title

    db.commit()
    db.refresh(session)

    return session_to_response(session)


# Delete a session
@router.delete("/{session_id}")
def delete_session(
    chatbot_id: UUID,
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_chatbot_access(chatbot_id, current_user, db)

    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.chatbot_id == chatbot_id,
        ChatSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(404, "Session not found")

    db.delete(session)
    db.commit()

    return {"message": "Session deleted"}