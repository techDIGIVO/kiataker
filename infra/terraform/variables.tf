variable "environment" {
  description = "Deployment environment (staging | production)."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "region" {
  description = "AWS region. af-south-1 keeps data in-region for Nigerian users."
  type        = string
  default     = "af-south-1"
}

variable "vpc_id" {
  description = "Existing VPC to deploy into (network is managed outside this scaffold)."
  type        = string
  default     = ""
}

variable "db_subnet_ids" {
  description = "Private subnet ids for the database subnet group."
  type        = list(string)
  default     = []
}

variable "db_instance_class" {
  description = "RDS instance class. Scale per environment."
  type        = string
  default     = "db.t4g.small"
}

variable "db_allocated_storage" {
  description = "RDS storage in GB."
  type        = number
  default     = 20
}

variable "db_allowed_cidrs" {
  description = "CIDRs allowed to reach Postgres (e.g. the app subnets). Never 0.0.0.0/0."
  type        = list(string)
  default     = []
}

variable "domain" {
  description = "Public domain for this environment (e.g. staging.kiataker.ng)."
  type        = string
  default     = ""
}
