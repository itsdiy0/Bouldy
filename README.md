<div align="center">

# Bouldy

<img src="https://github.com/itsdiy0/Bouldy/blob/main/Bouldy.webp" alt="Bouldy" width="300"/>

A multi-tenant platform for building document-powered AI chatbots.

[Live Demo](https://bouldy.diy0.dev) · [API](https://api-bouldy.diy0.dev/docs)

</div>

---

## Overview

Bouldy lets users upload documents, create AI chatbots that answer questions based on those documents, and deploy them via shareable links or embeddable widgets. Users bring their own LLM API keys.

The platform uses Retrieval-Augmented Generation (RAG) to ground LLM responses in actual document content, reducing hallucination and providing source citations with every answer.

**Key capabilities:**

- Upload PDF, DOCX, and TXT files with S3-backed storage
- Create chatbots with configurable LLM providers (OpenAI, Anthropic, Gemini, Grok, Ollama)
- RAG pipeline: document parsing, chunking, embedding, and vector retrieval via LlamaIndex and Qdrant
- Streaming chat with source citations and optional conversation memory
- Semantic query caching to reduce redundant LLM calls
- Public sharing with rate limiting and an embeddable widget
- Chatbot branding (colours, avatars)
- RAGAS evaluation for measuring retrieval quality (faithfulness, relevance, context precision)
- Multi-tenant isolation throughout

## Architecture

### System overview

<img src="docs/architecture.svg" alt="System architecture" width="100%"/>

### RAG pipeline

<img src="docs/rag-pipeline.svg" alt="RAG pipeline" width="100%"/>

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11+, SQLAlchemy |
| RAG | LlamaIndex, OpenAI Embeddings, Qdrant |
| LLM Providers | OpenAI, Anthropic, Google Gemini, Grok (xAI), Ollama |
| Storage | PostgreSQL, MinIO (S3-compatible), Redis |
| Infrastructure | Docker, Kubernetes, Terraform (AWS), GitHub Actions |

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/itsdiy0/Bouldy.git
cd Bouldy
```

### 2. Start the infrastructure

```bash
docker compose up -d db minio qdrant redis
```

This starts PostgreSQL, Qdrant, MinIO, and Redis. The API and frontend run outside Docker during development for faster iteration.

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://bouldy:bouldy@localhost:5432/bouldy
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
QDRANT_HOST=localhost
QDRANT_PORT=6333
REDIS_URL=redis://localhost:6379
OPENAI_EMBEDDING_KEY=sk-your-openai-key
SECRET_KEY=change-me-in-production
```

Run database migrations and start the server:

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

### 4. Frontend

```bash
cd frontend
npm install
```

Create `.env.local` in `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Frontend available at `http://localhost:3000`.

### 5. Running Tests

```bash
cd backend
pytest -v
```

Tests use SQLite in-memory — no external services required. The suite includes 131 tests covering auth, documents, chatbots, RAG pipeline, integration flows, and OWASP-mapped security checks.

## Deployment

### Docker Compose

The quickest way to run the full stack locally:

```bash
cp .env.example .env  # add your OPENAI_EMBEDDING_KEY
docker compose up -d
```

This starts the API, frontend, PostgreSQL, MinIO, Qdrant, and Redis. The API runs on port 8000 and the frontend on port 3000.

### Kubernetes

The `infrastructure/k8s/` directory contains manifests for deploying Bouldy on any Kubernetes cluster.

**Prerequisites:** A running Kubernetes cluster and `kubectl` configured to access it. Container images are available on GHCR at `ghcr.io/itsdiy0/bouldy-api` and `ghcr.io/itsdiy0/bouldy-frontend`.

**1. Configure secrets**

```bash
cd infrastructure/k8s
cp secrets.yaml.example secrets.yaml
```

Edit `secrets.yaml` and fill in your values: database password, MinIO credentials, OpenAI embedding key, and application secrets.

**2. Deploy**

A deploy script is included that applies everything in the correct order and waits for infrastructure to be ready before starting the application:

```bash
chmod +x deploy.sh
./deploy.sh
```

This creates the `bouldy` namespace, applies secrets, deploys PostgreSQL, MinIO, Qdrant, and Redis, waits for them to be healthy, then deploys the API (with an Alembic migration init container) and frontend, and finally configures ingress.

**3. Verify**

```bash
kubectl get pods -n bouldy
```

All pods should show `Running`. The API and frontend are exposed via the ingress — configure your ingress controller and domain accordingly.

**Manifests included:**

| File | Description |
|---|---|
| `namespace.yaml` | Creates the `bouldy` namespace |
| `secrets.yaml.example` | Template for sensitive configuration |
| `postgres.yaml` | PostgreSQL 16 with persistent volume |
| `minio.yaml` | MinIO object storage |
| `qdrant.yaml` | Qdrant vector database |
| `redis.yaml` | Redis for semantic caching |
| `backend.yaml` | API deployment with Alembic init container |
| `frontend.yaml` | Next.js frontend deployment |
| `ingress.yaml` | Ingress routing rules |

### AWS (Terraform)

The `infrastructure/terraform/` directory contains a full AWS deployment using Terraform.

**Resources provisioned:**

| Resource | Service |
|---|---|
| Compute | ECS Fargate (API + frontend) |
| Database | RDS PostgreSQL |
| Cache | ElastiCache Redis |
| Storage | S3 bucket for documents |
| Networking | VPC, subnets, ALB, security groups |
| TLS | ACM certificate |

**1. Configure**

```bash
cd infrastructure/terraform
```

Create a `terraform.tfvars` file with your sensitive values:

```hcl
db_password          = "your-secure-password"
secret_key           = "your-app-secret"
nextauth_secret      = "your-nextauth-secret"
openai_embedding_key = "sk-your-openai-key"
```

Optional overrides (see `variables.tf` for all options):

```hcl
aws_region     = "eu-west-2"
domain_name    = "your-domain.com"
api_image      = "ghcr.io/itsdiy0/bouldy-api:latest"
frontend_image = "ghcr.io/itsdiy0/bouldy-frontend:latest"
```

**2. Deploy**

```bash
terraform init
terraform plan     # review what will be created
terraform apply    # provision resources
```

**3. Tear down**

```bash
terraform destroy
```

### Live Demo

A running instance is deployed at [bouldy.diy0.dev](https://bouldy.diy0.dev) for testing and demonstration.

## License

MIT — see [LICENSE](LICENSE) for details.