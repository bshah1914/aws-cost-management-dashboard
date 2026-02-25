# AWS Cost Dashboard - Complete Deployment Guide

## ✅ Completed Setup

### Phase 1: AWS Backend Infrastructure ✓
```bash
✓ S3 Bucket: aws-cost-dashboard-terraform-state
  - Versioning: Enabled
  - Encryption: AES256
  - Public Access: Blocked

✓ DynamoDB Table: terraform-locks
  - Purpose: Terraform state file locking
  - Billing Mode: PAY_PER_REQUEST
```

### Phase 2: Docker Images ✓
```bash
✓ Backend Image: ghcr.io/bshah1914/aws-cost-dashboard-backend:latest (251MB)
  - FastAPI application
  - Python 3.11+ environment
  - Pushed to GitHub Container Registry

✓ Frontend Image: ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest (62.9MB)
  - React application with TypeScript
  - Nginx web server
  - Pushed to GitHub Container Registry
```

### Phase 3: Infrastructure as Code ✓
```bash
✓ Terraform Modules (terraform/modules/):
  - vpc/: Networking infrastructure
  - ecs/: Container orchestration (ECS Fargate)
  - alb/: Application Load Balancer
  - rds/: PostgreSQL database

✓ Environment Configurations:
  - terraform/environments/staging/: Testing environment
  - terraform/environments/production/: Production environment

✓ Terraform Variables:
  - terraform/environments/staging/terraform.tfvars (auto-generated)
  - terraform/environments/production/terraform.tfvars (auto-generated)
```

### Phase 4: Git Repository ✓
```bash
✓ GitHub Repository: https://github.com/bshah1914/aws-cost-management-dashboard.git
  - Main branch: Contains all code + infrastructure
  - 6 commits including infrastructure code
  - All documentation files committed
```

---

## 🚀 Manual Deployment Instructions

### Prerequisites
```bash
# Verify installations
terraform --version    # Should be >= 1.0
docker --version       # Should be >= 20.0
aws --version         # Should be available
git --version         # Should be available

# Set AWS credentials (from ~/.aws/credentials file)
export AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_KEY"
export AWS_DEFAULT_REGION="us-east-1"

# Verify AWS access
aws sts get-caller-identity
```

### Step 1: Initialize Terraform (Staging)
```bash
cd terraform/environments/staging

terraform init \
  -backend-config="bucket=aws-cost-dashboard-terraform-state" \
  -backend-config="key=staging/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=terraform-locks"
```

### Step 2: Plan Deployment
```bash
# Review what will be created
terraform plan -out=staging.tfplan -lock=false

# Output summary:
# - 1x VPC with 2 subnets (public + private per AZ)
# - 1x Application Load Balancer
# - 1x ECS Cluster with 2 services (backend + frontend)
# - 1x RDS PostgreSQL database (db.t3.micro)
# - 2x Security Groups (ALB + ECS)
# - CloudWatch log groups
# - Secrets Manager secret
```

### Step 3: Apply Deployment
```bash
# Deploy to AWS
terraform apply staging.tfplan -lock=false

# Expected output:
# Apply complete! Resources: XX added, 0 changed, 0 destroyed.
#
# Outputs:
#   alb_dns_name = "..."
#   backend_url = "..."
#   frontend_url = "..."
```

### Step 4: Verify Deployment
```bash
# Get outputs
terraform output

# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Wait for instances to be healthy (takes ~2 minutes)
sleep 120

# Test backend API
curl http://$ALB_DNS/api/health

# Test frontend
curl http://$ALB_DNS/ | head -20

# Check AWS Console
# - VPC Dashboard → See new VPC (10.0.0.0/16)
# - ECS Clusters → See "aws-cost-dashboard-staging" cluster
# - RDS Databases → See PostgreSQL database
# - Secrets Manager → See stored credentials
```

---

## 📊 Environment Specifications

### Staging Environment
- **VPC CIDR:** 10.0.0.0/16
- **Availability Zones:** 2 (us-east-1a, us-east-1b)
- **Backend ECS:** 1 task, 256 CPU, 512 MB memory
- **Frontend ECS:** 1 task, 256 CPU, 512 MB memory
- **Database:** db.t3.micro, 20GB storage, no Multi-AZ
- **Estimated Cost:** ~$75/month

### Production Environment
- **VPC CIDR:** 10.1.0.0/16
- **Availability Zones:** 3 (us-east-1a, us-east-1b, us-east-1c)
- **Backend ECS:** 3 tasks (auto-scaling 1-6), 512 CPU, 1024 MB memory each
- **Frontend ECS:** 3 tasks (auto-scaling 1-3), 256 CPU, 512 MB memory each
- **Database:** db.t3.small, 100GB storage, Multi-AZ enabled
- **Estimated Cost:** ~$200-300/month

