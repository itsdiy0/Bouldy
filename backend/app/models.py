import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Table, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


# Join table for chatbot <-> document many-to-many
chatbot_documents = Table(
    "chatbot_documents",
    Base.metadata,
    Column("chatbot_id", UUID(as_uuid=True), ForeignKey("chatbots.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    chatbots = relationship("Chatbot", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt
    file_size = Column(Integer, nullable=False)  # bytes
    s3_key = Column(String(512), nullable=False)
    
    status = Column(String(50), default="uploaded")  # uploaded, processing, ready, failed
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chatbots = relationship("Chatbot", secondary=chatbot_documents, back_populates="documents")


class Chatbot(Base):
    __tablename__ = "chatbots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # LLM provider config (encrypted in production)
    llm_provider = Column(String(50))  # openai, anthropic, ollama, groq
    llm_model = Column(String(100))
    llm_api_key = Column(Text)
    
    # Public access
    public_token = Column(String(64), unique=True, index=True)
    is_public = Column(String(10), default="false")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="chatbots")
    documents = relationship("Document", secondary=chatbot_documents, back_populates="chatbots")