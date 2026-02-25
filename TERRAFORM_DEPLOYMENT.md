# AWS ECS Fargate Deployment with Terraform

## Overview

This guide covers deploying the AWS Cost Management Dashboard to AWS ECS Fargate using Terraform Infrastructure as Code (IaC).

**Architecture:**
- **Compute**: AWS ECS Fargate (serverless containers)
- **Load Balancing**: Application Load Balancer (ALB)
- **Database**: AWS RDS PostgreSQL
- **Registry**: GitHub Container Registry (ghcr.io)
- **IaC**: Terraform with modular design
- **State Management**: S3 + DynamoDB
- **Environments**: Staging & Production with separate configurations

---

## Prerequisites

### Required Tools
- **Terraform** 1.0+ ([Install](https://www.terraform.io/downloads.html))
- **AWS CLI** v2 ([Install](https://aws.amazon.com/cli/))
- **Docker** (for building images)
- **Git** (for version control)
- **jq** (optional, for JSON parsing)

### Required AWS Credentials
- AWS Account with appropriate permissions
- AWS Access Key ID & Secret Access Key
- Or AWS CLI configured with credentials

### AWS IAM Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "elasticloadbalancing:*",
        "rds:*",
        "logs:*",
        "secretsmanager:*",
        "iam:*",
        "cloudwatch:*",
        "s3:*",
        "dynamodb:*"
      ],
      "Resource": "*"
    }
  ]
}
```

Or use the AWS managed policy: `PowerUserAccess` for simplified setup.

---

## Step 1: Configure AWS Credentials

### Option A: AWS CLI Configuration
```bash
aws configure
# Enter:
# AWS Access Key ID
# AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### Option B: Environment Variables
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### Option C: Jenkins (for CI/CD)
Add Jenkins credentials:
1. Jenkins → Manage Credentials
2. Add AWS credentials with ID: `aws-credentials`

---

## Step 2: Set Up Terraform Backend

S3 + DynamoDB backend ensures secure state management and team collaboration.

```bash
# Create S3 bucket and DynamoDB table for state
chmod +x scripts/setup-terraform-backend.sh
./scripts/setup-terraform-backend.sh us-east-1
```

This creates:
- S3 bucket: `aws-cost-dashboard-terraform-state`
- DynamoDB table: `terraform-locks`
- Encryption enabled
- Versioning enabled
- Public access blocked

---

## Step 3: Build and Push Docker Images

### 3.1 Configure Container Registry Access
```bash
# GitHub Container Registry token
export CR_TOKEN="ghp_xxxxxxxxxxxxx"
echo $CR_TOKEN | docker login ghcr.io -u bshah1914 --password-stdin
```

### 3.2 Build and Push Images
```bash
# Build images
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 -f backend/Dockerfile backend/
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0 -f frontend/Dockerfile frontend/

# Tag as latest
docker tag ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0 ghcr.io/bshah1914/aws-cost-dashboard-backend:latest
docker tag ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0 ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest

# Push images
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:latest
docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0
docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest
```

---

## Step 4: Configure Terraform Variables

### 4.1 Staging Environment
```bash
cd terraform/environments/staging

# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required values for staging:**
```hcl
aws_region          = "us-east-1"
backend_image       = "ghcr.io/bshah1914/aws-cost-dashboard-backend:1.0"
frontend_image      = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:1.0"
db_password         = "SecurePassword123!"
aws_access_key_id   = "your-aws-key"
aws_secret_access_key = "your-aws-secret"
flask_secret_key    = "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
jwt_secret          = "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
```

### 4.2 Production Environment
```bash
cd terraform/environments/production

# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Additional production requirements:**
```hcl
# Production needs higher capacity, different secrets, and alarm topic
alarm_topic_arn = "arn:aws:sns:us-east-1:ACCOUNT_ID:your-alarm-topic"
cost_center     = "engineering"
```

**Generate secure secrets:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Step 5: Deploy to Staging

### Option A: Manual Terraform Commands
```bash
cd terraform/environments/staging

# Initialize (first time only)
terraform init

# Format and validate
terraform fmt -recursive ..
terraform validate

# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# View outputs
terraform output
```

### Option B: Using Helper Script
```bash
chmod +x scripts/terraform-deploy.sh
./scripts/terraform-deploy.sh staging apply us-east-1
```

