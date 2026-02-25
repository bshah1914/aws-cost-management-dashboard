# RDS Module - Main
# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-db-subnet-group"
    Environment = var.environment
  }
}

# RDS Instance (PostgreSQL)
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db-${var.environment}"
  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.db_instance_class

  allocated_storage            = var.allocated_storage
  max_allocated_storage        = var.max_allocated_storage
  storage_type                 = "gp3"
  storage_encrypted            = true
  iops                         = var.iops
  db_name                      = var.db_name
  username                     = var.db_username
  password                     = var.db_password
  db_subnet_group_name         = aws_db_subnet_group.main.name
  vpc_security_group_ids       = var.db_security_groups
  parameter_group_name         = aws_db_parameter_group.main.name
  publicly_accessible          = false
  skip_final_snapshot          = var.environment == "production" ? false : true
  final_snapshot_identifier    = var.environment == "production" ? "${var.project_name}-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  backup_retention_period      = var.backup_retention_days
  backup_window                = "03:00-04:00"
  maintenance_window           = "sun:04:00-sun:05:00"
  multi_az                     = var.environment == "production" ? true : false
  deletion_protection          = var.environment == "production" ? true : false
  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name        = "${var.project_name}-db"
    Environment = var.environment
  }
}

# Enhanced Monitoring Role
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-rds-monitoring-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# DB Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "postgres${var.postgres_version}"
  name   = "${var.project_name}-db-params-${var.environment}"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_duration"
    value = "on"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = {
    Name        = "${var.project_name}-db-params"
    Environment = var.environment
  }
}

# CloudWatch Log Group for RDS
resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${aws_db_instance.main.identifier}/postgresql"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-rds-logs"
    Environment = var.environment
  }
}

# Secrets Manager Secret for RDS Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}/rds/credentials-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.project_name}-rds-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    engine   = "postgres"
    host     = aws_db_instance.main.endpoint
    port     = 5432
    dbname   = var.db_name
  })
}
