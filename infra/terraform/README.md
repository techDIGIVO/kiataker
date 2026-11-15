# Kiataker infrastructure (Terraform)

Infrastructure-as-code scaffold for Kiataker staging and production (PRD P0-03).
Target cloud: **AWS, af-south-1 (Cape Town)** — chosen to keep Nigerian user data
in-region and close to users; the S3-compatible evidence store and the `af-south-1`
default in `.env.example` already assume AWS.

> **Status: scaffold, not yet applied.** This defines the core managed pieces
> (network inputs, PostgreSQL, the evidence bucket, secrets) and the variables and
> outputs that wire them to the app's env. Compute (how the API/web containers run —
> ECS Fargate, App Runner, EKS, or a VM) is deliberately left as a decision: pick one
> and add a `compute.tf` that consumes the outputs here. Nothing here has been
> `terraform apply`-ed; that happens at deploy time with real credentials and a remote
> state backend. Review every value (sizes, retention, CIDRs) before applying.

## Layout

| File | What it defines |
| --- | --- |
| `main.tf` | AWS provider, required versions, remote-state backend (placeholder), tags |
| `variables.tf` | `environment`, region, DB sizing, allowed CIDRs, domain |
| `rds.tf` | PostgreSQL 16 instance (+ subnet group, parameter group) |
| `storage.tf` | S3 bucket for evidence/media (versioned, private, encrypted) |
| `secrets.tf` | AWS Secrets Manager entries for the app's runtime secrets |
| `outputs.tf` | Connection string pieces + bucket name + secret ARNs for the app |

## Usage (once a compute target is chosen and credentials are set)

```bash
cd infra/terraform
terraform init                        # configure the S3/DynamoDB backend first
terraform workspace new staging       # one workspace per environment
terraform plan  -var environment=staging
terraform apply -var environment=staging
```

## What still needs real accounts / decisions (cannot be in code)

- The compute layer (`compute.tf`) once the run target is picked.
- A remote state backend bucket + lock table (bootstrap once, by hand).
- DNS/ACM certificates for the domain.
- The actual secret *values* (set via `terraform apply` vars or the console; never
  committed — secrets live in Secrets Manager, mirrored by `.env.local` locally).
- A restore/backup drill and a production cut-over runbook (operational, see DEPLOYMENT.md).
