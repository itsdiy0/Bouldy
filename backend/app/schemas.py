from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# Documents
class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


# Chatbots
class ChatbotCreate(BaseModel):
    name: str
    description: str | None = None
    document_ids: list[UUID] = []
    llm_provider: str | None = None
    llm_model: str | None = None
    api_key: str | None = None


class ChatbotUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    document_ids: list[UUID] | None = None
    llm_provider: str | None = None
    llm_model: str | None = None
    api_key: str | None = None


class ChatbotResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    llm_provider: str | None
    llm_model: str | None
    is_public: str
    public_token: str | None
    created_at: datetime
    document_count: int = 0

    class Config:
        from_attributes = True


class ChatbotListResponse(BaseModel):
    chatbots: list[ChatbotResponse]
    total: int

class ChatbotDetailResponse(ChatbotResponse):
    document_ids: list[str] = []

class ChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    sources: str | None = None  # JSON string
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    id: UUID
    chatbot_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ChatSessionDetailResponse(ChatSessionResponse):
    messages: list[ChatMessageResponse] = []


class ChatSessionListResponse(BaseModel):
    sessions: list[ChatSessionResponse]
    total: int


class ChatSessionUpdate(BaseModel):
    title: str | None = None