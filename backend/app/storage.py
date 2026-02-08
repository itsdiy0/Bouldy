import boto3
from botocore.exceptions import ClientError
from app.config import settings
# S3 actions 

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
    )


def ensure_bucket_exists():
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        s3.create_bucket(Bucket=settings.minio_bucket)


def upload_file(file_content: bytes, s3_key: str, content_type: str) -> str:
    s3 = get_s3_client()
    ensure_bucket_exists()
    
    s3.put_object(
        Bucket=settings.minio_bucket,
        Key=s3_key,
        Body=file_content,
        ContentType=content_type,
    )
    
    return s3_key


def delete_file(s3_key: str):
    s3 = get_s3_client()
    s3.delete_object(Bucket=settings.minio_bucket, Key=s3_key)


def get_file(s3_key: str) -> bytes:
    s3 = get_s3_client()
    response = s3.get_object(Bucket=settings.minio_bucket, Key=s3_key)
    return response["Body"].read()