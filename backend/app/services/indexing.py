"""
Document processing pipeline 
download from MinIO → parse → chunk → embed → store in Qdrant
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

logger = logging.getLogger(__name__)

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


# File Parsers 

def parse_pdf(content: bytes) -> str:
    """Extract text from PDF bytes."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

def parse_docx(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    import docx2txt
    return docx2txt.process(io.BytesIO(content))

def parse_txt(content: bytes) -> str:
    """Extract text from TXT bytes."""
    return content.decode("utf-8", errors="ignore")

PARSERS = {
    "pdf": parse_pdf,
    "docx": parse_docx,
    "txt": parse_txt,
}

def parse_document(content: bytes, file_type: str) -> str:
    """Parse document bytes into plain text based on file type."""
    parser = PARSERS.get(file_type)
    if not parser:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser(content)


# Core Pipeline

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
        try:
            content = get_file(doc.s3_key)
            text = parse_document(content, doc.file_type)

            if not text.strip():
                logger.warning(f"Document {doc.id} ({doc.original_filename}) produced no text, skipping")
                continue

            li_documents.append(LIDocument(
                text=text,
                metadata={
                    "document_id": str(doc.id),
                    "filename": doc.original_filename,
                    "file_type": doc.file_type,
                },
            ))
            logger.info(f"Parsed: {doc.original_filename} ({len(text)} chars)")
        except Exception as e:
            logger.error(f"Failed to parse document {doc.id}: {e}")
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
    # 6. Build index 
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