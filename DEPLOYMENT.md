# Deployment: from an empty AWS account to production

Target region: AWS Africa (Cape Town), `af-south-1`, with the Lagos Local Zone for
latency-sensitive services (PRD §40, §46). Infrastructure is Terraform (`infra/terraform`).

> Going live is a configuration change, never a code change. The same build that passes
> staging is the one deployed. Every live value is read from environment variables or the
> secrets store.

## Outline (to be completed in Phase 0 P0-03 and Phase 5)

1. Bootstrap Terraform state (S3 + DynamoDB lock).
2. `terraform apply` per environment: VPC, RDS PostgreSQL (Multi-AZ), ECS Fargate (API),
   S3 (evidence) + CloudFront, KMS, Secrets Manager.
3. CI/CD (GitHub Actions, §45): verify, build, preview per PR, end-to-end on merge,
   staging deploy on merge to `main`, production deploy on manual approval with health
   check and automatic rollback.
4. Secrets: WhatsApp (Meta Cloud API), Paystack, Postmark, AI, JWT, database URL.
5. Health check: `/v1/health` returns the build commit within 60 seconds of deploy.

Full runbook lands with Phase 0 infrastructure.
