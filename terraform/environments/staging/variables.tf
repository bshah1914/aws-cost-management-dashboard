# Staging Environment Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "aws-cost-dashboard"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "backend_image" {
  description = "Backend Docker image URI"
  type        = string
}

variable "frontend_image" {
  description = "Frontend Docker image URI"
  type        = string
}

variable "db_password" {
  description = "RDS database password"
  type        = string
  sensitive   = true
}

variable "db_username" {
  description = "RDS database username"
  type        = string
  default     = "dbadmin"
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "costdb"
}

variable "aws_access_key_id" {
  description = "AWS access key ID for application"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret access key for application"
  type        = string
  sensitive   = true
}

variable "flask_secret_key" {
  description = "Flask secret key"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "alarm_email" {
  description = "Email for CloudWatch alarms (optional)"
  type        = string
  default     = null
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for alarms (optional)"
  type        = string
  default     = null
}
