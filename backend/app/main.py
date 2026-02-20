from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, documents, chatbots,chat,sessions,public,dashboard,health
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.routers.public import limiter

app = FastAPI(
    title="Bouldy API",
    description="AI-Powered Chatbot Platform for Document-Based Knowledge Retrieval",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
