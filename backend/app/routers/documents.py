import uuid
import logging

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, User
from app.schemas import DocumentResponse, DocumentListResponse
from app.storage import upload_file, delete_file
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


# Upload a document
@router.post("", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        logger.warning(f"Upload rejected: unsupported type {file.content_type} from user {current_user.id}")
        raise HTTPException(400, f"File type not allowed. Allowed: {list(ALLOWED_TYPES.values())}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        logger.warning(f"Upload rejected: file too large ({len(content)} bytes) from user {current_user.id}")
        raise HTTPException(400, f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB")

    file_ext = ALLOWED_TYPES[file.content_type]
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    s3_key = f"{current_user.id}/{unique_filename}"

    upload_file(content, s3_key, file.content_type)

    document = Document(
        user_id=current_user.id,
        filename=unique_filename,
        original_filename=file.filename,
        file_type=file_ext,
        file_size=len(content),
        s3_key=s3_key,
        status="uploaded",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    logger.info(f"Document uploaded: {file.filename} ({len(content)} bytes) by user {current_user.id}")
    return document


# List all documents for the current user
@router.get("", response_model=DocumentListResponse)
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    documents = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(documents=documents, total=len(documents))


# Delete a document
@router.delete("/{document_id}")
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()

    if not document:
        raise HTTPException(404, "Document not found")

    delete_file(document.s3_key)
    db.delete(document)
    db.commit()

    logger.info(f"Document deleted: {document.original_filename} ({document_id}) by user {current_user.id}")
    return {"message": "Document deleted"}