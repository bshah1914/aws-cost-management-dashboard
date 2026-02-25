#!/bin/bash

# Manual deployment script (without Jenkins)
# Use this if you want to deploy without Jenkins

set -e

ENVIRONMENT=${1:-staging}
BACKEND_IMAGE=${2:-ghcr.io/bshah1914/aws-cost-dashboard-backend:latest}
FRONTEND_IMAGE=${3:-ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest}

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: ./deploy.sh <environment> [backend-image] [frontend-image]"
    echo "Example: ./deploy.sh staging ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0"
    exit 1
fi

echo "Deploying to ${ENVIRONMENT} environment..."
echo "Backend Image: ${BACKEND_IMAGE}"
echo "Frontend Image: ${FRONTEND_IMAGE}"

export NAMESPACE=${ENVIRONMENT}
export BACKEND_IMAGE=${BACKEND_IMAGE}
export FRONTEND_IMAGE=${FRONTEND_IMAGE}

# Apply base configs
echo "Applying namespace and configurations..."
envsubst < k8s/namespace.yaml | kubectl apply -f -
envsubst < k8s/configmap.yaml | kubectl apply -f -
envsubst < k8s/secrets.yaml | kubectl apply -f -

# Apply environment-specific deployments
echo "Applying deployments and services..."
envsubst < k8s/${ENVIRONMENT}/backend-deployment.yaml | kubectl apply -f -
envsubst < k8s/${ENVIRONMENT}/backend-service.yaml | kubectl apply -f -
envsubst < k8s/${ENVIRONMENT}/frontend-deployment.yaml | kubectl apply -f -
envsubst < k8s/${ENVIRONMENT}/frontend-service.yaml | kubectl apply -f -

# Wait for rollout
echo "Waiting for deployments to be ready..."
kubectl rollout status deployment/backend-dashboard -n ${ENVIRONMENT} --timeout=5m
kubectl rollout status deployment/frontend-dashboard -n ${ENVIRONMENT} --timeout=5m

# Show deployment info
echo ""
echo "✓ Deployment complete!"
echo ""
echo "Deployment Info:"
kubectl get all -n ${ENVIRONMENT}
echo ""
echo "Get frontend URL:"
kubectl get svc frontend-dashboard -n ${ENVIRONMENT}
