"""
Health check endpoints for Bouldy.
Used by Kubernetes probes and monitoring.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.config import settings
from app.services.indexing import get_qdrant_client
from app.storage import get_s3_client

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """Basic liveness check — is the API running?"""
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)):
    """
    Readiness check — are all dependencies reachable?
    Returns status of each service.
    """
    checks = {}

    # Database
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"

    # Qdrant
    try:
        client = get_qdrant_client()
        client.get_collections()
        checks["qdrant"] = "ok"
    except Exception as e:
        checks["qdrant"] = f"error: {str(e)}"

    # MinIO
    try:
        s3 = get_s3_client()
        s3.head_bucket(Bucket=settings.minio_bucket)
        checks["minio"] = "ok"
    except Exception as e:
        checks["minio"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }