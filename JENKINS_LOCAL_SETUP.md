# Jenkins Local Setup Guide for Terraform ECS Fargate Deployment

## Quick Setup (5-10 minutes)

Your Jenkins is running at: **http://localhost:8080/**

---

## Step 1: Install Required Jenkins Plugins

1. **Go to**: Jenkins > Manage Jenkins > Manage Plugins
2. **Search and install** these plugins:
   - Pipeline
   - Git
   - Terraform
   - AWS Steps
   - GitHub
   - CloudBees Docker Build and Publish
   - Log Parser
   - AnsiColor

**Installation Steps:**
1. Click "Available plugins"
2. Search for plugin name
3. Check the box
4. Click "Install without restart"
5. Restart Jenkins when done

---

## Step 2: Configure System Credentials

### 2.1 GitHub Container Registry Credentials

**Create Credential:**
1. Jenkins > Manage Credentials > Global > Add Credentials
2. **Kind**: Username with password
3. **Username**: `bshah1914`
4. **Password**: `<your-github-token>` (with read:packages scope)
5. **ID**: `github-container-registry`
6. **Description**: GitHub Container Registry for Docker
7. Click Create

### 2.2 AWS Credentials

**Create Credential:**
1. Jenkins > Manage Credentials > Global > Add Credentials
2. **Kind**: AWS Credentials
3. **Access Key ID**: `<your-aws-access-key>`
4. **Secret Access Key**: `<your-aws-secret-key>`
5. **ID**: `aws-credentials`
6. **Description**: AWS Account Access
7. Click Create

**Get AWS Credentials:**
```bash
# Option 1: Use existing AWS CLI config
cat ~/.aws/credentials

# Option 2: Generate new credentials
# AWS Console > IAM > Users > Your User > Security Credentials > Create Access Key
```

### 2.3 GitHub Repository Access (Optional but Recommended)

**Create Credential:**
1. Jenkins > Manage Credentials > Global > Add Credentials
2. **Kind**: Username with password
3. **Username**: `bshah1914`
4. **Password**: `<your-github-token>`
5. **ID**: `github-credentials`
6. Click Create

---

## Step 3: Create Pipeline Job

### 3.1 Create New Job

1. Jenkins Home > **New Item**
2. **Enter name**: `aws-cost-dashboard-terraform`
3. **Select**: Pipeline
4. Click **OK**

### 3.2 Configure Pipeline

**General Tab:**
- ✓ Enable: "Execute concurrent builds if necessary"
- Description: "AWS Cost Dashboard Terraform deployment to ECS Fargate"

**Build Triggers Tab:**
- ✓ Check: "GitHub hook trigger for GITScm polling"
- ✓ Check: "Poll SCM" (Backup trigger)
  - Schedule: `H H * * *` (daily at midnight)

**Pipeline Tab:**
- **Definition**: "Pipeline script from SCM"
- **SCM**: Git
  - **Repository URL**: `https://github.com/bshah1914/aws-cost-management-dashboard.git`
  - **Credentials**: `github-credentials` (or select your credentials)
  - **Branch**: `*/main`
  - **Script Path**: `Jenkinsfile.terraform`

**Click Save**

---

## Step 4: Configure Pipeline Parameters

The Jenkinsfile.terraform has these parameters:

| Parameter | Options | Default |
|-----------|---------|---------|
| ACTION | plan, apply, destroy | plan |
| ENVIRONMENT | staging, production | staging |
| BUILD_IMAGES | true, false | true |
| IMAGE_TAG | any string | latest |

**Example triggers:**

```
Plan Staging:
- ACTION=plan
- ENVIRONMENT=staging
- BUILD_IMAGES=false
- IMAGE_TAG=latest

Deploy to Staging:
- ACTION=apply
- ENVIRONMENT=staging
- BUILD_IMAGES=true
- IMAGE_TAG=latest

Deploy to Production:
- ACTION=apply
- ENVIRONMENT=production
- BUILD_IMAGES=true
- IMAGE_TAG=v1.0.0  (use commit hash for prod)
```

---

## Step 5: Test the Pipeline

### 5.1 Initial Test (Plan Only)

1. Jenkins > `aws-cost-dashboard-terraform` > **Build with Parameters**
2. Select:
   - ACTION: `plan`
   - ENVIRONMENT: `staging`
   - BUILD_IMAGES: `false`
   - IMAGE_TAG: `latest`
3. Click **Build**

**Expected Output:**
```
+ Checkout code
+ Validate Terraform
+ Terraform Plan (all resources)
✓ Plan completed successfully
```

### 5.2 Check Job Logs

