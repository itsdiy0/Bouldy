variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-2" # London
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "bouldy"
}

# Database
variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "bouldy"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

# Application secrets
variable "secret_key" {
  description = "Application secret key for JWT"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth session secret"
  type        = string
  sensitive   = true
}

variable "openai_embedding_key" {
  description = "OpenAI API key for embeddings"
  type        = string
  sensitive   = true
}

# Container images
variable "api_image" {
  description = "API container image"
  type        = string
  default     = "ghcr.io/itsdiy0/bouldy-api:latest"
}

variable "frontend_image" {
  description = "Frontend container image"
  type        = string
  default     = "ghcr.io/itsdiy0/bouldy-frontend:latest"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "bouldy-aws.diy0.dev"
}