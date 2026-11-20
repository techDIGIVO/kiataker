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

## First production deploy (any host)

Applies to any host until the AWS stack lands: web on Vercel, API on a container platform
(Render, Railway, Fly) or a VPS, plus managed PostgreSQL 16.

**API host constraints**
- Exactly **one** instance. The job scheduler and the rate limiter assume a single process.
- A persistent disk mounted at `UPLOADS_DIR`, or CMS uploads are lost on every redeploy.
- Install with dev dependencies (`prisma` and `tsx` are dev dependencies): run
  `pnpm install --frozen-lockfile` **without** `NODE_ENV=production` set at install time,
  then set `NODE_ENV=production` for the running process.
- Build: `pnpm --filter @kiataker/api... build`. Start: `pnpm --filter @kiataker/api start`.

**Environment** (see `.env.example` for every variable)
- `NODE_ENV=production`, `DATABASE_URL`, `API_BASE_URL`, `WEB_BASE_URL`, `API_PORT`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: two different random values of 32+ characters.
  The API refuses to start otherwise. `JWT_ACCESS_SECRET` also encrypts stored personal data:
  never change it after the first deploy.
- Leave `DEV_TOOLS` unset. In production the simulator, echoed one-time codes and test payment
  completion are switched off and answer 404.
- `RATE_LIMIT_MAX=600`, `RATE_LIMIT_AUTH_MAX=20`.

**Vercel (web)**: root directory `apps/web`; set `API_BASE_URL` before the first build. It is
compiled into the browser bundle, so changing it needs a redeploy.

**Database, once**
1. `pnpm --filter @kiataker/db migrate:deploy`
2. Create reference data and the first super-admin (never run `seed`, which is dev data with a
   published password):
   ```
   JWT_ACCESS_SECRET=<same as the API> \
   BOOTSTRAP_ADMIN_EMAIL=<email> BOOTSTRAP_ADMIN_PASSWORD=<12+ chars> BOOTSTRAP_ADMIN_NAME=<name> \
   pnpm --filter @kiataker/db seed:prod
   ```
   Sign in at `/admin`, add the team, then delete the `BOOTSTRAP_ADMIN_*` values.

**Then** go live on WhatsApp ([GO-LIVE-WHATSAPP.md](GO-LIVE-WHATSAPP.md)) and Paystack (keys in
`/admin/ai`, webhook `{API_BASE_URL}/v1/payments/webhook`).
