#!/bin/bash

# Terraform S3 Backend Setup Script
# Creates S3 bucket and DynamoDB table for Terraform state management

set -e

BUCKET_NAME="aws-cost-dashboard-terraform-state"
DYNAMODB_TABLE="terraform-locks"
AWS_REGION=${1:-us-east-1}

echo "Setting up Terraform S3 backend..."
echo "Region: $AWS_REGION"
echo "Bucket: $BUCKET_NAME"
echo "DynamoDB Table: $DYNAMODB_TABLE"

# Create S3 bucket
echo "Creating S3 bucket..."
aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" 2>/dev/null || echo "Bucket already exists"

# Enable versioning
echo "Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled \
  --region "$AWS_REGION"

# Enable encryption
echo "Enabling server-side encryption..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }' \
  --region "$AWS_REGION"

# Block public access
echo "Blocking public access..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region "$AWS_REGION"

# Create DynamoDB table for state locking
echo "Creating DynamoDB table for state locking..."
aws dynamodb create-table \
  --table-name "$DYNAMODB_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION" 2>/dev/null || echo "DynamoDB table already exists"

echo ""
echo "✓ Terraform backend setup complete!"
echo ""
echo "Backend configuration to use in terraform block:"
echo ""
echo 'backend "s3" {'
echo "  bucket         = \"$BUCKET_NAME\""
echo '  key            = "[staging|production]/terraform.tfstate"'
echo "  region         = \"$AWS_REGION\""
echo '  encrypt        = true'
echo "  dynamodb_table = \"$DYNAMODB_TABLE\""
echo '}'
echo ""
