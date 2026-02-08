from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://bouldy:bouldy@localhost:5432/bouldy"
    
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "documents"
    minio_secure: bool = False

    class Config:
        env_file = ".env"


settings = Settings()