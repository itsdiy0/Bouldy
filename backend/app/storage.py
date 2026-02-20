# S3/MinIO storage operations
import logging

import boto3
from botocore.exceptions import ClientError
from app.config import settings

logger = logging.getLogger(__name__)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
    )


# Ensure the bucket exists, create if not
def ensure_bucket_exists():
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        s3.create_bucket(Bucket=settings.minio_bucket)
        logger.info(f"Created bucket: {settings.minio_bucket}")


# Upload file to S3
def upload_file(file_content: bytes, s3_key: str, content_type: str) -> str:
    s3 = get_s3_client()
    ensure_bucket_exists()

    s3.put_object(
        Bucket=settings.minio_bucket,
        Key=s3_key,
        Body=file_content,
        ContentType=content_type,
    )

    logger.info(f"S3 upload: {s3_key} ({len(file_content)} bytes)")
    return s3_key


# Delete file from S3
def delete_file(s3_key: str):
    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=settings.minio_bucket, Key=s3_key)
        logger.info(f"S3 delete: {s3_key}")
    except Exception as e:
        logger.error(f"S3 delete failed: {s3_key} — {e}")


# Get file from S3
def get_file(s3_key: str) -> bytes:
    s3 = get_s3_client()
    try:
        response = s3.get_object(Bucket=settings.minio_bucket, Key=s3_key)
        return response["Body"].read()
    except Exception as e:
        logger.error(f"S3 get failed: {s3_key} — {e}")
        raise