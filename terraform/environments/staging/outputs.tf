# Staging Environment Outputs
output "alb_dns_name" {
  description = "DNS name of ALB"
  value       = module.alb.alb_dns_name
  sensitive   = false
}

output "alb_zone_id" {
  description = "Zone ID of ALB"
  value       = module.alb.alb_zone_id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
  sensitive   = false
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.ecs_cluster_name
}

output "backend_service_name" {
  description = "Backend ECS service name"
  value       = module.ecs.backend_service_name
}

output "frontend_service_name" {
  description = "Frontend ECS service name"
  value       = module.ecs.frontend_service_name
}

output "access_url" {
  description = "URL to access the application"
  value       = "http://${module.alb.alb_dns_name}"
}
