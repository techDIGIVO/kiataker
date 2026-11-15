# Kiataker

Landlord-first rental property management platform for Nigeria. One TypeScript monorepo:
one API, one database, and every surface (WhatsApp portal, admin, secure pages, provider
web link, landing page, and the Release 2 mobile apps) calls the same API.

> Governing promise: **Collect your rent, we'll handle the rest.** Rent always settles
> directly to the landlord's account through a licensed payment partner. Kiataker never
> holds rent, deposits or any customer money.

Built to the PRD **Kiataker PRD v2.1** (12 November 2026). This repository is the single
project folder: everything the product needs lives inside it.

## Status: Phase 0 Foundations (+ engine core)

Built so far (PRD §48):

- **Monorepo** with pnpm workspaces + Turborepo (`apps/*`, `packages/*`).
- **Database** (PostgreSQL 16 + Prisma): the data model of §28 as a migratable schema,
  with seed personas (Day 0 landlord, Month 12 landlord with three properties, tenants in
  several base-truth statuses, five Command Centres with a staff seat each, platform
  controls, action routing rules, terms versions).
- **API** (NestJS modular monolith): transactional outbox, idempotency, audit, platform
  controls (fail closed), one error shape, JWT auth. Modules: health, auth, terms,
  property, tenancy, action.
- **Engine slices**: account sign-up and contact verification (ACC), combined Terms +
  Mandate + Privacy acceptance (ACC-02), Property File to MANAGED (BP-01, GJ-02), record
  an existing tenancy with the accuracy prompt (TEN-08, GJ-03), tenant confirm / dispute /
  correct (BP-19), reconciliation (GJ-04), and an Action Centre projection from the outbox.
- **Design tokens** and the **copy registry** with a copy lint (banned terms, em dashes,
  landlord verbs — §39).
- **Landing page** (Next.js) with the WhatsApp start and store badges hidden in Release 1.
- **State machines** (tenancy, occupancy, action, mandate) shared for display and enforced.

See `docs/prd` for the source PRD and `docs/adr` for architecture decisions.

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 22 LTS |
| pnpm | 9+ (via `corepack enable`) |
| PostgreSQL | 16 (native, or via Docker Compose) |
| Docker (optional) | for the full local stack (Postgres, MinIO, Mailpit) |

## Setup (under 15 minutes on a clean machine)

```bash
corepack enable
pnpm install
cp .env.example .env.local   # edit DATABASE_URL if your Postgres differs
pnpm db:generate
pnpm db:migrate              # creates the schema
pnpm db:seed                 # loads the personas
```

Or in one step: `pnpm setup`.

### Databases

By default the app uses a **native Postgres** on `localhost:5432` with databases
`kiataker_dev` and `kiataker_shadow`. Create them once:

```bash
createdb kiataker_dev
createdb kiataker_shadow
```

Prefer Docker? `docker compose up -d` starts Postgres (host port **5433**), MinIO and
Mailpit; then point `DATABASE_URL` at `localhost:5433` in `.env.local`.

## Running

```bash
pnpm dev        # builds shared packages, then runs the API (4000) and web (3000)
pnpm dev:api    # API only
pnpm dev:web    # web only
```

- API: http://localhost:4000/v1 (health: `/v1/health`)
- Web: http://localhost:3000

## Verify (the local quality gate)

```bash
pnpm verify     # typecheck, lint, copy lint, unit + integration tests, migration check
pnpm smoke      # end-to-end golden-journey slice over HTTP against a running API
```

## Repository layout (PRD §43)

```
apps/
  api/       NestJS API: domain modules, outbox, idempotency, controls, audit
  web/       Next.js: landing page, admin (later), secure pages (later), verifier (later)
  mobile/    Expo React Native app (Release 2)
packages/
  db/        Prisma schema, migrations, seed personas
  contracts/ Shared Zod schemas and the one error shape
  domain/    State machine definitions (shared for display)
  tokens/    Design tokens for web, mobile and PDFs
  copy/      Copy registry and the copy lint
infra/
  terraform/ AWS infrastructure (per environment)
docs/
  prd/       This build's PRD
  adr/       Architecture decision records
```

## Going live is configuration, not code

The same build that passes locally is the one deployed. Every live value (WhatsApp,
Paystack, Postmark, AI, AWS, domains) is read from environment variables or the secrets
store, never written in code.
