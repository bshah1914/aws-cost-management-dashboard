# AWS Configuration
aws_region = "us-east-1"
app_name   = "aws-cost-dashboard"
environment = "staging"

# VPC Configuration
vpc_cidr             = "10.0.0.0/16"
private_subnet_cidr  = ["10.0.1.0/24", "10.0.2.0/24"]
public_subnet_cidr   = ["10.0.10.0/24", "10.0.11.0/24"]
enable_nat_gateway   = true
single_nat_gateway   = true

# ECS Configuration
backend_image        = "ghcr.io/bshah1914/aws-cost-dashboard-backend:latest"
frontend_image       = "ghcr.io/bshah1914/aws-cost-dashboard-frontend:latest"
backend_cpu          = 256
backend_memory       = 512
backend_desired_count = 1
frontend_cpu         = 256
frontend_memory      = 512
frontend_desired_count = 1
backend_port         = 8000
frontend_port        = 80

# RDS Configuration
db_engine            = "postgres"
db_version           = "15.3"
db_instance_class    = "db.t3.micro"
db_allocated_storage = 20
db_name              = "awscostdb"
db_username          = "postgres"
db_password          = "UNb&EZBs!AK5bK5N9@aglzeKkfWsFyW6"
db_skip_final_snapshot = true
multi_az             = false

# Secrets
flask_secret_key     = "hK3hkYDxXSTuvgzx3MEvdhdDpFcawqhhr_ScS_u8ELFie0xEW2vnCE9PmWfVK_KAzD1oaHTbbg5_xh6OVYbStQ"
jwt_secret_key       = "COPHFNhsKaW-Rx4TOjhf_L6xpFjj8TiPWFLSLFf3vu1jpF03Gem8rvXNxhwg7AUAsMhcNyssbbN0Cev4nUwyeA"
cookie_secret_key    = "LMKsVinaSEvEySCezLU0VOWL9Xyvj20d8IlqRkplvplXDTIimcWle5S3UDoW3lTyeeEKV0PX-AINCZXpGL9_Og"

# Tags
tags = {
  Environment = "staging"
  ManagedBy   = "Terraform"
  Project     = "AWS Cost Dashboard"
}
