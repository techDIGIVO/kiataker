# ADR 0001: One TypeScript monorepo, one API, one database

- Status: Accepted
- Date: 2026-11-12
- Context: PRD §40, §41

## Decision

Kiataker is built as a single TypeScript monorepo (pnpm workspaces + Turborepo) with one
NestJS modular-monolith API and one PostgreSQL database. Every rule lives in exactly one
place in the API, and every surface (WhatsApp portal, admin, secure pages, provider web
link, landing page, mobile apps) calls that API.

## Why

- Earlier attempts ran two backends on one database and repeatedly fixed a rule on one
  path while it stayed broken on the other. One API makes that impossible.
- A modular monolith gives clear domain boundaries without the operational cost of
  microservices. Each module owns its tables; other modules call its commands or react to
  its events.
- Shared packages (contracts, domain state machines, design tokens, copy registry) stop
  code and rules from drifting between surfaces.

## Consequences

- Shared packages compile to `dist` (CommonJS) so the NestJS API (which relies on
  TypeScript decorator metadata) and the Next.js web app consume stable, typed builds.
  Turbo builds packages before the apps.
- Every state change is a command that validates permission, checks controls, writes
  state, writes the outbox event and the audit entry in one transaction (§41.3).
- Projections (Action Centre, Property Timeline, dashboards) are rebuildable from events.
- Feature entry points check their platform control and fail closed (BP-08).

## Local development

PostgreSQL runs natively or via Docker Compose (Postgres, MinIO, Mailpit). Adapters
(WhatsApp, payments, AI, storage, scanner) default to in-memory fakes, switched to real
services by environment variables only. Going live is a configuration change, not a code
change (§44).