### Deployment Output
After successful deployment, you'll get:
```
Outputs:

access_url = "http://aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"
alb_dns_name = "aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"
ecs_cluster_name = "aws-cost-dashboard-cluster-staging"
rds_endpoint = "aws-cost-dashboard-db-staging.xxxxx.us-east-1.rds.amazonaws.com:5432"
```

### Verify Deployment
```bash
# Check ECS services
aws ecs list-services --cluster aws-cost-dashboard-cluster-staging

# Check RDS
aws rds describe-db-instances --db-instance-identifier aws-cost-dashboard-db-staging

# Test ALB
curl http://$(terraform output -raw alb_dns_name)
```

---

## Step 6: Deploy to Production

⚠️ **Production requires manual approval and special care.**

### 6.1 Prepare Production Configuration
```bash
cd terraform/environments/production

# Create terraform.tfvars with production values
cp terraform.tfvars.example terraform.tfvars

# Update with production secrets and higher capacity
nano terraform.tfvars
```

### 6.2 Plan Production Deployment
```bash
terraform plan -out=tfplan
# Review the plan carefully
```

### 6.3 Apply Production Deployment
```bash
# This will require manual confirmation
terraform apply tfplan

# Monitor CloudWatch logs
aws logs tail /ecs/aws-cost-dashboard-backend-production --follow

# Monitor ECS services
aws ecs describe-services \
  --cluster aws-cost-dashboard-cluster-production \
  --services aws-cost-dashboard-backend-service-production aws-cost-dashboard-frontend-service-production
```

---

## Jenkins CI/CD Pipeline (Automated Deployment)

### 7.1 Configure Jenkins Job

**Create Pipeline Job:**
1. Jenkins > New Item
2. Name: `aws-cost-dashboard-terraform`
3. Type: Pipeline
4. Click OK

**Configure Pipeline:**
1. Pipeline script from SCM
2. SCM: Git
3. Repository: `https://github.com/bshah1914/aws-cost-management-dashboard.git`
4. Script Path: `Jenkinsfile.terraform`

### 7.2 Add Credentials in Jenkins

**GitHub Container Registry:**
1. Manage Credentials > Global > Add Credentials
2. Kind: Username with password
3. Username: `bshah1914`
4. Password: `<github-token>`
5. ID: `github-container-registry`

**AWS Credentials:**
1. Add Credentials
2. Kind: AWS Credentials
3. Access Key ID: `<your-aws-key>`
4. Secret Access Key: `<your-aws-secret>`
5. ID: `aws-credentials`

### 7.3 Trigger Pipeline

**Build Parameters:**
- **ACTION**: plan, apply, or destroy
- **ENVIRONMENT**: staging or production
- **BUILD_IMAGES**: true/false (build Docker images)
- **IMAGE_TAG**: latest, or commit hash for prod

**Examples:**
```bash
# Plan staging deployment
ACTION=plan, ENVIRONMENT=staging, BUILD_IMAGES=true

# Apply to production (with approval)
ACTION=apply, ENVIRONMENT=production, BUILD_IMAGES=true, IMAGE_TAG=v1.0.0

# Destroy staging (cleanup)
ACTION=destroy, ENVIRONMENT=staging
```

---

## Terraform Modules Overview

### Module Structure
```
terraform/
├── modules/
│   ├── vpc/           # Networking (VPC, subnets, NAT)
│   ├── ecs/           # ECS cluster, task definitions, services
│   ├── alb/           # Application Load Balancer
│   └── rds/           # RDS PostgreSQL database
└── environments/
    ├── staging/       # Staging configuration
    └── production/    # Production configuration
```

### VPC Module
- Creates VPC with public/private subnets (2 AZs per env)
- Sets up Internet Gateway and NAT Gateways
- Enables VPC Flow Logs for monitoring
- Production: 3 AZs (high availability)

### ECS Module
- Creates ECS Fargate cluster
- Defines task definitions for backend and frontend
- Creates ECS services with load balancer integration
- Auto-scaling based on CPU utilization (70% target)
- CloudWatch logs integration
- Health checks configured

### ALB Module
- Application Load Balancer for public access
- Target groups for backend (port 8000) and frontend (port 80)
- Path-based routing: `/api*` → backend, `/` → frontend
- Health checks configured
- S3 access logs enabled

