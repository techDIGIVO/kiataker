# Runtime secrets live in Secrets Manager; the compute layer reads them as env.
# Values are NOT set here (never commit secrets) - set them post-apply in the console
# or a separate tfvars that is gitignored. Keys mirror apps/api env (.env.example).

resource "aws_secretsmanager_secret" "app" {
  name        = "${local.name}/app"
  description = "Kiataker API runtime secrets (JWT, adapters, PSP, Meta, Sentry)."
}

# Seed only the DB URL from the managed instance; the rest are set out of band.
resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/kiataker?schema=public"
    # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PAYSTACK_*, META_*, SENTRY_DSN,
    # S3_* etc. are set after apply and are never stored in this repo.
  })

  lifecycle {
    ignore_changes = [secret_string] # managed out of band after the first apply
  }
}
