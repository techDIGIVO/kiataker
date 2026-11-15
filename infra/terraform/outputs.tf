output "db_endpoint" {
  description = "PostgreSQL endpoint (host:port)."
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "PostgreSQL host."
  value       = aws_db_instance.main.address
}

output "evidence_bucket" {
  description = "S3 bucket for evidence/media."
  value       = aws_s3_bucket.evidence.bucket
}

output "app_secret_arn" {
  description = "Secrets Manager ARN the compute layer reads runtime config from."
  value       = aws_secretsmanager_secret.app.arn
}

output "db_password" {
  description = "Generated DB password (sensitive; also in the app secret)."
  value       = random_password.db.result
  sensitive   = true
}
