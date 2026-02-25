# Complete Deployment Quick Start Guide

## Prerequisites Check (2 minutes)

Verify everything is installed and configured:

```bash
# Check Docker
docker --version
# Expected: Docker version 20.10+

# Check AWS CLI
aws --version
# Expected: AWS CLI 2.x

# Check Terraform
terraform --version
# Expected: Terraform v1.0+

# Check Git
git --version
# Expected: git version 2.x

# Check Jenkins running
curl http://localhost:8080/ | head -20
# Expected: Jenkins page HTML
```

If any are missing, install them first.

---

## Phase 1: Setup AWS Backend (10 minutes)

### 1.1 Configure AWS Credentials

```bash
# Option A: Interactive setup
aws configure
# Enter:
# - AWS Access Key ID: YOUR_KEY
# - AWS Secret Access Key: YOUR_SECRET
# - Default region: us-east-1
# - Default output format: json

# Option B: Export as environment variables
export AWS_ACCESS_KEY_ID="YOUR_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET"
export AWS_DEFAULT_REGION="us-east-1"

# Verify AWS access
aws sts get-caller-identity
# Should return your AWS account ID and user ARN
```

### 1.2 Create Terraform Backend Infrastructure

```bash
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main

# Make script executable
chmod +x scripts/setup-terraform-backend.sh

# Run the setup
./scripts/setup-terraform-backend.sh us-east-1

# Expected output:
# ✓ Terraform backend setup complete!
# S3 bucket: aws-cost-dashboard-terraform-state
# DynamoDB table: terraform-locks
```

✅ **Checkpoint:** Backend created in AWS (S3 + DynamoDB)

---

## Phase 2: Build and Push Docker Images (15 minutes)

### 2.1 Login to GitHub Container Registry

```bash
# Generate GitHub Personal Access Token if you don't have one:
# GitHub > Settings > Developer settings > Personal access tokens (classic)
# Scopes needed: write:packages, read:packages

# Login to registry
export CR_TOKEN="ghp_xxxxxxxxxxxxx"  # Your token
echo $CR_TOKEN | docker login ghcr.io -u bshah1914 --password-stdin

# Verify login
docker pull ghcr.io/bshah1914/aws-cost-dashboard-backend:latest 2>&1 | head -5
```

### 2.2 Build Backend Docker Image

```bash
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main

echo "Building backend image..."
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-backend:latest \
  -f backend/Dockerfile backend/

# Verify build succeeded
docker images | grep aws-cost-dashboard-backend
```

### 2.3 Build Frontend Docker Image

```bash
echo "Building frontend image..."
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest \
  -f frontend/Dockerfile frontend/

# Verify build
docker images | grep aws-cost-dashboard-frontend
```

### 2.4 Push Images to GitHub Registry

```bash
echo "Pushing backend image..."
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:latest

echo "Pushing frontend image..."
docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest

# Verify pushes (should see "Pushed to registry")
echo "✓ Both images pushed successfully"
```

✅ **Checkpoint:** Docker images in GitHub Container Registry

---

## Phase 3: Configure Jenkins (20 minutes)

### 3.1 Open Jenkins Dashboard

```bash
# Open in browser
http://localhost:8080/

# If you need the initial admin password:
cat /var/lib/jenkins/secrets/initialAdminPassword
# (paste in Jenkins UI if first time setup)
```

### 3.2 Install Required Plugins

1. **Dashboard**: Manage Jenkins > **Manage Plugins**
2. **Search and Install** (check boxes, then "Install without restart"):
   - `Pipeline`
   - `Git`
   - `Terraform`
   - `AWS Steps`
   - `CloudBees Docker Build and Publish`
   - `AnsiColor`
   - `Log Parser`
3. **Restart Jenkins** when all installed

**After restart:**
```bash
# Verify Jenkins is back up
curl http://localhost:8080/ | grep -i jenkins
```

### 3.3 Add Credentials to Jenkins

**GitHub Container Registry:**
1. Dashboard > **Manage Credentials** > **Global** > **Add Credentials**
2. Fill in:
   - Kind: `Username with password`
   - Username: `bshah1914`
   - Password: `ghp_xxxxxxxxxxxxx` (your GitHub token)
   - ID: `github-container-registry`
   - Description: `GitHub Container Registry`
3. Click **Create**

**AWS Credentials:**
1. **Add Credentials** again
2. Fill in:
   - Kind: `AWS Credentials`
   - Access Key ID: `AKIA...` (from aws configure)
   - Secret Access Key: (corresponding secret)
   - ID: `aws-credentials`
   - Description: `AWS Account Access`
