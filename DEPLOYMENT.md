# Kubernetes & Jenkins Deployment Guide

## Overview
This guide covers deploying the AWS Cost Management Dashboard to Kubernetes using Jenkins for CI/CD.

**Architecture:**
- **CI/CD**: Jenkins Pipeline
- **Container Registry**: GitHub Container Registry (ghcr.io)
- **Orchestration**: Kubernetes (K8s)
- **Environments**: Staging & Production
- **Container Images**: Backend (FastAPI) + Frontend (React/Vite)

---

## Prerequisites

### Required Software
- Kubernetes Cluster (1.21+) - you have `aws-cost-management`
- Jenkins Server (optional - can deploy manually)
- Docker (for building images locally)
- kubectl (Kubernetes CLI)
- git

### Required Accounts & Access
- GitHub account with Personal Access Token (for ghcr.io)
- Kubernetes cluster access (kubeconfig file)
- Docker Hub or GitHub Container Registry access

---

## Step 1: Prepare Your Environment

### 1.1 Verify Kubernetes Cluster
```bash
# Check cluster access
kubectl cluster-info
kubectl get nodes

# Check current context
kubectl config current-context
```

### 1.2 Clone Repository
```bash
git clone https://github.com/bshah1914/aws-cost-management-dashboard.git
cd aws-cost-management-dashboard
chmod +x scripts/*.sh
```

### 1.3 Create GitHub Personal Access Token
1. Go to GitHub Settings → Developer settings → Personal access tokens (classic)
2. Click "Generate new token"
3. Name: `ghcr-token`
4. Scopes: Select `write:packages`, `read:packages`, `delete:packages`
5. Copy the token (save it securely)

---

## Step 2: Kubernetes Setup

### 2.1 Set Up Secrets and ConfigMaps
```bash
# Set environment variable
export NAMESPACE=staging  # or production

# Create namespace and secrets
./scripts/setup-k8s.sh staging <your-github-token>

# For production
./scripts/setup-k8s.sh production <your-github-token>
```

### 2.2 Update Secrets with Actual Values
```bash
# Edit staging secrets
kubectl edit secret app-secrets -n staging

# Or edit production secrets
kubectl edit secret app-secrets -n production
```

Update these values:
- `DB_USER`, `DB_PASSWORD`: Database credentials
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `AWS_REGION`: Your AWS region (e.g., us-east-1)
- `SECRET_KEY`, `JWT_SECRET`: Generate new secure keys
- `DATABASE_URL`: Your database connection string

**Generate Secure Keys:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Step 3: Build and Push Docker Images

### 3.1 Login to GitHub Container Registry
```bash
# Replace with your token
export CR_TOKEN=<your-github-token>
echo $CR_TOKEN | docker login ghcr.io -u bshah1914 --password-stdin
```

### 3.2 Build Images Locally
```bash
# Build backend
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 -f backend/Dockerfile backend/

# Build frontend
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0 -f frontend/Dockerfile frontend/

# Also tag as latest
docker tag ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 ghcr.io/bshah1914/aws-cost-dashboard-backend:latest
docker tag ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0 ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest
```

### 3.3 Push to Registry
```bash
# Push backend
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:latest

# Push frontend
docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0
docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest
```

---

## Step 4: Deploy to Kubernetes (Manual)

### 4.1 Deploy to Staging
```bash
./scripts/deploy.sh staging \
  ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 \
  ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0
```

### 4.2 Deploy to Production
```bash
./scripts/deploy.sh production \
  ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 \
  ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0
```

### 4.3 Verify Deployment
```bash
# Check pods
kubectl get pods -n staging
kubectl get pods -n production

# Check services
kubectl get svc -n staging
kubectl get svc -n production

# Get frontend URL (staging)
kubectl get svc frontend-dashboard -n staging -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Get frontend URL (production)
kubectl get svc frontend-dashboard -n production -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 4.4 View Logs
```bash
# Backend logs
kubectl logs -f deployment/backend-dashboard -n staging

# Frontend logs
kubectl logs -f deployment/frontend-dashboard -n staging
```

---

## Step 5: Jenkins Setup (Automated CI/CD)

### 5.1 Install Jenkins
```bash
# On your Jenkins server machine
./scripts/setup-jenkins.sh
```

### 5.2 Configure Jenkins

**Access Jenkins:**
```
http://<your-jenkins-server>:8080
```

**Initial Setup:**
1. Get admin password: `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`
2. Enter password and complete setup
3. Install suggested plugins

**Create Credentials:**

#### GitHub Container Registry Credentials
1. Go to "Manage Jenkins" → "Manage Credentials"
2. Click "Global" (under Stores)
3. Click "Add Credentials"
4. Kind: `Username with password`
5. Username: `bshah1914`
6. Password: `<your-github-token>`
7. ID: `github-container-registry`

#### Kubeconfig Secret
1. "Add Credentials" → Kind: `Secret file`
2. File: Upload your `kubeconfig` file
3. ID: `kubeconfig-aws-cost-management`

### 5.3 Create Jenkins Pipeline Job

1. Jenkins Home → "New Item"
2. Name: `aws-cost-dashboard`
3. Type: `Pipeline`
4. Click OK
5. Under "Pipeline":
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: `https://github.com/bshah1914/aws-cost-management-dashboard.git`
   - Credentials: GitHub credentials (or public)
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
6. Save

### 5.4 Build and Deploy

1. Click "Build with Parameters"
2. Select environment: `staging` or `production`
3. Click "Build"
4. Monitor progress in "Console Output"

---

## Directory Structure

```
aws-cost-management-dashboard/
├── Jenkinsfile              # Jenkins pipeline configuration
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── k8s/                     # Kubernetes manifests
│   ├── namespace.yaml       # Shared - defines namespace
│   ├── configmap.yaml       # Shared - app config
│   ├── secrets.yaml         # Shared - sensitive data
│   ├── staging/
│   │   ├── backend-deployment.yaml
│   │   ├── backend-service.yaml
│   │   ├── frontend-deployment.yaml
│   │   └── frontend-service.yaml
│   └── production/
│       ├── backend-deployment.yaml
│       ├── backend-service.yaml
│       ├── frontend-deployment.yaml
│       └── frontend-service.yaml
└── scripts/                 # Helper scripts
    ├── setup-k8s.sh        # Initialize K8s namespaces
    ├── setup-jenkins.sh    # Install Jenkins
    └── deploy.sh           # Manual deployment script
```

---

## Environment Variables & Secrets

### ConfigMap (configmap.yaml)
Non-sensitive configuration:
- `LOG_LEVEL`
- `FLASK_ENV`
- `APP_NAME`

### Secrets (secrets.yaml)
Sensitive data (update before deployment):
- **Database**: `DB_USER`, `DB_PASSWORD`, `DATABASE_URL`
- **AWS**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- **Auth**: `SECRET_KEY`, `JWT_SECRET`

**Update Secrets:**
```bash
kubectl edit secret app-secrets -n staging
# or
kubectl edit secret app-secrets -n production
```

---

## Scaling & Resource Management

### Staging Resources
- Backend: 2 replicas, 250m CPU, 256Mi memory request
- Frontend: 2 replicas, 100m CPU, 128Mi memory request

### Production Resources
- Backend: 3 replicas, 500m CPU, 512Mi memory request
- Frontend: 3 replicas, 200m CPU, 256Mi memory request
- Pod anti-affinity: Spread across nodes

### Adjust Resources
```bash
# Edit deployment
kubectl edit deployment backend-dashboard -n production

# Update resource requests/limits in the spec, then:
kubectl rollout status deployment/backend-dashboard -n production
```

---

## Health Checks & Monitoring

### Liveness & Readiness Probes

**Backend** (`/health` endpoint):
- Liveness: 30s initial delay, 10s period, fail after 3 attempts
- Readiness: 10s initial delay, 5s period, fail after 2 attempts

**Frontend**: Basic HTTP health check on `/`

### Manual Health Check
```bash
# Port-forward to backend
kubectl port-forward svc/backend-dashboard 8000:8000 -n staging

# Test health endpoint
curl http://localhost:8000/health

# Port-forward to frontend
kubectl port-forward svc/frontend-dashboard 3000:80 -n staging

# Test frontend
curl http://localhost:3000
```

---

## Troubleshooting

### Pods not starting
```bash
# Check pod status
kubectl describe pod <pod-name> -n staging

# View logs
kubectl logs <pod-name> -n staging

# Check events
kubectl get events -n staging --sort-by='.lastTimestamp'
```

### Image pull errors
```bash
# Verify secret exists
kubectl get secret ghcr-secret -n staging

# Check secret format
kubectl get secret ghcr-secret -n staging -o yaml

# Re-create secret if needed
kubectl delete secret ghcr-secret -n staging
./scripts/setup-k8s.sh staging <your-github-token>
```

### Database connection issues
```bash
# Check secrets
kubectl get secret app-secrets -n staging -o yaml | grep DATABASE_URL

# Test connection from pod
kubectl run -it --rm postgres-client --image=postgres --restart=Never -- \
  psql $(kubectl get secret app-secrets -n staging -o jsonpath='{.data.DATABASE_URL}' | base64 -d)
```

### Service not accessible
```bash
# Check service type
kubectl get svc -n staging

# Port-forward for testing
kubectl port-forward svc/frontend-dashboard 80:80 -n staging

# Check ingress (if using)
kubectl get ingress -n staging
```

---

## Cleanup

### Delete Staging Environment
```bash
kubectl delete namespace staging
```

### Delete Production Environment
```bash
kubectl delete namespace production
```

### Delete Everything
```bash
kubectl delete namespace staging production
```

---

## Advanced Setup

### Using Ingress (NGINX)
For production, replace LoadBalancer with ClusterIP + Ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dashboard-ingress
  namespace: production
spec:
  rules:
  - host: dashboard.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-dashboard
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-dashboard
            port:
              number: 8000
```

### Using PostgreSQL Helm Chart
```bash
# Add Helm repo
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install PostgreSQL
helm install postgres bitnami/postgresql \
  --namespace production \
  --set auth.username=admin \
  --set auth.password=<secure-password> \
  --set auth.database=cost_db
```

### CI/CD Enhancements
- Add SonarQube for code quality
- Add Slack notifications
- Add automated testing in pipeline
- Add security scanning (Trivy, Snyk)
- Add performance testing

---

## Security Best Practices

1. **Secrets Management**: Use tools like Sealed Secrets, Vault, or AWS Secrets Manager  
   ```bash
   # Install Sealed Secrets
   kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml
   ```

2. **Network Policies**: Restrict pod-to-pod communication
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: deny-all
     namespace: production
   spec:
     podSelector: {}
     policyTypes:
     - Ingress
     - Egress
   ```

3. **Pod Security**: Add security context
   ```yaml
   securityContext:
     runAsNonRoot: true
     runAsUser: 1000
     readOnlyRootFilesystem: true
   ```

4. **Image Scanning**: Scan images before deployment
   ```bash
   # Using Trivy
   trivy image ghcr.io/bshah1914/aws-cost-dashboard-backend:latest
   ```

---

## Support & Next Steps

1. Test locally with Docker Compose first
2. Deploy to staging for testing
3. Monitor logs and health checks
4. Validate with your team
5. Deploy to production with approval gate
6. Set up monitoring/alerting (Prometheus, Grafana)

Good luck with your deployment! 🚀
