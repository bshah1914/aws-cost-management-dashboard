#!/bin/bash

# Kubernetes Deployment Helper Script
# This script helps set up the Kubernetes cluster for deployments

set -e

NAMESPACE=${1:-staging}
REGISTRY_TOKEN=${2:-}

if [ -z "$REGISTRY_TOKEN" ]; then
    echo "Usage: ./setup-k8s.sh <namespace> <github-registry-token>"
    echo "Example: ./setup-k8s.sh staging ghp_xxxxxxxxxxxxx"
    exit 1
fi

echo "Setting up Kubernetes for ${NAMESPACE} environment..."

# Create namespace
echo "Creating namespace: ${NAMESPACE}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Create image pull secret for GitHub Container Registry
echo "Creating GitHub Container Registry secret..."
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=bshah1914 \
  --docker-password=${REGISTRY_TOKEN} \
  --docker-email=user@example.com \
  -n ${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# Create the secrets
echo "Creating application secrets..."
NAMESPACE=${NAMESPACE} envsubst < k8s/secrets.yaml | kubectl apply -f -

# Create ConfigMap
echo "Creating ConfigMap..."
NAMESPACE=${NAMESPACE} envsubst < k8s/configmap.yaml | kubectl apply -f -

echo "✓ Kubernetes setup complete for ${NAMESPACE}"
echo ""
echo "Next steps:"
echo "1. Update secrets: kubectl edit secret app-secrets -n ${NAMESPACE}"
echo "2. Verify setup: kubectl get all -n ${NAMESPACE}"
echo "3. Trigger Jenkins build for deployment"
