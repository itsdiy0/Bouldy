from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Environment
    environment: str = "development"  # development, staging, production
    debug: bool = True

    # Database
    database_url: str = "postgresql://bouldy:bouldy@localhost:5432/bouldy"

    # MinIO / S3
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "documents"
    minio_secure: bool = False

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    # Embeddings
    openai_embedding_key: str = ""
    embedding_model: str = "text-embedding-3-small"

    # Security
    secret_key: str = "change-me-in-production"
    allowed_origins: str = "*"  # comma-separated origins

    # Rate limiting
    public_rate_limit: str = "20/minute"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    class Config:
        env_file = ".env"


settings = Settings()