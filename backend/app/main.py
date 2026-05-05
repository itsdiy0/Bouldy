from fastapi import FastAPI
from app.routers import auth, documents, chatbots, chat, sessions, public, dashboard, health,evaluation
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.routers.public import limiter
from app.logging_config import setup_logging
from app.config import settings
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

setup_logging()

app = FastAPI(
    title="Bouldy API",
    description="""
**Bouldy** is a multi-tenant AI chatbot platform for document-based knowledge retrieval.

Users can upload documents, create custom chatbots powered by their choice of LLM provider, 
and deploy them via shareable links or embeddable widgets.

## Core Features

- **Document Management** — Upload PDF, DOCX, TXT files with S3 storage
- **RAG Pipeline** — LlamaIndex-powered parsing, chunking, embedding, and retrieval via Qdrant
- **Multi-Provider LLM** — OpenAI, Anthropic, Google Gemini, Grok (xAI), Ollama (BYOK)
- **Chat Sessions** — Persistent conversations with optional memory
- **Public Access** — Shareable links and embeddable iframes with rate limiting
- **Chatbot Branding** — Custom color themes and avatar uploads

## Authentication

All authenticated endpoints require an `X-User-Id` header with a valid user UUID.
Public endpoints (`/api/public/*`) require no authentication.
    """,
    version="1.0.0",
    contact={
        "name": "Mobin Rajaei",
        "url": "https://github.com/itsdiy0/Bouldy",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=[
        {
            "name": "auth",
            "description": "User registration and login",
        },
        {
            "name": "documents",
            "description": "Upload, list, and delete documents stored in S3/MinIO",
        },
        {
            "name": "chatbots",
            "description": "Create, configure, and manage chatbots with LLM provider settings and branding",
        },
        {
            "name": "chat",
            "description": "Authenticated chat endpoints with streaming responses and session tracking",
        },
        {
            "name": "sessions",
            "description": "Chat session CRUD — list, create, rename, delete conversations",
        },
        {
            "name": "public",
            "description": "Public chat endpoints — no auth required, rate limited (20 req/min per IP)",
        },
        {
            "name": "dashboard",
            "description": "Aggregated stats for the user's workspace",
        },
        {
            "name": "health",
            "description": "Liveness and readiness probes for Kubernetes and monitoring",
        },
    ],
)

# CORS configuration
# - /api/public/* endpoints accept any origin (widget embeds on third-party sites)
# - All other endpoints use the configured allowlist
PUBLIC_PATH_PREFIX = "/api/public"
allowed_origins_list = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]


class ScopedCORSMiddleware(BaseHTTPMiddleware):
    """Apply wildcard CORS to public endpoints, allowlist to everything else."""

    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        is_public_path = request.url.path.startswith(PUBLIC_PATH_PREFIX)

        # Handle CORS preflight
        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)

        if origin:
            if is_public_path:
                # Public endpoints: allow any origin (widget embed support)
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
            elif origin in allowed_origins_list or "*" in allowed_origins_list:
                # Authenticated endpoints: strict allowlist
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Vary"] = "Origin"

        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            if not is_public_path:
                response.headers["Access-Control-Allow-Credentials"] = "true"

        return response


app.add_middleware(ScopedCORSMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chatbots.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")

app.mount("/static", StaticFiles(directory="app/static"), name="static")