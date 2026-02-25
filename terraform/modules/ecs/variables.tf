# ECS Module - Variables
variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "backend_image" {
  description = "Backend Docker image URI"
  type        = string
}

variable "frontend_image" {
  description = "Frontend Docker image URI"
  type        = string
}

variable "backend_cpu" {
  description = "Backend task CPU (256, 512, 1024, 2048, 4096)"
  type        = string
  default     = "512"
}

variable "backend_memory" {
  description = "Backend task memory in MB"
  type        = string
  default     = "1024"
}

variable "frontend_cpu" {
  description = "Frontend task CPU"
  type        = string
  default     = "256"
}

variable "frontend_memory" {
  description = "Frontend task memory in MB"
  type        = string
  default     = "512"
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
}

variable "backend_max_capacity" {
  description = "Maximum backend task count for auto scaling"
  type        = number
  default     = 4
}

variable "frontend_max_capacity" {
  description = "Maximum frontend task count for auto scaling"
  type        = number
  default     = 4
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "ecs_security_groups" {
  description = "Security groups for ECS tasks"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "backend_target_group_arn" {
  description = "ARN of backend ALB target group"
  type        = string
}

variable "frontend_target_group_arn" {
  description = "ARN of frontend ALB target group"
  type        = string
}

variable "alb_listener_arn" {
  description = "ARN of ALB listener"
  type        = string
}

variable "secrets_manager_arn" {
  description = "ARN of Secrets Manager secret"
  type        = string
}
