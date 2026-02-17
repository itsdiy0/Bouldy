import logging
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks,UploadFile,File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Chatbot, Document, User
from app.schemas import ChatbotCreate, ChatbotUpdate, ChatbotResponse, ChatbotDetailResponse, ChatbotListResponse
from app.auth import get_current_user
from app.services.indexing import index_chatbot_documents, delete_chatbot_index
from app.storage import upload_file
from fastapi.responses import Response
from app.storage import get_file as get_s3_file

logger = logging.getLogger(__name__)

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
        memory_enabled=chatbot.memory_enabled or "false",
        accent_primary=chatbot.accent_primary or "#715A5A",
        accent_secondary=chatbot.accent_secondary or "#2D2B33",
        avatar_url=chatbot.avatar_url,
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
        memory_enabled=chatbot.memory_enabled or "false",
        accent_primary=chatbot.accent_primary or "#715A5A",
        accent_secondary=chatbot.accent_secondary or "#2D2B33",
        avatar_url=chatbot.avatar_url,
    )


# Create a new chatbot with optional document assignments
@router.post("", response_model=ChatbotResponse)
def create_chatbot(
    data: ChatbotCreate,
    background_tasks: BackgroundTasks,
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
        llm_api_key=data.api_key,
        public_token=secrets.token_urlsafe(32),
        accent_primary=data.accent_primary or "#715A5A",
        accent_secondary=data.accent_secondary or "#2D2B33",
    )
    
    chatbot.documents = docs
    
    db.add(chatbot)
    db.commit()
    db.refresh(chatbot)

    # Trigger indexing in background if documents were assigned
    if docs:
        background_tasks.add_task(index_chatbot_documents, chatbot.id, docs)
        logger.info(f"Queued indexing for chatbot {chatbot.id} with {len(docs)} docs")
    
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
    
    if data.name is not None:
        chatbot.name = data.name
    if data.description is not None:
        chatbot.description = data.description
    if data.llm_provider is not None:
        chatbot.llm_provider = data.llm_provider
    if data.llm_model is not None:
        chatbot.llm_model = data.llm_model
    if data.api_key is not None:
        chatbot.llm_api_key = data.api_key
    if data.memory_enabled is not None:
        chatbot.memory_enabled = data.memory_enabled
    if data.accent_primary is not None:
        chatbot.accent_primary = data.accent_primary
    if data.accent_secondary is not None:
        chatbot.accent_secondary = data.accent_secondary

    needs_reindex = False
    if data.document_ids is not None:
        docs = db.query(Document).filter(
            Document.id.in_(data.document_ids),
            Document.user_id == current_user.id,
        ).all()
        
        if len(docs) != len(data.document_ids):
            raise HTTPException(400, "One or more documents not found")
        
        # Check if documents actually changed
        old_ids = {str(d.id) for d in chatbot.documents}
        new_ids = {str(d) for d in data.document_ids}
        if old_ids != new_ids:
            chatbot.documents = docs
            needs_reindex = True
    
    db.commit()
    db.refresh(chatbot)

    # Re-index if documents changed
    if needs_reindex:
        if chatbot.documents:
            background_tasks.add_task(index_chatbot_documents, chatbot.id, chatbot.documents)
            logger.info(f"Queued re-indexing for chatbot {chatbot.id}")
        else:
            background_tasks.add_task(delete_chatbot_index, chatbot.id)
            logger.info(f"Queued index deletion for chatbot {chatbot.id} (no docs)")
    
    return chatbot_to_response(chatbot)


# Delete a chatbot by ID
@router.delete("/{chatbot_id}")
def delete_chatbot(
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
    
    # Clean up Qdrant collection in background
    background_tasks.add_task(delete_chatbot_index, chatbot_id)
    
    db.delete(chatbot)
    db.commit()
    
    return {"message": "Chatbot deleted"}

@router.post("/{chatbot_id}/avatar")
async def upload_avatar(
    chatbot_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id,
    ).first()
    if not chatbot:
        raise HTTPException(404, "Chatbot not found")
    
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(400, "Avatar too large. Max 2MB.")
    
    s3_key = f"avatars/{current_user.id}/{chatbot_id}.png"
    upload_file(content, s3_key, file.content_type or "image/png")
    
    chatbot.avatar_url = s3_key
    db.commit()
    
    return {"avatar_url": s3_key}

@router.get("/{chatbot_id}/avatar")
def get_avatar(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
):
    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
    if not chatbot or not chatbot.avatar_url:
        raise HTTPException(404, "No avatar found")
    
    content = get_s3_file(chatbot.avatar_url)
    return Response(content=content, media_type="image/png")