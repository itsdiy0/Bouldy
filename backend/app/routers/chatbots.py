import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Chatbot, Document, User
from app.schemas import ChatbotCreate, ChatbotResponse, ChatbotListResponse
from app.auth import get_current_user

router = APIRouter(prefix="/chatbots", tags=["chatbots"])


def chatbot_to_response(chatbot: Chatbot) -> ChatbotResponse:
    return ChatbotResponse(
        id=chatbot.id,
        name=chatbot.name,
        description=chatbot.description,
        llm_provider=chatbot.llm_provider,
        llm_model=chatbot.llm_model,
        is_public=chatbot.is_public,
        public_token=chatbot.public_token,
        created_at=chatbot.created_at,
        document_count=len(chatbot.documents),
    )


@router.post("", response_model=ChatbotResponse)
def create_chatbot(
    data: ChatbotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate documents belong to user
    if data.document_ids:
        docs = db.query(Document).filter(
            Document.id.in_(data.document_ids),
            Document.user_id == current_user.id,
        ).all()
        
        if len(docs) != len(data.document_ids):
            raise HTTPException(400, "One or more documents not found")
    else:
        docs = []

    # Create chatbot
    chatbot = Chatbot(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        llm_provider=data.llm_provider,
        llm_model=data.llm_model,
        # TODO: encrypt api_key before storing
        public_token=secrets.token_urlsafe(32),
    )
    
    # Assign documents
    chatbot.documents = docs
    
    db.add(chatbot)
    db.commit()
    db.refresh(chatbot)
    
    return chatbot_to_response(chatbot)


@router.get("", response_model=ChatbotListResponse)
def list_chatbots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chatbots = db.query(Chatbot).filter(
        Chatbot.user_id == current_user.id
    ).order_by(Chatbot.created_at.desc()).all()
    
    return ChatbotListResponse(
        chatbots=[chatbot_to_response(c) for c in chatbots],
        total=len(chatbots),
    )


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
def get_chatbot(
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
    
    return chatbot_to_response(chatbot)


@router.delete("/{chatbot_id}")
def delete_chatbot(
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
    
    db.delete(chatbot)
    db.commit()
    
    return {"message": "Chatbot deleted"}