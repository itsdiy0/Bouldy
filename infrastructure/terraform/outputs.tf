# Outputs — displayed after terraform apply

output "alb_dns_name" {
  description = "ALB DNS name — point your domain CNAME here"
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "s3_bucket" {
  description = "S3 bucket for document storage"
  value       = aws_s3_bucket.documents.id
}

output "ecs_cluster" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "app_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}