3. Click **Create**

### 3.4 Create Pipeline Job

1. Dashboard > **New Item**
2. Enter name: `aws-cost-dashboard-terraform`
3. Select: **Pipeline**
4. Click **OK**

**Configure:**

**General Tab:**
- Description: "AWS Cost Dashboard Terraform ECS Fargate deployment"
- ☑ Execute concurrent builds if necessary

**Build Triggers Tab:**
- ☑ GitHub hook trigger for GITScm polling

**Advanced Project Options Tab:**
- Display Name: (leave as is)

**Pipeline Tab:**
- Definition: **Pipeline script from SCM**
- SCM: **Git**
  - Repository URL: `https://github.com/bshah1914/aws-cost-management-dashboard.git`
  - Credentials: (select your GitHub credentials, or leave blank for public)
  - Branch: `*/main`
  - Script Path: `Jenkinsfile.terraform`

5. Click **Save**

✅ **Checkpoint:** Jenkins pipeline job created

---

## Phase 4: Create Terraform Configuration (10 minutes)

### 4.1 Create Staging Variables File

```bash
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main/terraform/environments/staging

# Copy example
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
cat > terraform.tfvars << 'EOF'
aws_region             = "us-east-1"
project_name           = "aws-cost-dashboard"
environment            = "staging"
backend_image          = "ghcr.io/bshah1914/aws-cost-dashboard-backend:latest"
frontend_image         = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest"
db_password            = "Staging@123456789"
db_username            = "dbadmin"
db_name                = "costdb"
aws_access_key_id      = "AKIA..." # (from aws sts get-caller-identity)
aws_secret_access_key  = "..." # (your secret key)
flask_secret_key       = "staging-secret-key-change-in-production"
jwt_secret             = "staging-jwt-secret-change-in-production"
EOF

echo "✓ Staging terraform.tfvars created"
```

### 4.2 Add to Git

```bash
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main

git add terraform/environments/staging/terraform.tfvars
git commit -m "Add staging Terraform configuration"
git push origin main

echo "✓ Configuration pushed to GitHub"
```

✅ **Checkpoint:** Terraform variables configured

---

## Phase 5: Deploy to Staging (First Deployment) (30-40 minutes)

### 5.1 Trigger Plan (Dry Run)

```bash
# Open Jenkins
http://localhost:8080/job/aws-cost-dashboard-terraform

# Click: "Build with Parameters"

# Select:
# - ACTION: plan
# - ENVIRONMENT: staging
# - BUILD_IMAGES: false
# - IMAGE_TAG: latest

# Click: "Build"
```