---

## 🔧 Configuration Files

### terraform.tfvars (Auto-Generated)

**Staging** (`terraform/environments/staging/terraform.tfvars`):
```
aws_region = "us-east-1"
backend_image = "ghcr.io/bshah1914/aws-cost-dashboard-backend:latest"
frontend_image = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest"
db_password = "[AUTO-GENERATED-SECURE-PASSWORD]"
flask_secret_key = "[AUTO-GENERATED]"
jwt_secret_key = "[AUTO-GENERATED]"
```

**Production** (`terraform/environments/production/terraform.tfvars`):
```
Same as staging but with:
- Higher capacity (3x tasks with auto-scaling)
- Multi-AZ RDS database
- Larger storage allocations
```

---

## 🐛 Troubleshooting

### Issue: "Acquiring state lock" error
**Solution:** Remove stuck lock from DynamoDB
```bash
terraform force-unlock <LOCK-ID> -force
# Or run apply with -lock=false
terraform apply -lock=false
```

### Issue: "IAM role not found"
**Solution:** Verify AWS credentials and access
```bash
aws sts get-caller-identity
aws iam list-roles | head -5
```

### Issue: "Image not found" in ECS
**Solution:** Verify Docker images are pushed to GHCR
```bash
docker images | grep ghcr.io
# Or check in GitHub Container Registry UI
```

### Issue: Database connection errors
**Solution:** Check RDS security group allows traffic from ECS
```bash
# Verify in AWS Console:
# VPC → Security Groups → Find RDS SG → Check inbound rules
# Should allow 5432 from ECS security group
```

### Issue: ALB shows unhealthy targets
**Solution:** Wait 2-3 minutes for tasks to fully start and health checks
```bash
# Monitor in AWS Console:
# ECS → Clusters → aws-cost-dashboard-staging → Services
# Check task status and health check logs
```

---

## 📝 Deployment Checklist

- [x] AWS backend infrastructure created (S3 + DynamoDB)
- [x] Docker images built and pushed to GHCR
- [x] Terraform modules created (vpc, ecs, alb, rds)
- [x] Environment configurations created (staging + production)
- [x] terraform.tfvars files generated with secrets
- [ ] **terraform init** executed for staging
- [ ] **terraform plan** reviewed
- [ ] **terraform apply** completed successfully
- [ ] ALB DNS names obtained
- [ ] Backend API health check passing
- [ ] Frontend accessible via ALB
- [ ] Database connectivity verified
- [ ] Staging environment fully operational
- [ ] Production deployment (repeat steps for prod/)

---

## 📞 Next Steps

1. **Deploy Staging:**
   ```bash
   cd terraform/environments/staging
   terraform init -backend-config="bucket=aws-cost-dashboard-terraform-state" \
     -backend-config="key=staging/terraform.tfstate" \
     -backend-config="region=us-east-1" \
     -backend-config="dynamodb_table=terraform-locks"
   terraform plan -lock=false
   terraform apply -lock=false
   ```

2. **Test Staging Deployment:**
   - Get ALB DNS: `terraform output -raw alb_dns_name`
   - Test API: `curl http://<ALB-DNS>/api/health`
   - Test Frontend: `curl http://<ALB-DNS>/`

3. **Deploy Production** (after staging validation):
   - Repeat steps above from `terraform/environments/production/`
   - Verify high availability with 3 AZs
   - Enable Multi-AZ database
   - Set up monitoring and alarms

4. **Setup CI/CD (Optional):**
   - Configure Jenkins at http://localhost:8080
   - Install plugins: Pipeline, Git, Terraform, AWS, Docker
   - Create pipeline job pointing to `Jenkinsfile.terraform`
   - Configure GitHub webhooks for auto-deployment on commits

---

## 📚 Related Documentation

- [terraform/README.md](../../terraform/README.md) - Terraform module details
- [TERRAFORM_DEPLOYMENT.md](../../TERRAFORM_DEPLOYMENT.md) - Architecture & operations
- [JENKINS_LOCAL_SETUP.md](../../JENKINS_LOCAL_SETUP.md) - Jenkins configuration
- [QUICK_START.md](../../QUICK_START.md) - 6-phase deployment guide
- [Jenkinsfile.terraform](../../Jenkinsfile.terraform) - CI/CD pipeline definition

---

**Last Updated:** February 26, 2026
**Status:** Ready for Deployment
**Next Action:** Execute Step 1 (terraform init for staging)