### RDS Module
- PostgreSQL 15 database
- Multi-AZ for production (single AZ for staging)
- Automated backups (7 days staging, 30 days production)
- CloudWatch logs for PostgreSQL
- Secrets Manager integration for credentials
- Enhanced monitoring enabled

---

## Environment Differences

| Feature | Staging | Production |
|---------|---------|-----------|
| ECS Subnets | 2 AZs | 3 AZs |
| Backend Replicas | 1-2 | 3-6 |
| Frontend Replicas | 1-2 | 3-6 |
| Backend CPU | 512m | 1024m |
| Backend Memory | 1GB | 2GB |
| RDS Instance | db.t3.micro | db.t3.small |
| RDS Storage | 20GB | 100GB |
| RDS Multi-AZ | No | Yes |
| Backup Retention | 7 days | 30 days |
| Deletion Protection | No | Yes |
| CloudWatch Alarms | None | Critical (SNS) |

---

## Common Operations

### View Infrastructure
```bash
# Show all outputs
terraform output

# Show specific output
terraform output alb_dns_name

# View state file
terraform state list
terraform state show aws_ecs_service.backend
```

### Scale Services
```bash
# Manually scale
aws ecs update-service \
  --cluster aws-cost-dashboard-cluster-staging \
  --service aws-cost-dashboard-backend-service-staging \
  --desired-count 3
```

### View Logs
```bash
# Backend logs
aws logs tail /ecs/aws-cost-dashboard-backend-staging --follow

# Frontend logs
aws logs tail /ecs/aws-cost-dashboard-frontend-staging --follow

# RDS logs
aws logs tail /aws/rds/instance/aws-cost-dashboard-db-staging/postgresql --follow
```

### Update Configuration
```bash
# Modify terraform.tfvars
nano terraform/environments/staging/terraform.tfvars

# Apply changes
terraform apply

# Or for multiple changes:
terraform plan -out=tfplan
terraform apply tfplan
```

### Backup and Restore Database
```bash
# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier aws-cost-dashboard-db-staging \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d)

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier aws-cost-dashboard-db-staging
```

---

## Updating Application

### Update Backend Image
```bash
# Build, push, and deploy
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-backend:1.1 -f backend/Dockerfile backend/
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:1.1

# Update terraform variables
cd terraform/environments/staging
echo 'backend_image = "ghcr.io/bshah1914/aws-cost-dashboard-backend:1.1"' >> terraform.tfvars

# Deploy
terraform apply
```

### Blue-Green Deployment (Safe Updates)
```bash
# Create new task definition (Terraform will do this)
# ALB automatically routes traffic to new tasks
# Old tasks are drained (no new connections)
# Automatic rollback on health check failure
```

---

## Monitoring and Alerts

### CloudWatch Dashboards
```bash
# Create custom dashboard in AWS Console:
# 1. CloudWatch > Dashboards > Create Dashboard
# 2. Add metrics for:
#    - ALB request count & target health
#    - ECS CPU/Memory utilization
#    - RDS CPU/storage/connections
#    - Application error rates
```

### Alarms (Production Only)
Configured alarms:
- ALB unhealthy targets
- ECS backend CPU > 80%
- RDS CPU > 75%
- RDS storage < 10GB

View alarms:
```bash
aws cloudwatch describe-alarms --alarm-names '*aws-cost-dashboard*'
```

### Application Logs
```bash
# View combined logs
aws logs filter-log-events \
  --log-group-name /ecs/aws-cost-dashboard-backend-staging \
  --start-time $(date -d '1 hour ago' +%s)000

# Query with CloudWatch Insights
aws logs start-query \
  --log-group-name /ecs/aws-cost-dashboard-backend-staging \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

---

## Troubleshooting

### ECS Tasks Not Starting
```bash
# Check task status
aws ecs describe-tasks \
  --cluster aws-cost-dashboard-cluster-staging \
  --tasks $(aws ecs list-tasks \
    --cluster aws-cost-dashboard-cluster-staging \
    --query 'taskArns[0]' --output text)

# Check logs
aws logs describe-log-streams \
  --log-group-name /ecs/aws-cost-dashboard-backend-staging

# View detailed errors
aws ecs describe-services \
  --cluster aws-cost-dashboard-cluster-staging \
  --services aws-cost-dashboard-backend-service-staging
```

### Database Connection Issues
```bash
# Test RDS connection
psql -h $(terraform output -raw rds_endpoint | cut -d: -f1) \
     -U dbadmin \
     -d costdb