**Monitor Console Output:**
1. Click build number (e.g., #1)
2. Click **Console Output**
3. Watch for:
   ```
   + Checkout
   + Validate Terraform
   + Terraform Plan
   ✓ Plan completed successfully
   ```

**Expected duration:** 2-3 minutes

**Review the Plan:**
- Should show all resources to be created
- No errors
- Shows number of resources to create

### 5.2 Trigger Apply (Actual Deployment)

```bash
# Go back to Jenkins job
# Click: "Build with Parameters"

# Select:
# - ACTION: apply
# - ENVIRONMENT: staging
# - BUILD_IMAGES: true  # First run, build images
# - IMAGE_TAG: latest

# Click: "Build"
```

**Monitor Progress:**
1. Click build number
2. Click **Console Output**
3. Watch for stages:
   ```
   [Stage 1] Checkout
   [Stage 2] Build Backend Image
   [Stage 3] Build Frontend Image
   [Stage 4] Push to Registry
   [Stage 5] Terraform Plan
   [Stage 6] Terraform Apply
   ✓ Terraform apply completed successfully for staging
   ```

**Expected duration:** 15-20 minutes (first deployment is slowest)

### 5.3 Get Access URL

When complete, Jenkins will show outputs:

```
=== Deployment Outputs ===
access_url = "http://aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"
alb_dns_name = "aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"
ecs_cluster_name = "aws-cost-dashboard-cluster-staging"
rds_endpoint = "aws-cost-dashboard-db-staging.xxxxx.us-east-1.rds.amazonaws.com:5432"
```

### 5.4 Verify Deployment

```bash
# Get the ALB URL
ALB_URL="http://aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"

# Test the application
curl $ALB_URL

# You should get HTML response (frontend)

# Test the API health endpoint
curl $ALB_URL/api/health

# You should get JSON: {"status":"ok","version":"1.0.0"}

# Check ECS services
aws ecs list-services --cluster aws-cost-dashboard-cluster-staging

# Check RDS
aws rds describe-db-instances --db-instance-identifier aws-cost-dashboard-db-staging
```

✅ **Checkpoint:** Staging deployment successful!

---

## Phase 6: Deploy to Production (When Ready)

### 6.1 Create Production Variables

```bash
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main/terraform/environments/production

# Copy example
cp terraform.tfvars.example terraform.tfvars

# Edit with production values (DIFFERENT from staging!)
cat > terraform.tfvars << 'EOF'
aws_region             = "us-east-1"
project_name           = "aws-cost-dashboard"
environment            = "production"
cost_center            = "engineering"
backend_image          = "ghcr.io/bshah1914/aws-cost-dashboard-backend:v1.0.0"
frontend_image         = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:v1.0.0"
db_password            = "Production@Secure123456789"
db_username            = "dbadmin"
db_name                = "costdb"
aws_access_key_id      = "AKIA..."
aws_secret_access_key  = "..."
flask_secret_key       = "production-secret-key-DIFFERENT"
jwt_secret             = "production-jwt-secret-DIFFERENT"
alarm_topic_arn        = "arn:aws:sns:us-east-1:ACCOUNT_ID:topic-name"
EOF

echo "✓ Production terraform.tfvars created"
```

### 6.2 Push to Git

```bash
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main

git add terraform/environments/production/terraform.tfvars
git commit -m "Add production Terraform configuration"
git push origin main
```

### 6.3 Deploy (with Approval)

```bash
# Open Jenkins
http://localhost:8080/job/aws-cost-dashboard-terraform

# Click: "Build with Parameters"

# Select:
# - ACTION: apply
# - ENVIRONMENT: production
# - BUILD_IMAGES: true
# - IMAGE_TAG: v1.0.0  (use version, not latest)

# Click: "Build"
```

**Jenkins will require approval:**
```
[APPROVAL GATE]
Apply Terraform to PRODUCTION?
[Approve]  [Reject]
```

1. Review the Terraform plan
2. Click **Approve**
3. Monitor deployment

**Expected duration:** 20-25 minutes

✅ **Checkpoint:** Production deployment live!

---

## Complete Workflow Summary

| Step | Tool | Command/Action | Time |
|------|------|----------------|------|
| 1 | AWS | `aws configure` | 1 min |
| 2 | Bash | `./scripts/setup-terraform-backend.sh` | 3 min |
| 3 | Docker | Build & push images | 12 min |
| 4 | Jenkins | Install plugins | 5 min |
| 5 | Jenkins | Add credentials | 3 min |
| 6 | Jenkins | Create pipeline job | 5 min |
| 7 | Bash | Create terraform.tfvars | 2 min |
| 8 | Jenkins | Plan staging | 3 min |
| 9 | Jenkins | Apply staging | 18 min |
| 10 | AWS/Curl | Verify deployment | 2 min |
| **Total for Staging** |  |  | **55 minutes** |
| 11 | Bash | Create production config | 2 min |
| 12 | Jenkins | Plan production | 3 min |
| 13 | Jenkins | Apply production | 20 min |
| **Total for Prod** |  |  | **25 minutes** |

---

## Troubleshooting During Deployment

### Docker Build Fails
```bash
# Check Docker daemon
docker ps

# Check disk space
df -h

# Check logs
docker logs $(docker ps -a | grep aws-cost | head -1 | awk '{print $1}')
```

### Jenkins Job Fails
1. Click job > Console Output
2. Look for red error messages
3. Common issues:
   - Missing credentials: Go to Manage Credentials
   - Terraform not found: Install on Jenkins server
   - AWS auth failed: Check AWS credentials

### Terraform Fails
```bash
# Check state lock
aws dynamodb scan --table-name terraform-locks

# Check S3 backend
aws s3 ls aws-cost-dashboard-terraform-state/

# View Terraform logs in Jenkins console
# Search for "Error:" in console output
```

### ECS Tasks Not Starting
```bash
# Check task status
aws ecs describe-tasks \
  --cluster aws-cost-dashboard-cluster-staging \
  --tasks $(aws ecs list-tasks \
    --cluster aws-cost-dashboard-cluster-staging \
    --query 'taskArns[0]' --output text)

# Check CloudWatch logs
aws logs tail /ecs/aws-cost-dashboard-backend-staging --follow
```

### ALB Health Checks Failing
```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names aws-cost-dashboard-backend-tg-staging \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

# Test backend directly (inside same VPC)
curl http://BACKEND_IP:8000/api/health
```

---

## What Gets Created

### Staging Environment
- VPC (2 availability zones)
- 2 public subnets, 2 private subnets
- Internet Gateway, NAT Gateways
- Security groups (ALB, ECS, RDS)
- Application Load Balancer
- ECS Cluster with auto-scaling
  - Backend service (1-2 tasks)
  - Frontend service (1-2 tasks)
- RDS PostgreSQL (db.t3.micro)
- CloudWatch Log Groups
- CloudWatch Alarms (monitoring)

**Estimated Cost:** $75-100/month

### Production Environment
- VPC (3 availability zones - high availability)
- 3 public subnets, 3 private subnets
- Multiple NAT Gateways (redundancy)
- Security groups optimized
- Application Load Balancer
- ECS Cluster with auto-scaling
  - Backend service (3-6 tasks)
  - Frontend service (3-6 tasks)
- RDS PostgreSQL Multi-AZ (db.t3.small)
- CloudWatch Logs + Alarms
- S3 for ALB access logs

**Estimated Cost:** $200-300/month

---

## Next: Monitor Your Deployment

### Access Application
```bash
# Get ALB URL
ALB_URL=$(aws elbv2 describe-load-balancers \
  --names aws-cost-alb-staging \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "Access: http://$ALB_URL"

# Open in browser
open "http://$ALB_URL"
```

### Monitor with CloudWatch
```bash
# View backend logs
aws logs tail /ecs/aws-cost-dashboard-backend-staging --follow

# View frontend logs
aws logs tail /ecs/aws-cost-dashboard-frontend-staging --follow

# View database logs
aws logs tail /aws/rds/instance/aws-cost-dashboard-db-staging/postgresql --follow
```

### Check Health
```bash
# Every 60 seconds, check all services
while true; do
  echo "=== $(date) ==="
  aws ecs describe-services \
    --cluster aws-cost-dashboard-cluster-staging \
    --services aws-cost-dashboard-backend-service-staging \
    --query 'services[0].[desiredCount,runningCount,deployments[0].desiredCount]' \
    --output text
  sleep 60
done
```

---

## After Deployment

### Update Application
```bash
# Make code changes
git commit -am "Update backend code"
git push origin main

# Rebuild and deploy
# Jenkins > aws-cost-dashboard-terraform > Build with Parameters
# - ACTION: apply
# - ENVIRONMENT: staging
# - BUILD_IMAGES: true
# - IMAGE_TAG: latest
```

### Scale Services
```bash
# Manually scale (if auto-scaling not sufficient)
aws ecs update-service \
  --cluster aws-cost-dashboard-cluster-staging \
  --service aws-cost-dashboard-backend-service-staging \
  --desired-count 4
```

### Destroy When Done (Cost Optimization)
```bash
# Jenkins > Build with Parameters
# - ACTION: destroy
# - ENVIRONMENT: staging
# This will delete all AWS resources (⚠️ careful with production!)
```

---

## Key Files Reference

```
Project Root/
├── Jenkinsfile.terraform           # Pipeline definition (Jenkins uses this)
├── JENKINS_LOCAL_SETUP.md          # Detailed Jenkins configuration
├── TERRAFORM_DEPLOYMENT.md         # Detailed Terraform guide
├── terraform/
│   ├── modules/                    # Reusable infrastructure modules
│   │   ├── vpc/
│   │   ├── ecs/
│   │   ├── alb/
│   │   └── rds/
│   └── environments/
│       ├── staging/                # Staging configuration
│       └── production/             # Production configuration
└── scripts/
    ├── setup-terraform-backend.sh  # Initialize backend
    └── terraform-deploy.sh         # Manual deployment (alternative to Jenkins)
```

---

## Done! 🎉

Your AWS Cost Management Dashboard is now:
- ✅ Built and containerized
- ✅ Stored in GitHub Container Registry
- ✅ Managed by Terraform IaC
- ✅ Automated with Jenkins CI/CD
- ✅ Deployed to AWS ECS Fargate
- ✅ Monitored with CloudWatch
- ✅ Load-balanced for scalability
- ✅ Database-backed with RDS

**Access your application:**
```
http://aws-cost-alb-staging.us-east-1.elb.amazonaws.com
```

Questions? Review the detailed guides:
- JENKINS_LOCAL_SETUP.md (Jenkins specific)
- TERRAFORM_DEPLOYMENT.md (Infrastructure specific)

Happy deploying! 🚀
