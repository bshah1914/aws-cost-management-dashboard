# Production Environment Configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "aws-cost-dashboard-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostCenter  = var.cost_center
    }
  }
}

# Local variables for production environment
locals {
  environment = "production"
  
  vpc_config = {
    cidr_block             = "10.1.0.0/16"
    public_subnet_cidrs    = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
    private_subnet_cidrs   = ["10.1.10.0/24", "10.1.11.0/24", "10.1.12.0/24"]
    availability_zones     = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  }

  ecs_config = {
    backend_cpu          = "1024"
    backend_memory       = "2048"
    backend_desired      = 3
    backend_max          = 6
    frontend_cpu         = "512"
    frontend_memory      = "1024"
    frontend_desired     = 3
    frontend_max         = 6
  }

  rds_config = {
    instance_class       = "db.t3.small"
    allocated_storage    = 100
    backup_retention     = 30
  }
}

# VPC Module
module "vpc" {
  source = "../modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = local.vpc_config.cidr_block
  public_subnet_cidrs  = local.vpc_config.public_subnet_cidrs
  private_subnet_cidrs = local.vpc_config.private_subnet_cidrs
  availability_zones   = local.vpc_config.availability_zones
}

# Security Groups
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  vpc_id      = module.vpc.vpc_id
  description = "ALB Security Group for production"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-sg-${var.environment}"
  vpc_id      = module.vpc.vpc_id
  description = "ECS Tasks Security Group for production"

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-sg"
  }
}

resource "aws_security_group" "db" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  vpc_id      = module.vpc.vpc_id
  description = "RDS Security Group for production"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# ALB Module
module "alb" {
  source = "../modules/alb"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  alb_security_groups = [aws_security_group.alb.id]
}

# RDS Module
module "rds" {
  source = "../modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  db_password           = var.db_password
  private_subnet_ids    = module.vpc.private_subnet_ids
  db_security_groups    = [aws_security_group.db.id]

  db_instance_class     = local.rds_config.instance_class
  allocated_storage     = local.rds_config.allocated_storage
  backup_retention_days = local.rds_config.backup_retention
}

# Secrets Manager for Application Parameters
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}/app/secrets-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-app-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    AWS_ACCESS_KEY_ID     = var.aws_access_key_id
    AWS_SECRET_ACCESS_KEY = var.aws_secret_access_key
    AWS_REGION            = var.aws_region
    SECRET_KEY            = var.flask_secret_key
    JWT_SECRET            = var.jwt_secret
    DATABASE_URL          = "postgresql://${var.db_username}:${var.db_password}@${replace(module.rds.db_endpoint, ":5432", "")}:5432/${var.db_name}"
  })
}

# ECS Module
module "ecs" {
  source = "../modules/ecs"

  project_name              = var.project_name
  environment               = var.environment
  aws_region                = var.aws_region
  backend_image             = var.backend_image
  frontend_image            = var.frontend_image

  backend_cpu               = local.ecs_config.backend_cpu
  backend_memory            = local.ecs_config.backend_memory
  backend_desired_count     = local.ecs_config.backend_desired
  backend_max_capacity      = local.ecs_config.backend_max
  
  frontend_cpu              = local.ecs_config.frontend_cpu
  frontend_memory           = local.ecs_config.frontend_memory
  frontend_desired_count    = local.ecs_config.frontend_desired
  frontend_max_capacity     = local.ecs_config.frontend_max

  ecs_security_groups       = [aws_security_group.ecs.id]
  private_subnet_ids        = module.vpc.private_subnet_ids
  
  backend_target_group_arn  = module.alb.backend_target_group_arn
  frontend_target_group_arn = module.alb.frontend_target_group_arn
  alb_listener_arn          = module.alb.alb_listener_arn
  
  secrets_manager_arn       = aws_secretsmanager_secret.app_secrets.arn
  
  depends_on = [module.alb, module.vpc]
}

# CloudWatch Alarms - Production critical
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.project_name}-alb-unhealthy-hosts-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "1"
  alarm_actions       = [var.alarm_topic_arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = module.alb.backend_target_group_arn
    LoadBalancer = module.alb.alb_arn
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_backend_cpu" {
  alarm_name          = "${var.project_name}-ecs-backend-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_actions       = [var.alarm_topic_arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = module.ecs.backend_service_name
    ClusterName = module.ecs.ecs_cluster_name
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-rds-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_actions       = [var.alarm_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${var.project_name}-rds-storage-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "10737418240" # 10GB in bytes
  alarm_actions       = [var.alarm_topic_arn]
  treat_missing_data  = "notBreaching"
}
