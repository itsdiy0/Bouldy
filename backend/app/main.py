from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, documents, chatbots

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

app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chatbots.router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "bouldy-api"}