# Check security group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*rds*"

# View RDS logs
aws logs tail /aws/rds/instance/aws-cost-dashboard-db-staging/postgresql --follow
```

### ALB Health Checks Failing
```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --load-balancer-arn $(aws elbv2 describe-load-balancers \
      --names aws-cost-alb-staging \
      --query 'LoadBalancers[0].LoadBalancerArn' \
      --output text) \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# Test endpoint directly
curl -v http://CONTAINER_IP:8000/api/health
```

### Terraform State Lock
```bash
# If terraform hangs due to state lock
aws dynamodb describe-table --table-name terraform-locks

# Force unlock (careful!)
aws dynamodb delete-item \
  --table-name terraform-locks \
  --key '{"LockID":{"S":"aws-cost-dashboard/staging"}}'
```

---

## Cost Optimization

### What You're Paying For:
- **ECS Fargate**: Per vCPU-hour and memory-hour
- **ALB**: Per LB-hour + request count
- **RDS**: Per DB instance-hour + storage
- **NAT Gateway**: Per processed GB (most expensive for outbound traffic)
- **Data Transfer**: Between services in different AZs

### Cost Reduction Tips:
1. **Staging**: Use smallest instances
   - Backend: 512m CPU, 1GB RAM
   - Frontend: 256m CPU, 512MB RAM
   - RDS: db.t3.micro, burstable

2. **Production**: Right-size based on metrics
   - Monitor CloudWatch for 4 weeks
   - Adjust based on actual usage
   - Consider reserved capacity for predictable loads

3. **Network Optimization**:
   - Use VPC endpoints for AWS services (instead of NAT Gateway)
   - NAT Gateway is most expensive; minimize outbound traffic

4. **Data Transfer**:
   - Same AZ is free
   - Cross-AZ costs ~$0.01/GB
   - Cross-region is more expensive

### Estimate Monthly Costs:
```
Staging (baseline):
- ECS: ~$40/month
- ALB: ~$20/month
- RDS: ~$10/month
- Data transfer: ~$5/month
Total: ~$75/month

Production (3x capacity):
- ECS: ~$120/month
- ALB: ~$20/month
- RDS: ~$50/month (small instance)
- Data transfer: ~$15/month
Total: ~$205/month
```

Use AWS Pricing Calculator for accurate estimates.

---

## Security Best Practices

1. **Secrets Management**:
   - Store in Secrets Manager (not in code)
   - Rotate keys regularly
   - Limit IAM access to Secrets Manager

2. **Network Security**:
   - Use security groups (firewall)
   - Private subnets for ECS/RDS
   - Public ALB only for frontend

3. **IAM**:
   - Use least-privilege permissions
   - Service roles for ECS tasks
   - Regular credential rotation

4. **Encryption**:
   - EBS encryption enabled
   - RDS encryption enabled (at rest and in-flight)
   - S3 bucket encryption for Terraform state

5. **Monitoring**:
   - CloudWatch Logs for all services
   - VPC Flow Logs for network traffic
   - CloudTrail for API calls

---

## Cleanup

### Destroy All Resources
```bash
# Staging
./scripts/terraform-deploy.sh staging destroy us-east-1

# Production (requires explicit confirmation)
./scripts/terraform-deploy.sh production destroy us-east-1

# Or manually
cd terraform/environments/staging
terraform destroy -auto-approve
```

### Destroy Specific Resources
```bash
# Delete only RDS
terraform destroy -target module.rds -auto-approve

# Delete specific service
terraform destroy -target 'aws_ecs_service.backend' -auto-approve
```

### Keep Terraform State but Destroy Infrastructure
```bash
# Remove from state without destroying (dangerous!)
terraform state rm 'aws_db_instance.main'
```

---

## Next Steps

1. ✅ Deploy to staging and test
2. ✅ Monitor for 1-2 weeks
3. ✅ Configure production alarms
4. ✅ Deploy to production
5. ✅ Set up automated backups
6. ✅ Implement disaster recovery plan
7. ✅ Document runbooks for ops team

---

## Support

For issues:
- Check AWS CloudWatch logs
- Review Terraform apply output
- Check AWS management console
- Review security group rules
- Verify IAM permissions

Still stuck? Review the architecture diagram and verify each component is deployed correctly.

Good luck! 🚀
