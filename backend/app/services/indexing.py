"""
Document processing pipeline for Bouldy.
Handles: download from MinIO → parse → chunk → embed → store in Qdrant
"""
import io
import logging
from uuid import UUID

from llama_index.core import Document as LIDocument, VectorStoreIndex, StorageContext, Settings as LISettings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse

from app.config import settings
from app.storage import get_file
from app.database import SessionLocal
from app.models import Document as DocumentModel

logger = logging.getLogger(__name__)


# ---------- Clients (initialized once) ----------

def get_qdrant_client() -> QdrantClient:
    return QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)


def get_embed_model() -> OpenAIEmbedding:
    return OpenAIEmbedding(
        model=settings.embedding_model,
        api_key=settings.openai_embedding_key,
    )


def get_collection_name(chatbot_id: UUID) -> str:
    """Each chatbot gets its own Qdrant collection."""
    return f"chatbot_{str(chatbot_id)}"


# ---------- File Parsers ----------

def parse_pdf_pages(content: bytes) -> list[dict]:
    """Extract text from PDF bytes, per page. Returns list of {text, page}."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text()
        if page_text and page_text.strip():
            pages.append({"text": page_text, "page": i + 1})
    return pages


def parse_docx(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    import docx2txt
    return docx2txt.process(io.BytesIO(content))


def parse_txt(content: bytes) -> str:
    """Extract text from TXT bytes."""
    return content.decode("utf-8", errors="ignore")


def update_document_status(doc_id, status: str):
    """Update a document's status in the database."""
    db = SessionLocal()
    try:
        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if doc:
            doc.status = status
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update document {doc_id} status: {e}")
        db.rollback()
    finally:
        db.close()


# ---------- Core Pipeline ----------

def index_chatbot_documents(
    chatbot_id: UUID,
    documents: list,  # list of Document ORM objects
) -> int:
    """
    Full indexing pipeline for a chatbot.
    Downloads docs from MinIO, parses, chunks, embeds, stores in Qdrant.
    
    Returns the number of chunks created.
    """
    collection_name = get_collection_name(chatbot_id)
    client = get_qdrant_client()

    # 1. Delete existing collection if it exists (clean rebuild)
    try:
        client.delete_collection(collection_name)
        logger.info(f"Deleted existing collection: {collection_name}")
    except UnexpectedResponse:
        pass  # Collection didn't exist, that's fine

    # 2. Download and parse all documents into LlamaIndex Documents
    li_documents = []
    for doc in documents:
        update_document_status(doc.id, "processing")
        try:
            content = get_file(doc.s3_key)
            base_metadata = {
                "document_id": str(doc.id),
                "filename": doc.original_filename,
                "file_type": doc.file_type,
            }

            if doc.file_type == "pdf":
                pages = parse_pdf_pages(content)
                for page_data in pages:
                    li_documents.append(LIDocument(
                        text=page_data["text"],
                        metadata={**base_metadata, "page": page_data["page"]},
                    ))
                logger.info(f"Parsed PDF: {doc.original_filename} ({len(pages)} pages)")

            elif doc.file_type == "docx":
                text = parse_docx(content)
                if text.strip():
                    li_documents.append(LIDocument(
                        text=text,
                        metadata={**base_metadata, "page": None},
                    ))
                    logger.info(f"Parsed DOCX: {doc.original_filename} ({len(text)} chars)")

            elif doc.file_type == "txt":
                text = parse_txt(content)
                if text.strip():
                    li_documents.append(LIDocument(
                        text=text,
                        metadata={**base_metadata, "page": None},
                    ))
                    logger.info(f"Parsed TXT: {doc.original_filename} ({len(text)} chars)")

            else:
                logger.warning(f"Unsupported file type: {doc.file_type}")
                update_document_status(doc.id, "failed")
                continue

            update_document_status(doc.id, "ready")

        except Exception as e:
            logger.error(f"Failed to parse document {doc.id}: {e}")
            update_document_status(doc.id, "failed")
            continue

    if not li_documents:
        logger.warning(f"No documents to index for chatbot {chatbot_id}")
        return 0

    # 3. Configure embedding model
    LISettings.embed_model = get_embed_model()

    # 4. Set up chunking
    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)

    # 5. Set up Qdrant vector store
    vector_store = QdrantVectorStore(
        client=client,
        collection_name=collection_name,
    )
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # 6. Build index (this chunks, embeds, and stores in one go)
    index = VectorStoreIndex.from_documents(
        li_documents,
        storage_context=storage_context,
        transformations=[splitter],
    )

    # 7. Get chunk count
    chunk_count = len(index.docstore.docs)
    logger.info(f"Indexed {chunk_count} chunks for chatbot {chatbot_id}")

    return chunk_count


def delete_chatbot_index(chatbot_id: UUID) -> None:
    """Delete a chatbot's Qdrant collection."""
    collection_name = get_collection_name(chatbot_id)
    client = get_qdrant_client()
    try:
        client.delete_collection(collection_name)
        logger.info(f"Deleted collection: {collection_name}")
    except UnexpectedResponse:
        pass  # Already gone