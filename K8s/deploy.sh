#!/bin/bash
set -e
# Create namespace
echo "→ Creating namespace..."
kubectl apply -f K8s/namespace.yaml

# Apply secrets (must exist — copy from secrets.yaml.example)
if [ ! -f K8s/secrets.yaml ]; then
  echo "K8s/secrets.yaml not found. Copy from secrets.yaml.example and fill in values."
  exit 1
fi
echo "→ Applying secrets..."
kubectl apply -f K8s/secrets.yaml

# Deploy infrastructure
echo "→ Deploying PostgreSQL..."
kubectl apply -f K8s/postgres.yaml

echo "→ Deploying MinIO..."
kubectl apply -f K8s/minio.yaml

echo "→ Deploying Qdrant..."
kubectl apply -f K8s/qdrant.yaml

echo "→ Deploying Redis..."
kubectl apply -f K8s/redis.yaml

# Wait for infra to be ready
echo "→ Waiting for infrastructure..."
kubectl wait --for=condition=ready pod -l app=postgres -n bouldy --timeout=120s
kubectl wait --for=condition=ready pod -l app=minio -n bouldy --timeout=120s
kubectl wait --for=condition=ready pod -l app=qdrant -n bouldy --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n bouldy --timeout=120s

# Deploy application
echo "→ Deploying API (runs migrations via init container)..."
kubectl apply -f K8s/backend.yaml

echo "→ Deploying Frontend..."
kubectl apply -f K8s/frontend.yaml

# Ingress
echo "→ Configuring ingress..."
kubectl apply -f K8s/ingress.yaml

echo ""
echo "Bouldy deployed! Checking status..."
echo ""
kubectl get pods -n bouldy
