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

**Temporary website demo** (until the real number is live on WhatsApp)

The production API answers 404 on the simulator endpoint, so the site's phone shows "The live
demo isn't available here". To make it work without turning on `DEV_TOOLS` in production, run
the separate demo API defined in `render.yaml` (`kiataker-api-demo`). It gets its own empty
database, and WhatsApp, payments and email are all fake there, so nothing a visitor types
touches real data or reaches a real person.

What the current setup is, so you know what to pick:

| Thing | Value |
| --- | --- |
| Website (Vercel) | `https://kiataker-nine.vercel.app`, project root `apps/web` |
| Live API (Render) | `https://kiataker-api.onrender.com`, service `kiataker-api`, region **Frankfurt** |
| Live database (Neon) | region **AWS Europe Central 1 (Frankfurt)**, `aws-eu-central-1` |
| Demo API (to create) | service `kiataker-api-demo`, region **Frankfurt**, free plan |

Time needed: about 30 minutes. You need access to the Neon, Render and Vercel accounts the
site was deployed from, and this repo on your machine with `pnpm install` done.

**Step 1. Create the demo database (Neon)**

1. Sign in at console.neon.tech and open the Kiataker project.
2. Either create a **new project** named `kiataker-demo` in **AWS Europe Central 1 (Frankfurt)**
   (cleanest: its compute is separate from production's), or, if the plan won't allow another
   project, open the existing project → **Databases** → **New database**, name it
   `kiataker_demo`, on the main branch. Never use production's existing database.
3. Click **Connect**, choose the new database, and turn **Connection pooling off** (the direct
   connection: its hostname has no `-pooler`). Copy the connection string. It looks like
   `postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/kiataker_demo?sslmode=require`.
   This is the demo `DATABASE_URL`. Keep it private.

**Step 2. Create the demo API (Render)**

1. Push this repo's `main` so Render sees the updated `render.yaml`.
2. Sign in at dashboard.render.com. Open **Blueprints** in the left menu and click the
   Kiataker blueprint (the one connected to this repo).
3. Click **Manual sync** (if it has auto-sync on, Render may already have started this after the
   push). Render lists `kiataker-api-demo` as a new service and asks for its values:
   - `DATABASE_URL`: the connection string from step 1.
   - `API_BASE_URL`: `https://kiataker-api-demo.onrender.com` (if Render gives the service a
     different address, use that one; it's shown at the top of the service page).
   - `WEB_BASE_URL`: `https://kiataker-nine.vercel.app`, exactly, no trailing slash. This is the
     only site allowed to call the API. If the site moves to its own domain, change it here too.
   - `AI_API_KEY`: leave it empty. The demo then uses its rule-based understanding. Only add a
     key that has a spending cap, because anonymous visitors spend it.
4. Click **Apply**. The first build takes several minutes. It installs, builds and creates the
   tables in the demo database.
5. Check it: open `https://kiataker-api-demo.onrender.com/v1/health` in a browser. It should
   answer with a status. On the free plan the service sleeps after about 15 minutes without
   traffic, so the first request after that takes 30 to 60 seconds.

If there is **no Blueprint** in Render (the live API was created by hand), create the demo the
same way instead: **New → Web Service** → this repo, region **Frankfurt**, plan **Free**, and
copy the build command, start command, health check path and every environment variable from the
`kiataker-api-demo` block in `render.yaml`. For `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`,
click **Generate** for each.

**Step 3. Load the demo's reference data (your machine, once)**

The tables are empty after step 2. This adds the reference data the chat needs, plus one admin
login for the demo.

1. In Render, open `kiataker-api-demo` → **Environment** and copy the value of
   `JWT_ACCESS_SECRET` (click the eye icon to reveal it). It must be the demo's, not production's.
2. In a terminal in the repo folder, run this. In **Git Bash**:
   ```
   DATABASE_URL='<demo connection string>' \
   JWT_ACCESS_SECRET='<demo JWT_ACCESS_SECRET>' \
   BOOTSTRAP_ADMIN_EMAIL='<your email>' \
   BOOTSTRAP_ADMIN_PASSWORD='<12+ characters>' \
   BOOTSTRAP_ADMIN_NAME='Demo Admin' \
   pnpm --filter @kiataker/db seed:prod
   ```
   Or in **PowerShell**:
   ```
   $env:DATABASE_URL='<demo connection string>'
   $env:JWT_ACCESS_SECRET='<demo JWT_ACCESS_SECRET>'
   $env:BOOTSTRAP_ADMIN_EMAIL='<your email>'
   $env:BOOTSTRAP_ADMIN_PASSWORD='<12+ characters>'
   $env:BOOTSTRAP_ADMIN_NAME='Demo Admin'
   pnpm --filter @kiataker/db seed:prod
   ```
   It should end with lines starting with ✔. Close the terminal afterwards so these values don't
   linger in it.
3. Check the chat end to end (Git Bash):
   ```
   curl -X POST https://kiataker-api-demo.onrender.com/v1/whatsapp/inbound \
     -H "content-type: application/json" -d '{"from":"+2348000000001","text":"Hello"}'
   ```
   It should answer with `{"messages":[...]}`, not a 404.

**Step 4. Point the website's demo at it (Vercel)**

1. Sign in at vercel.com, open the Kiataker project → **Settings** → **Environment Variables**.
2. Add `DEMO_API_BASE_URL` = `https://kiataker-api-demo.onrender.com` (no trailing slash), for
   the **Production** environment (tick Preview too if you want it on preview links). Save.
   Leave `API_BASE_URL` as it is, on the live API.
3. Go to **Deployments**, open the menu (⋯) on the latest production deployment and click
   **Redeploy**. The value is compiled into the page, so it only takes effect after a new build.
4. Open the site. The phone should greet you and answer what you type. If it says "Could not
   reach Kiataker right now", the demo API was probably asleep: wait a minute and try again.

**Known limits.** Links the demo chat sends (confirmations, secure tasks) open pages that read the
live API, so they show "not found"; the chat itself works. Render's free plan shares 750 running
hours a month across the workspace, so the demo eats into the same allowance as the live API.

**Removing it** when WhatsApp goes live: in Vercel delete `DEMO_API_BASE_URL` and redeploy; in
Render delete the `kiataker-api-demo` service (and the block in `render.yaml`); in Neon delete
the demo project or database.

**Then** go live on WhatsApp ([GO-LIVE-WHATSAPP.md](GO-LIVE-WHATSAPP.md)) and Paystack (keys in
`/admin/ai`, webhook `{API_BASE_URL}/v1/payments/webhook`).
