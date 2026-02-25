#!/bin/bash

# Terraform Deployment Script
# Deploy AWS ECS Fargate infrastructure

set -e

ENVIRONMENT=${1:-staging}
ACTION=${2:-plan}
AWS_REGION=${3:-us-east-1}

if [ -z "$1" ]; then
    echo "Usage: ./terraform-deploy.sh <environment> [action] [region]"
    echo "  environment: staging or production"
    echo "  action: plan, apply, destroy (default: plan)"
    echo "  region: AWS region (default: us-east-1)"
    echo ""
    echo "Example: ./terraform-deploy.sh staging apply us-east-1"
    exit 1
fi

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "Error: environment must be 'staging' or 'production'"
    exit 1
fi

if [ "$ACTION" != "plan" ] && [ "$ACTION" != "apply" ] && [ "$ACTION" != "destroy" ]; then
    echo "Error: action must be 'plan', 'apply', or 'destroy'"
    exit 1
fi

TERRAFORM_DIR="terraform/environments/$ENVIRONMENT"

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo "Error: Terraform directory not found: $TERRAFORM_DIR"
    exit 1
fi

# Check for terraform.tfvars file
if [ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    echo "Error: terraform.tfvars not found in $TERRAFORM_DIR"
    echo "Copy terraform.tfvars.example to terraform.tfvars and fill in the values"
    exit 1
fi

echo "=================================="
echo "Terraform Deployment"
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo "Region: $AWS_REGION"
echo "=================================="
echo ""

cd "$TERRAFORM_DIR"

# Initialize Terraform
echo "Initializing Terraform..."
terraform init

# Format check
echo "Checking Terraform formatting..."
terraform fmt -check -recursive . || terraform fmt -recursive .

# Validate
echo "Validating Terraform configuration..."
terraform validate

# Plan
echo "Planning Terraform changes..."
terraform plan -out=tfplan -var="aws_region=$AWS_REGION"

# Apply or Destroy
if [ "$ACTION" = "apply" ]; then
    echo ""
    echo "Applying Terraform changes..."
    if [ "$ENVIRONMENT" = "production" ]; then
        read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Cancelled"
            exit 1
        fi
    fi
    
    terraform apply tfplan
    
    echo ""
    echo "=================================="
    echo "✓ Deployment Complete!"
    echo "=================================="
    echo ""
    echo "Outputs:"
    terraform output
    
elif [ "$ACTION" = "destroy" ]; then
    echo ""
    echo "Destroying Terraform resources..."
    if [ "$ENVIRONMENT" = "production" ]; then
        read -p "WARNING: This will DESTROY all PRODUCTION resources. Type 'destroy production' to confirm: " confirm
        if [ "$confirm" != "destroy production" ]; then
            echo "Cancelled"
            exit 1
        fi
    else
        read -p "Are you sure? Type 'destroy' to confirm: " confirm
        if [ "$confirm" != "destroy" ]; then
            echo "Cancelled"
            exit 1
        fi
    fi
    
    terraform destroy -auto-approve
    
    echo ""
    echo "✓ Resources destroyed"
fi

cd - > /dev/null