1. Click on build number (e.g., #1)
2. Click **Console Output**
3. Review the Terraform plan

**Troubleshooting:**
- Missing credentials? Check Manage Credentials
- Terraform not found? Install terraform on Jenkins server
- AWS auth failed? Verify AWS credentials

---

## Step 6: Pre-Deployment Setup (Manual)

Before applying, complete these tasks:

### 6.1 Set Up Terraform Backend
```bash
# Run on your local machine (not Jenkins)
cd /home/brijesh/Downloads/aws_cost_management_dashboard-main

# Create S3 backend
chmod +x scripts/setup-terraform-backend.sh
./scripts/setup-terraform-backend.sh us-east-1

# Output should show:
# ✓ Terraform backend setup complete!
# S3 bucket: aws-cost-dashboard-terraform-state
# DynamoDB table: terraform-locks
```

### 6.2 Build and Push Docker Images (Local)
```bash
# Login to GitHub Container Registry
export CR_TOKEN="ghp_xxxxx"
echo $CR_TOKEN | docker login ghcr.io -u bshah1914 --password-stdin

# Build and push
docker build -t ghcr.io/bshah1914/aws-cost-dashboard-backend:latest -f backend/Dockerfile backend/
docker push ghcr.io/bshah1914/aws-cost-dashboard-backend:latest

docker build -t ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest -f frontend/Dockerfile frontend/
docker push ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest

# Verify
docker push will show: Pushed to registry
```

### 6.3 Create Terraform Variables File
```bash
# Staging environment
cd terraform/environments/staging
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
cat > terraform.tfvars << 'EOF'
aws_region             = "us-east-1"
project_name           = "aws-cost-dashboard"
environment            = "staging"
backend_image          = "ghcr.io/bshah1914/aws-cost-dashboard-backend:latest"
frontend_image         = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest"
db_password            = "SecurePass123!@#"
db_username            = "dbadmin"
db_name                = "costdb"
aws_access_key_id      = "AKIAIOSFODNN7EXAMPLE"
aws_secret_access_key  = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
flask_secret_key       = "your-secret-key-here"
jwt_secret             = "your-jwt-secret-here"
EOF

# Push to Git (so Jenkins can access it)
git add terraform.tfvars
git commit -m "Add staging terraform configuration"
git push origin main
```

---

## Step 7: Deploy to Staging

### 7.1 Run Pipeline

1. Jenkins > `aws-cost-dashboard-terraform` > **Build with Parameters**
2. Select:
   - ACTION: `apply`
   - ENVIRONMENT: `staging`
   - BUILD_IMAGES: `true` (first run)
   - IMAGE_TAG: `latest`
3. Click **Build**

**Pipeline will:**
1. ✓ Checkout code
2. ✓ Build backend Docker image
3. ✓ Build frontend Docker image
4. ✓ Push to GitHub Container Registry
5. ✓ Validate Terraform
6. ✓ Plan infrastructure
7. ✓ Apply infrastructure
8. ✓ Test health checks

**Duration:** ~15-20 minutes (first run is slowest)

### 7.2 Monitor Deployment

1. Click **Console Output** to watch progress
2. Look for:
   ```
   [+] Resource created: aws_ecs_service.backend
   [+] Resource created: aws_ecs_service.frontend
   [+] Resource created: aws_lb.main
   ...
   ✓ Terraform apply completed successfully for staging
   ```

### 7.3 Get Access URL

After successful deployment, Jenkins will output:
```
=== Deployment Outputs ===
access_url = "http://aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"
alb_dns_name = "aws-cost-alb-xxx.us-east-1.elb.amazonaws.com"
ecs_cluster_name = "aws-cost-dashboard-cluster-staging"
```

Test it:
```bash
curl http://aws-cost-alb-xxx.us-east-1.elb.amazonaws.com
```

---

## Step 8: Deploy to Production (When Ready)

⚠️ **Production deployment requires:**
1. Staging tested and working
2. Production `terraform.tfvars` configured
3. Manual approval in Jenkins

### 8.1 Create Production Variables
```bash
cd terraform/environments/production
cp terraform.tfvars.example terraform.tfvars

# Edit production values
cat > terraform.tfvars << 'EOF'
aws_region             = "us-east-1"
project_name           = "aws-cost-dashboard"
environment            = "production"
cost_center            = "engineering"
backend_image          = "ghcr.io/bshah1914/aws-cost-dashboard-backend:v1.0.0"
frontend_image         = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:v1.0.0"
db_password            = "PROD_SecurePass123!@#XYZ"
db_username            = "dbadmin"
db_name                = "costdb"
aws_access_key_id      = "AKIAIOSFODNN7PROD"
aws_secret_access_key  = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYPRODKEY"
flask_secret_key       = "prod-secret-key-different-from-staging"
jwt_secret             = "prod-jwt-secret-different-from-staging"
alarm_topic_arn        = "arn:aws:sns:us-east-1:ACCOUNT_ID:topic-name"
EOF

git add terraform.tfvars
git commit -m "Add production terraform configuration"
git push origin main
```

### 8.2 Deploy to Production

1. Jenkins > `aws-cost-dashboard-terraform` > **Build with Parameters**
2. Select:
   - ACTION: `apply`
   - ENVIRONMENT: `production`
   - BUILD_IMAGES: `true`
   - IMAGE_TAG: `v1.0.0` (use version, not latest)
3. Click **Build**

**Jenkins will ask for confirmation:**
```
[APPROVAL REQUIRED]
Apply Terraform to PRODUCTION?
[Approve] [Reject]
```

4. Review the plan and click **Approve**
5. Monitor the deployment

---

## Common Jenkins Operations

### View Pipeline History
1. Jenkins > `aws-cost-dashboard-terraform` > **Build History**
2. Click on build number to see details

### Abort Running Build
1. Click on build number
2. Click **Abort** on the left

### View Build Logs
1. Click on build number
2. Click **Console Output**
3. Search for errors

### Re-run Failed Build
1. Click on failed build
2. Scroll to bottom
3. Click **Retry** (if available) or run Build with Parameters again

### Update Pipeline

**If Jenkinsfile.terraform changes:**
1. Push changes to GitHub
2. Jenkins will auto-detect on next poll (or manually trigger)
3. Uses latest Jenkinsfile from repository

---

## Troubleshooting Jenkins Issues

### Jenkins Can't Find Terraform
```bash
# On Jenkins server machine
which terraform

# If not found, install:
wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
unzip terraform_1.5.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify
terraform version
```

### Jenkins Can't Find Docker
```bash
# Check if Docker is installed
docker --version

# If not, install Docker and add Jenkins user to docker group
sudo usermod -aG docker jenkins

# Restart Jenkins
sudo systemctl restart jenkins
```

### AWS Credentials Not Working
```bash
# Test AWS CLI with Jenkins user
sudo su - jenkins
aws sts get-caller-identity

# Should return your account ID and user ARN
# If it fails, check IAM permissions
```

### GitHub Container Registry Login Failed
```bash
# Check token has correct scopes
# GitHub > Settings > Developer settings > Personal access tokens
# Token should have: read:packages, write:packages

# Test manually
echo "TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/bshah1914/aws-cost-dashboard-backend:latest
```

### Terraform State Lock
```bash
# If Terraform is stuck
# Check S3 state lock in DynamoDB
aws dynamodb scan --table-name terraform-locks

# Force unlock (use carefully!)
aws dynamodb delete-item --table-name terraform-locks \
  --key '{"LockID":{"S":"aws-cost-dashboard/staging"}}'
```

---

## Monitoring & Maintenance

### Check Jenkins Health
```bash
# Visit Jenkins status page
http://localhost:8080/systemInfo

# Check disk space (Terraform downloading)
df -h

# Check memory
free -h

# Restart if needed
sudo systemctl restart jenkins
```

### View Build Artifacts
1. Jenkins > Build > Artifacts
2. Download `outputs-staging.json` or `outputs-production.json`
3. Contains all terraform outputs (URLs, endpoints)

### Clean Old Builds
1. Jenkins > Job > Configure
2. General > Discard old builds
3. Set: Keep last 10 builds
4. Save

### Backup Jenkins Configuration
```bash
# Jenkins stores config in ~/.jenkins/
tar -czf jenkins-backup.tar.gz ~/.jenkins/

# Back this up regularly
cp jenkins-backup.tar.gz /backup/location/
```

---

## Next Steps

1. ✅ Install Jenkins plugins
2. ✅ Configure GitHub Container Registry credentials
3. ✅ Configure AWS credentials
4. ✅ Create Pipeline job
5. ✅ Set up Terraform backend (S3/DynamoDB)
6. ✅ Create terraform.tfvars files
7. ✅ Deploy to staging
8. ✅ Test staging deployment
9. ✅ Deploy to production
10. ✅ Monitor with CloudWatch

---

## Command Cheat Sheet

```bash
# Check Jenkins is running
curl http://localhost:8080/

# Check logs
tail -f /var/log/jenkins/jenkins.log

# Restart Jenkins
sudo systemctl restart jenkins

# Check Jenkins version
curl -s http://localhost:8080/api/json | jq '.Hudson_Version'

# Check pipeline job status
curl http://localhost:8080/job/aws-cost-dashboard-terraform/lastBuild/api/json

# Download build artifacts
curl -O http://localhost:8080/job/aws-cost-dashboard-terraform/1/artifact/outputs-staging.json
```

---

## Questions?

Review:
- [TERRAFORM_DEPLOYMENT.md](../TERRAFORM_DEPLOYMENT.md) for detailed Terraform info
- [Jenkinsfile.terraform](../Jenkinsfile.terraform) for pipeline stages
- [terraform/](../terraform/) for infrastructure code

Good luck! 🚀
