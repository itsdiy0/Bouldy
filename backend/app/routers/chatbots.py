import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Chatbot, Document, User
from app.schemas import ChatbotCreate, ChatbotUpdate, ChatbotResponse, ChatbotDetailResponse, ChatbotListResponse
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


def chatbot_to_detail_response(chatbot: Chatbot) -> ChatbotDetailResponse:
    return ChatbotDetailResponse(
        id=chatbot.id,
        name=chatbot.name,
        description=chatbot.description,
        llm_provider=chatbot.llm_provider,
        llm_model=chatbot.llm_model,
        is_public=chatbot.is_public,
        public_token=chatbot.public_token,
        created_at=chatbot.created_at,
        document_count=len(chatbot.documents),
        document_ids=[str(doc.id) for doc in chatbot.documents],
    )


# Create a new chatbot with optional document assignments
@router.post("", response_model=ChatbotResponse)
def create_chatbot(
    data: ChatbotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.document_ids:
        docs = db.query(Document).filter(
            Document.id.in_(data.document_ids),
            Document.user_id == current_user.id,
        ).all()
        
        if len(docs) != len(data.document_ids):
            raise HTTPException(400, "One or more documents not found")
    else:
        docs = []

    chatbot = Chatbot(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        llm_provider=data.llm_provider,
        llm_model=data.llm_model,
        public_token=secrets.token_urlsafe(32),
    )
    
    chatbot.documents = docs
    
    db.add(chatbot)
    db.commit()
    db.refresh(chatbot)
    
    return chatbot_to_response(chatbot)


# List all chatbots for the current user
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


# Get a single chatbot by ID (includes document_ids)
@router.get("/{chatbot_id}", response_model=ChatbotDetailResponse)
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
    
    return chatbot_to_detail_response(chatbot)


# Update chatbot fields and/or document assignments
@router.patch("/{chatbot_id}", response_model=ChatbotResponse)
def update_chatbot(
    chatbot_id: UUID,
    data: ChatbotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()
    
    if not chatbot:
        raise HTTPException(404, "Chatbot not found")
    
    if data.name is not None:
        chatbot.name = data.name
    if data.description is not None:
        chatbot.description = data.description
    if data.llm_provider is not None:
        chatbot.llm_provider = data.llm_provider
    if data.llm_model is not None:
        chatbot.llm_model = data.llm_model
    
    if data.document_ids is not None:
        docs = db.query(Document).filter(
            Document.id.in_(data.document_ids),
            Document.user_id == current_user.id,
        ).all()
        
        if len(docs) != len(data.document_ids):
            raise HTTPException(400, "One or more documents not found")
        
        chatbot.documents = docs
    
    db.commit()
    db.refresh(chatbot)
    
    return chatbot_to_response(chatbot)


# Delete a chatbot by ID
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