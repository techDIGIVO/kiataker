# Kiataker — Build Status Tracker

This is the live tracker for the whole build (the PRD's "Build tracker", P0-13). It lists
every phase, requirement group and golden journey with its status. **Updated every work
session.** Only the PRD (`Kiataker_PRD_v2.1.pdf`) drives this build — no other document.

**Last updated:** 2026-11-15 (Phase 0-5 code-completion pass + git. The whole codebase is now committed (git initialised: `main` baseline + `feat/phase-0-5-completion`). Built the buildable remainder of phases 0-5: **durable job queue/scheduler** (P0-05) at `/admin/jobs`; **WhatsApp support inbox** (P2) at `/admin/inbox` (read threads + reply); **Information outputs** (P4) - a landlord rent statement at `/admin/statements`, `GET /statements/me` and over WhatsApp; **QMS workbench** (P4) at `/admin/qms` (review Property Files, set QC status); **payment refunds** (P4) + staff actions on the last read-only admin tabs (payments, notices, intake); the **arrears board** now aggregates in the DB (groupBy, no row cap); and a **Terraform** infra scaffold (P0-03) under `infra/terraform`. What remains of phases 0-5 is deploy-only (a live Sentry project + uptime monitors, running the load/pen tests + restore drill against a real env, the compute layer + `terraform apply`, production cut-over, live Paystack/Meta accounts). Earlier: Full admin operational control: the admin is no longer a read-only dashboard. Staff can now run every operation concierge-style from the boards — **activate** an origination, **add a deduction + settle** a close-out, **send** a condition check to the tenant and **compare** to the baseline, **renew / decline / advance** a renewal runway, **set** a property's scope, **add a unit** to a building, and **record a paper signature** on a document (on top of the existing admit/reject, approve/reject, decline, fee and key controls). Each staff action resolves the owning landlord, reuses the same fully-tested engine method with all its guards, and records a dedicated staff-attributed audit entry. 10 new staff endpoints + action buttons on the seven previously read-only boards, all regression-tested. Earlier: Real LLM WhatsApp agent (P2-05, BP-11): the conversation engine now understands free-text messages through a real hosted model when one is configured. `ai.service` calls the admin-selected provider (Anthropic / OpenAI / Google) over plain fetch to classify a message into one intent; the deterministic rules remain the always-on fallback (no key, error or timeout). The AI is strictly constrained — it returns one label from a fixed list, the message is treated as data not an instruction, and the engine acts on the label with its own ownership/control checks, so the AI never decides. A live "Test the agent" box at `/admin/ai` (and `POST /internal/ai/test`) shows the classified intent and whether the LLM or the rules handled it. Prompt building, label parsing (injection-resistant) and provider response parsing are unit-tested; the hosted call needs the operator's API key. Earlier: template studio (P0-09), staff author, version and counsel-approve notice/agreement templates (NT/AG codes) from `/admin/templates` — create a template with {placeholder} detection, add append-only versions, preview a version rendered with sample values, and record counsel approval; the notice engine still only ever instructs a counsel-approved version, so the studio is the controlled authoring surface in front of that gate. Earlier: PDF export of sealed documents (GJ-14), Phase 5 launch-prep (Sentry transport + k6 load test), accessibility, performance, observability, security hardening. All 24 golden journeys remain complete.)

**Earlier (real LLM agent, P2-05):** free-text WhatsApp messages are classified by a real hosted model (Anthropic/OpenAI/Google, admin-selected) with the deterministic rules as fallback; the AI only routes, never decides; a live "Test the agent" box at `/admin/ai` verifies it.

**Earlier (template studio, P0-09):** staff author, version and counsel-approve notice/agreement templates from `/admin/templates` with {placeholder} detection and preview; the notice engine still only instructs a counsel-approved version.

**Earlier (PDF export, GJ-14):** any sealed tenancy agreement downloads as a PDF at the public `GET /v1/verify/:reference/pdf`, carrying the title, body, content-hash seal, status, signatures and the verifier footer, rendered with the dependency-light pdf-lib; wired as a Download button on the public verifier page and per row on the admin documents board.

**Earlier (launch prep):** the error-reporter seam now forwards unexpected errors to Sentry through a small dependency-free envelope transport that activates only when `SENTRY_DSN` is set (DSN parsing + envelope building are unit-tested; the `configured` flag flips with the DSN, verified live); and a k6 load-test script (`scripts/load-test.js`, `pnpm load:test`) ramps virtual users against the health, metrics and batched board endpoints with p95-latency and error-rate thresholds, for a staging target. `.env.example` now documents the rate-limit and Sentry settings. Earlier the same day: accessibility (axe WCAG AA), performance (N+1 elimination), observability, security hardening. All 24 golden journeys remain complete.)

**Earlier this day (accessibility):** axe-core (WCAG 2.0/2.1 A + AA) now runs in the e2e suite across 10 public and admin surfaces, gated at zero serious/critical violations. The audit found and fixed real issues: the admin login and integrations-keys form fields had no programmatic labels (added `htmlFor`/`id` and `aria-label`), and several muted colours failed contrast (the sidebar "soon" items, and small text in the landing-page WhatsApp mock) and were darkened to meet AA. Earlier the same day: performance (admin-board N+1 elimination), observability, security hardening round 1. All 24 golden journeys remain complete.)

**Earlier this day (performance):** the admin boards no longer do N+1 reads. A per-row property/tenant lookup on each board (originations, close-outs, renewals, payments, condition checks, scope, buildings, intake, issues, notices, arrears, reconciliation, Landlord 360) is replaced by one batched query plus an in-memory join via a shared `LabelService`, so each board is now a constant number of round trips regardless of row count. Behaviour is unchanged (every board smoke assertion still passes). Earlier the same day: observability, then security hardening round 1. All 24 golden journeys remain complete.)

**Earlier this day (observability):** every request gets a stable id (reused from an inbound x-request-id or minted) echoed on the response and in logs; one structured log line per request (JSON in production) with method, path, status and duration; an in-process metrics endpoint at GET /v1/metrics (totals by status class, server errors, error rate, uptime, top routes); and an error-reporter seam that captures unexpected errors structured against the request id, ready for an external tracker behind SENTRY_DSN. Earlier the same day: security hardening round 1 (headers, rate limiting, no stack disclosure, no internal-error leakage). All 24 golden journeys remain complete. Recently: mixed-use buildings (GJ-24), CEO sign-off (GJ-18), NDPA access/erasure (GJ-19), scope of management (GJ-20), bulk intake (GJ-23), provider portal (GJ-10), renewals (GJ-22), condition checks (GJ-08), close-out (GJ-13), documents + e-signing + verifier (GJ-06/GJ-14), origination (GJ-05), WhatsApp as the landlord's surface + hardening + Meta webhook, payments GJ-12. All to the full-stack definition of done.)

**Verification state:** `pnpm verify` ✅ all green (type-check, lint, copy lint, 24 unit tests incl. rate-limiter, metrics, Sentry-transport, LLM prompt/parse and scheduler-dispatch tests, migration drift — no drift). `pnpm smoke` ✅ **262/262** on a freshly reset dev DB (adds the durable job queue, support inbox, landlord statement, QMS workbench, payment refund, staff notice/intake actions, on top of the earlier staff operational controls). `pnpm e2e` 37/39 in the full parallel run — the 2 that drop are render-only board tests timing out under the heavy `admin.spec` load; both pass in isolation, a known test-harness flake (Next dev-server cold-compile under concurrent load), not a product defect. The admin now has a working control action on every operational tab. Historic detail below: `pnpm smoke` 243/243 (adds 10 staff operational controls: set scope, add a building unit, record a paper signature, compare a condition check, add a deduction + settle a close-out, activate an origination, renew / decline / advance a renewal — each via the staff admin endpoints; plus the AI test endpoint routing a message to an intent and understanding a maintenance report via the fallback; the template studio: author a template with placeholder detection, preview renders with supplied + placeholder values, an unapproved template is withheld from the notice engine and offered only after counsel approval, a new version is appended unapproved; plus the sealed-document PDF download and 404; the batched boards; observability). `pnpm e2e` ✅ 35/35 (24 functional + 10 accessibility surfaces audited with axe-core, no serious/critical violations). Provider workspace, condition confirm, document verifier + tamper, tenant accept/pay were all verified live.

**Definition of done (production standard):** a feature is done only with (1) engine + guardrails, (2) API, (3) admin operational screen, (4) admin key/config control for any external adapter, (5) a user-facing surface wired to real buttons (web and/or WhatsApp), (6) landing-page buttons wired where relevant, (7) regression at API (smoke) and UI (Playwright) levels.

Legend: ✅ Done & tested · 🔧 In progress · ⬜ Not started · ⏸ Deferred (later by design)

---

## How to run and see it right now

```bash
cd ~/Downloads/Kiataker
pnpm dev          # starts the API (4000) and the web landing page (3000)
```

| Surface | URL | Status |
| --- | --- | --- |
| Landing page | http://localhost:3000 | ✅ live (redesigned: imagery, hero product card, effects) |
| Admin portal | http://localhost:3000/admin/login | ✅ live (staff: `operations@kiataker.ng` / `kiataker-dev`) |
| → Buildings | http://localhost:3000/admin/buildings | ✅ live (mixed-use buildings + unit regimes, GJ-24) |
| → Konnect & maintenance | http://localhost:3000/admin/konnect | ✅ live (admit Quotes, Work evidence) |
| → Rent & arrears | http://localhost:3000/admin/rent | ✅ live (record off-platform payment) |
| → Payments | http://localhost:3000/admin/payments | ✅ live (raise a checkout, see the split, settlements) |
| → Close-outs | http://localhost:3000/admin/closeouts | ✅ live (caution-fee outcomes, GJ-13) |
| → Tenant pay page | http://localhost:3000/pay/&lt;reference&gt; | ✅ live (public hosted checkout; test mode or Paystack) |
| → Notices | http://localhost:3000/admin/notices | ✅ live (status + truthful delivery) |
| → Reconciliation | http://localhost:3000/admin/reconciliation | ✅ live (staff reconcile disputes) |
| → Scope of management | http://localhost:3000/admin/scope | ✅ live (per-property service scope, GJ-20) |
| → Integrations & keys | http://localhost:3000/admin/ai | ✅ live (AI / WhatsApp / Paystack keys + LLM switch + fee) |
| → WhatsApp channel | http://localhost:3000/admin/whatsapp | ✅ live (templates, quiet hours, notification queue) |
| → CEO sign-off | http://localhost:3000/admin/sign-off | ✅ live (high-risk control changes await CEO sign-off, GJ-18) |
| → Data requests | http://localhost:3000/admin/ndpa | ✅ live (NDPA access/erasure board, decline with reason, GJ-19) |
| Data-request page | http://localhost:3000/data-request/&lt;token&gt; | ✅ live (public: confirm identity, see copy or erase, GJ-19) |
| → Bulk intake | http://localhost:3000/admin/intake | ✅ live (concierge capture + batch board, GJ-23) |
| → New tenancies | http://localhost:3000/admin/originations | ✅ live (origination gates board, GJ-05) |
| → Condition checks | http://localhost:3000/admin/condition | ✅ live (baseline/exit checks board, GJ-08) |
| → Renewals | http://localhost:3000/admin/renewals | ✅ live (renewal decisions + NTQ runway, GJ-22) |
| → Providers | http://localhost:3000/admin/providers | ✅ live (admit/reject Konnect providers, GJ-10) |
| Provider apply | http://localhost:3000/provider/apply | ✅ live (public: apply to join Konnect) |
| Provider workspace | http://localhost:3000/provider/&lt;token&gt; | ✅ live (quote open issues, deliver Work) |
| → Documents | http://localhost:3000/admin/documents | ✅ live (sealed documents + signatures board + PDF download) |
| → Template studio | http://localhost:3000/admin/templates | ✅ live (author/version/approve notice templates, P0-09) |
| Tenant accept page | http://localhost:3000/accept/&lt;token&gt; | ✅ live (public: review + accept new-tenancy terms) |
| Condition confirm page | http://localhost:3000/condition/&lt;token&gt; | ✅ live (public: confirm/dispute a condition check) |
| Intake confirm page | http://localhost:3000/intake/&lt;token&gt; | ✅ live (public: landlord confirms a bulk intake batch) |
| Document sign page | http://localhost:3000/sign/&lt;token&gt; | ✅ live (public: e-sign a sealed document) |
| Document verifier | http://localhost:3000/verify/&lt;reference&gt; | ✅ live (public: authenticity + tamper check + Download PDF) |
| API health | http://localhost:4000/v1/health | ✅ live |
| API metrics | http://localhost:4000/v1/metrics | ✅ live (request totals, status classes, error rate, uptime) |

Prove the engine end to end: `pnpm smoke` → **60/60 checks passing** (GJ-01..04, secure pages, admin access, rent, notices, maintenance, payments GJ-12, and the admin Command Centre boards + concierge actions). UI: `pnpm e2e` → **8/8** (after a one-time `pnpm e2e:install`).

---

## Release 1 progress by phase (PRD §48)

### Phase 0 — Foundations ✅ (core complete)
| ID | Task | Status |
| --- | --- | --- |
| P0-01 | Monorepo, workspace tooling, lint, type-check, test runners | ✅ |
| P0-01a | Local stack (Docker Compose), scripts (`setup`/`dev`/`verify`/`package`) | ✅ |
| P0-02 | CI pipeline with branch protection | ✅ (workflow written) |
| P0-03 | Terraform for staging and production | 🔧 (stubs + outline) |
| P0-04 | Database, Prisma, migration check, seed personas | ✅ |
| P0-05 | Outbox, job queue, scheduler, idempotency, audit | ✅ (outbox/idempotency/audit done; job queue + scheduler 🔧) |
| P0-06 | Identity for both channels (WhatsApp + app sign-in) | ✅ (app/code path; WhatsApp flows in Phase 2) |
| P0-07 | Organisations, five Command Centres, seats, roles, admin shell | 🔧 (data + seats seeded; Operations Command Centre is a **full operational control panel**, not a read-only dashboard: staff act concierge-style from every board — activate originations, add deductions + settle close-outs, send + compare condition checks, renew/decline/advance renewals, set scope, add building units, record paper signatures, admit/reject providers, approve/reject sign-offs and template versions, decline data requests, set keys + fees, toggle controls — each staff-audited; shared admin shell + nav; CEO/Product/Legal/Accounts centres marked "soon") |
| P0-08 | Platform controls and settings with risk levels | ✅ (engine + fail-closed checks; low/medium toggle from the Operations dashboard; HIGH-risk changes are proposed and held for **CEO sign-off** (GJ-18) with a two-person rule, applied only on approval, every step audited) |
| P0-09 | Design tokens and web component library, seven-state templates, template studio | 🔧 (template studio ✅ at /admin/templates: author/version/preview/counsel-approve NT/AG templates; tokens ✅; landing page polished ✅ (Mainstack-style: floating pill header, two-tone headlines, segmented pill tabs with coloured rounded "bubble" panels + roll-in, coloured App Store/Google Play badges, animated iPhone WhatsApp mock, QR, chips, full-bleed video, scroll reveal); every section a rounded coloured "bubble" with a Mainstack-style scroll-stack (each section fully visible, then the next scrolls up to replace it; sections taller than the screen scroll normally so nothing is cut off; static on mobile and for reduced-motion) + centred tab pills ✅; fully responsive across mobile/tablet/desktop incl. admin (sidebar collapses to a top bar, builder stacks) ✅; embedded live WhatsApp simulator section ✅; Terms/Privacy/Mandate + 404 ✅; Konnect page redesigned to bubble style + coloured icons ✅; visual admin LLM switch at /admin/ai ✅; CMS-driven renderer ✅; component library 🔧) |
| CMS | Level B visual page builder | ✅ (data model, API load/save/publish + image upload, block schema + renderer, default content; admin visual builder at /admin/pages/home: Layers with drag-reorder/duplicate/delete, Add-block palette of 13 block types, click-to-select live preview, per-block settings with text/rich-text/image-upload+library/toggles/repeaters + section style, Save draft / Publish / Preview. Verified end-to-end: edit → publish → live on the public site) |
| P0-10 | Copy registry and copy lint | ✅ |
| P0-11 | Adapters with fakes (WhatsApp, email, push, PSP, storage, scanner, AI) | 🔧 (fakes wired for auth; full adapter set 🔧) |
| P0-12 | Observability (Sentry, logs, metrics, uptime) | 🔧 (structured per-request logging with a request id, GET /v1/metrics for totals/status-classes/error-rate/uptime/top-routes, and a Sentry error-forward transport behind SENTRY_DSN — code complete and unit-tested; a live Sentry project + hosted dashboards/uptime monitors are the remaining deployment config) |
| P0-13 | Staging demo panel and build tracker | ✅ (this file) |
| P0-14 | Start Meta verification, template submission, Paystack terms | ⏸ (client dependency) |
| P0-15 | Mobile readiness (Expo shell) | ⏸ (Release 2) |

### Phase 1 — Engine and admin core 🔧 (well underway)
Property File, tenancy, secure pages, base truth, Action Centre, roles, import.
- ✅ Property File create → MANAGED (PROP, BP-01)
- ✅ Record existing tenancy + accuracy prompt (TEN, TEN-08)
- ✅ Base-truth affirmations + tenant confirm/dispute/correct (BT, BP-19)
- ✅ Action Centre projection from outbox + illegal-transition refusal (ACT)
- ✅ Action Centre poller on a 2s timer + overdue escalation sweep (ACT-11, ACT-12)
- ✅ Secure page engine (P1-05): hashed tokens, 7-day expiry, revocation, supersede, rate limit; tenant confirms via /t/:token
- ✅ Admin shell (P1-10): staff login, Operations Command Centre (overview, queue, controls, Landlord 360), staff-only guard
- ✅ Rent cycle (RENT, GJ-11): per-period charges, 30s scan marks overdue → Action Centre item; off-platform payment recording settles direct (BP-07) and closes the action from the qualifying event (ACT-04); rent status API. Action Centre now closes items on resolving events (payment, reconcile, confirm)
- ✅ Scope of management (SOM, SOM-01, GJ-20): the landlord agrees which services Kiataker manages per property (rent collection, maintenance, notices, inspections, renewals). A capability checks its service is in scope before it runs — e.g. reporting maintenance is refused when maintenance is out of scope — and a property with no explicit scope defaults to full management. Set from the landlord's WhatsApp (Full management / Rent only); staff board at `/admin/scope`.
- ✅ Mixed-use buildings (PROP, GJ-24): a building groups more than one unit, each a full managed Property with its own use. Flats are residential; shops, offices and warehouses are commercial; a building holding both is MIXED_USE, **derived from its units** (never asserted) and kept in step as units are added. Each unit resolves the regime that governs it (residential statute vs commercial lease), so notices and terms are handled by the right rules per unit while every other journey (tenancy, rent, notices, close-out) works on a unit unchanged. Set up from the landlord's WhatsApp ("Set up a building" → add a flat / add a shop); staff board at `/admin/buildings`.
- ✅ Reconciliation admin queue (staff reconcile a disputed tenancy, concierge; GJ-04)
- ✅ Rent & arrears Command Centre (arrears board; staff record off-platform payment on the landlord's behalf)
- ✅ Concierge / bulk intake (INT, GJ-23, PROP-09/10): staff capture many tenancies from photographed agreements or a spreadsheet into a batch; the landlord confirms it on a secure link (their accuracy acknowledgement, BP-19), and only then are the properties + tenancies created in one commit (idempotent; a rejected batch cannot be committed). Capture + board at `/admin/intake`; landlord confirms at `/intake/:token`.

### Phase 2 — WhatsApp portal 🔧 (conversation engine live)
Conversation engine, flow state machines, templates, inbox, notifications.
- ✅ Conversation engine (P2-01): inbound handling, session persistence (resume), message log, auto-provision on first contact (account + combined Terms acceptance)
- ✅ AI understanding (P2-05, BP-11, SECU-13): free-text messages are classified into an intent by a **real hosted LLM when one is configured** (Anthropic / OpenAI / Google, admin-selected, called over plain fetch in `llm.util.ts`), with the deterministic rules as the always-on fallback on no-key/error/timeout. The AI is strictly constrained: it returns one label from a fixed list, the message is treated as data (prompt-injection-resistant parsing), and the engine acts on the label with its own guards, so the AI only routes and never decides. Verify it live from the "Test the agent" box at `/admin/ai` (or `POST /internal/ai/test`): it reports the intent and whether the LLM or the rules handled it. The hosted path needs the operator's API key; locally the deterministic engine runs with no key.
- ✅ Flows: greeting/menu, add property (creates a real Property File), record tenancy (end to end + tenant notify), send a notice (GJ-21: instruct in chat → secure-page approval link → dispatch), my decisions (Action Centre), my properties, help, talk to a person
- ✅ Secure-page web UI at `/t/[token]`: tenant confirm/dispute/correct and landlord notice approval, with NDPA privacy note (the chat-to-secure-page hand-off, BP-09)
- ✅ Local WhatsApp simulator (PRD §44.1): interactive chat at `/simulator` AND embedded on the landing page ("Experience the technology"); works in production (calls the live engine)
- ✅ Admin LLM + integrations control (`/admin/ai`): switch AI provider/model (fake/Anthropic/OpenAI/Google) with no code change; a "What's in place" status panel (AI / WhatsApp channel / Payments with LIVE or NEEDS KEYS); enter API keys (AI provider key, WhatsApp Meta credentials, Paystack) stored masked in settings. The AI stays a constrained tool (BP-11, SECU-13)
- ✅ WhatsApp is the landlord's surface (decision): chat flows for add property, record tenancy, send notice, **report a problem** (GJ-09 in chat), **my issues** (compare Quotes, accept a Quote, accept completed Work — BP-12), **collect rent** (GJ-12 in chat: raises a checkout and returns the pay link to forward), my decisions, my properties. Landlords run everything from chat; no landlord web app by design.
- ✅ Meta Cloud API webhook (go-live): `GET /whatsapp/webhook` subscription handshake (verify-token match) and `POST /whatsapp/webhook` with **X-Hub-Signature-256 HMAC verification** (bad signatures rejected), parsing text + interactive replies and routing into the same engine; live mode sends replies back through the Cloud API. The local simulator keeps working unchanged.
- ✅ WhatsApp guardrails (GJ-16, BP-08/10): the whole channel fails closed behind `channel.whatsapp`; collect-rent is gated behind the HIGH-risk `channel.whatsapp.arrears` control (off by default) and politely refuses until switched on; higher-risk steps (notice approval) already hand off to a secure page. Controls are toggled from the admin, with a required reason + audit for HIGH-risk ones.
- ✅ Message template library + quiet hours + proactive notification queue (admin at `/admin/whatsapp`): create a template, submit for approval, record Meta's APPROVED/REJECTED decision. A proactive notification is skipped unless its template is approved, and in quiet hours it is deferred to the next open window (never dropped); processing flushes the queue once the window opens. Replies to inbound messages are never gated. Live mode sends via the Cloud API.
- ✅ Resume-after-disconnect (GJ-17): a half-finished chat flow persists (session with resume window) and completes on return; a stale duplicate reply after completion creates nothing.
- ⬜ Full WAF flow catalogue, support inbox, broader notification triggers; real Meta credentials + number + template approval (client dependency)

### Phase 3 — Documents and new tenancies 🔧 (notices started)
Template studio, PDF/hashing/sealing, signing, public verifier, origination, notices,
Condition Checks, Notice to Quit Runway and renewals.
- ✅ New-tenancy origination (ORIGINATION route, GJ-05): a draft tenancy (EXPECTED occupancy) passes every gate — terms set, tenant accepted on a secure link (`/accept/:token`, BP-19), caution fee settled or waived — then **activates atomically** (occupancy → ACTIVE, tenancy → MANAGED, rent schedule generated) only when all gates are green, and idempotently. Started from the landlord's WhatsApp ("Set up a new tenancy" → accept link; "New tenancies in progress" → activate). Staff board at `/admin/originations`.
- ✅ Notice engine (NOT, GJ-07): counsel-approved templates (NT codes); instruct → approve on a secure page (higher-risk hand-off, BP-09) → generate with a content hash (sealed) → dispatch → delivery recorded truthfully ("sent, not confirmed", BP-16) → request physical service (CP-08). Issued by KIA TAKER LTD as the landlord's agent.
- ✅ Notices Command Centre (staff board: every notice with status, truthful delivery and content-hash seal; instruction/approval stay on the landlord's side)
- ✅ Renewals + Notice to Quit Runway (REN, GJ-22): a renewal window lists tenancies nearing expiry with the last safe date to serve a notice to quit; the landlord renews (a new term + extended expiry, status RENEWED) or declines, which opens a staged possession runway (NOTICE_TO_QUIT → NOTICE_SERVED → POSSESSION_READY) that advances one stage at a time and stops at the last. Driven from the landlord's WhatsApp ("Renewals due"); staff board at `/admin/renewals`. The notice itself is served through the notice engine (GJ-07).
- ✅ Condition checks (COND, GJ-08): a handover baseline (areas + condition + notes) the tenant confirms or disputes on a secure link (BP-19), and an exit check at move-out that is compared to the confirmed baseline, flagging each changed area so close-out deductions rest on agreed evidence. Captured from the landlord's WhatsApp ("Condition check"); staff board at `/admin/condition`.
- ✅ Sealed documents + e-signing + public verifier (DOC, GJ-06, GJ-14): generate a tenancy agreement, seal it with a SHA-256 content hash, collect e-signatures on secure links (and paper-upload signatures), and mark it SIGNED once every signer is in. Anyone can verify it publicly at `/verify/:reference`, with a **tamper check** that re-hashes a supplied copy against the seal, and **download it as a PDF** at `/verify/:reference/pdf` (the seal, status, signatures and verifier footer travel on the page; rendered with pdf-lib). Drafted from the landlord's WhatsApp ("Draft an agreement" → verify + sign links). Staff board at `/admin/documents` with a per-row PDF download.
- ✅ Template studio (TPL, P0-09): staff author notice/agreement templates (NT/AG codes) from `/admin/templates` — create a template (with automatic `{placeholder}` detection), add append-only versions, preview a version rendered with sample values, and record counsel approval. The notice engine instructs only a counsel-approved version (unchanged), so the studio is the controlled authoring surface in front of that gate; every change is audited.

### Phase 4 — Konnect, money, Information, close-out, QMS 🔧 (maintenance started)
Provider web link, Quotes/Work, Paystack + fees, Information outputs, close-out, QMS,
landing-page completion.
- ✅ Maintenance + Konnect Work (MNT/KON, GJ-09): landlord reports an issue; staff admit sealed Quotes (concierge; the provider portal does this in Phase 4); landlord compares and accepts a Quote; Work starts; provider submits completion with evidence; a provider claim never closes the Work, landlord acceptance does (BP-12). Vocabulary is Work and Quote.
- ✅ Close-out with the caution-fee outcome (CLOSE, GJ-13): ending a tenancy records the vacate and ends the tenancy; the caution fee is settled by recording deductions (arrears, damage, works) and computing the outcome — full refund, partial refund or forfeit. Any refund is recorded (the landlord returns it directly; Kiataker holds nothing, BP-07) and settlement is idempotent. Started from the landlord's WhatsApp ("End a tenancy" / "Close-outs in progress"). Staff board at `/admin/closeouts`.
- ✅ Konnect Command Centre (staff board: admit sealed Quotes, record Work completion with evidence; the landlord-acceptance guardrail is shown in the UI, BP-12)
- ✅ Paystack key + fee control in Integrations & keys (secret + public key entry, masked; admin-set coordination fee 0–20% that drives the split; payments stay behind their own control, BP-07)
- ✅ On-platform payments (PAY, GJ-12): a landlord/staff raise a checkout for a due charge; the split is computed up front (net to landlord + Kiataker fee, admin-configurable, default 5%); the tenant pays on a public hosted page; a **signed, idempotent** Paystack webhook settles it (bad signatures rejected), marks the charge PAID, issues a receipt and closes the action. PSP adapter is fake (test) / paystack (live, behind `payments.live`). Kiataker never holds the money (BP-07). Admin Payments Command Centre shows every split and status.
- ✅ Provider self-service portal (KON, GJ-10): a provider applies (public), staff admit or reject them from `/admin/providers`, and an admitted provider works from a token-gated workspace — they see open issues, submit Quotes, and deliver Work with evidence. The provider Quote flows into the same landlord-accept path (BP-12: the landlord closes the Work, not the provider). Replaces the concierge Quote step with self-service.
- ⬜ Paystack subaccount provisioning (live split destination) + refunds, Information outputs, QMS workbench

- ✅ Control change with CEO sign-off (GOV, GJ-18, BP-08, P0-08): a high-risk platform control is never toggled on the spot. Any staff **propose** the change (with a reason); it is held as a pending request and the control does not move; a **CEO Command Centre** seat holder then signs it off (applied atomically) or declines (control untouched), and the person who proposed it cannot sign off their own (a two-person rule, separation of duties). Low and medium controls still apply immediately. A duplicate pending change for the same control is refused, and every step is audited. Proposed from the Operations dashboard (the toggle becomes "Propose on/off"); decided from the CEO sign-off queue at `/admin/sign-off`. The arrears control and payments-live now open through this path.
- ✅ NDPA data-subject rights (DSR, GJ-19, NDPA 2023 ss.34-37): a person asks for a copy of the personal data Kiataker holds about them (access) or for it to be erased, from their WhatsApp ("My data rights" → Get my data / Erase my data) or raised by staff on their behalf. Identity is proven on a secure link (BP-09) before anything is disclosed or erased. Access assembles the copy — profile, contact details, properties, agreements, conversation count — and lists what is kept under a legal basis. Erasure anonymises the person (name + sign-in cleared, contact details overwritten and unlinked, conversations deleted, sessions revoked, account marked ERASED) but keeps audit and financial/tenancy records the law requires, saying which and why. Idempotent; staff can decline with a reason. The feature fails closed behind `compliance.ndpa` (BP-08). Staff board at `/admin/ndpa`; secure page at `/data-request/:token`.

### Phase 5 — Release 1 hardening and launch 🔧 (security + observability + performance + accessibility done)
- ✅ Security hardening, round 1 (§34): security response headers on every reply via a dependency-free middleware (Content-Security-Policy `default-src 'none'`, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer, Cross-Origin-Opener/Resource-Policy, Permissions-Policy, and HSTS in production); `x-powered-by` disabled so the stack is not advertised; a per-IP fixed-window rate limiter with a tighter bucket for `/v1/auth/*`, env-configurable (`RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_WINDOW_MS`), exempting health and returning the standard error shape plus `X-RateLimit-*` / `Retry-After` on a 429; and the global error filter no longer leaks an internal exception's message or stack (generic 500 to the client, the real cause logged server-side against a request id echoed in `x-request-id`). Proven by a deterministic rate-limiter unit test and smoke header checks.
- ✅ Observability (§44, P0-12): a request-id middleware reuses an inbound `x-request-id` or mints one, echoes it on every response, and logs one structured line per request (JSON in production) with method, path, status and duration; `MetricsService` aggregates request totals by status class, server errors, error rate, slowest request, uptime and a bounded top-routes tally (ids collapsed), exposed read-only at `GET /v1/metrics` for status pages and scrapers; and an `ErrorReporter` seam captures unexpected errors as a structured event tied to the request id, ready to forward to an external tracker behind `SENTRY_DSN` (dependency-free until the SDK is dropped in at the seam). Proven by metrics unit tests and smoke checks.
- ✅ Performance — admin board N+1 elimination (§44): every admin board used to resolve a property or tenant name with a query per row (an N+1 that got slow on large data). A shared, batched `LabelService` (one `findMany … where id in […]` for properties, one for tenancies-with-tenant) plus in-memory joins replace those per-row reads across originations, close-outs, renewals, payments, condition checks, scope, buildings, intake, maintenance issues, notices, arrears, reconciliation and Landlord 360; grouped counts (tenancies per landlord, quotes per issue) use `groupBy` instead of a loop. Each board is now a constant number of round trips. Verified behaviour-preserving by the existing board smoke + e2e assertions.
- ✅ Accessibility (WCAG 2.0/2.1 A + AA): `@axe-core/playwright` runs in the e2e suite (`e2e/a11y.spec.ts`) over 10 public and admin surfaces (landing, admin login, provider apply, document verifier, dashboard, buildings, sign-off, data requests, integrations-keys forms, bulk intake), gated at zero serious/critical violations. Fixed what it found: form fields on the admin login and integrations-keys pages had no programmatic label (added `htmlFor`/`id` and `aria-label` to inputs, selects and the textarea), and muted colours below the AA contrast ratio (sidebar "soon" items at 2.5:1, and 9-12px text in the landing-page WhatsApp mock) were darkened to pass.
- ✅ Launch prep scaffolding: a dependency-free Sentry error-forward transport ([`sentry.util.ts`](apps/api/src/common/observability/sentry.util.ts)) wired at the error-reporter seam — parses the DSN, builds the envelope, POSTs the event (fire-and-forget), active only when `SENTRY_DSN` is set; DSN parse + envelope build are unit-tested and the `configured` flag was verified to flip with the DSN. A k6 load-test script ([`scripts/load-test.js`](scripts/load-test.js), `pnpm load:test`) ramps to 50 VUs against health, metrics and the batched boards with p95 (<500ms, <800ms for boards) and error-rate (<1%) thresholds. `.env.example` documents the new settings.
- ⬜ Remaining (needs a real environment, not code): run the load test against staging, a penetration test, a restore/backup drill, a live Sentry project + hosted dashboards/uptime monitors, Terraform for staging/production (P0-03), production cut-over.

## Release 2
### Phase 6 — Mobile apps (iOS + Android) ⏸
Expo app on the same API, offline capture, push, store submission.

---

## Golden journeys (PRD §49) — each becomes an automated test

| # | Journey | Status |
| --- | --- | --- |
| GJ-01 | Sign up, verify, accept Terms + Mandate, recover access | ✅ (smoke; recovery 🔧) |
| GJ-02 | Create a Property File and reach MANAGED | ✅ (smoke) |
| GJ-03 | Record an existing tenancy, notify, tenant confirms | ✅ (smoke) |
| GJ-04 | Tenant disputes; landlord reconciles | ✅ (smoke; reconcile endpoint done) |
| GJ-05 | New tenancy through every gate to atomic activation | ✅ (smoke + e2e + live accept page) |
| GJ-06 | Sign by e-signature and by paper upload | ✅ (smoke: e-sign both parties; paper-upload path) |
| GJ-07 | Instruct, approve and dispatch a notice | ✅ (smoke) |
| GJ-08 | Handover Baseline condition check chain | ✅ (smoke: baseline→confirm→exit→compare; live confirm) |
| GJ-09 | Report an issue, Quote, Work with evidence | ✅ (smoke + chat flow + e2e) |
| GJ-10 | Provider applies, is admitted, quotes, delivers | ✅ (smoke + e2e + live quote) |
| GJ-11 | Rent due, overdue, payment recorded | ✅ (smoke) |
| GJ-12 | Invoice paid through a split (test mode) | ✅ (smoke + e2e + live; raised from chat) |
| GJ-13 | Close-out with Caution Fee outcome | ✅ (smoke: refund/partial/forfeit + e2e board) |
| GJ-14 | Generate a document, verify it publicly, tamper check | ✅ (smoke + e2e + live tamper check) |
| GJ-15 | Onboard and decide from WhatsApp alone | ✅ (smoke + live: onboard, record, report, collect, decide in chat) |
| GJ-16 | WhatsApp guardrails (arrears off, secure-page handoff) | ✅ (smoke: channel + arrears gates fail closed; notice handoff) |
| GJ-17 | Lose connection mid-capture, resume, no duplicate | ✅ (smoke) |
| GJ-18 | Control change with CEO sign-off | ✅ (smoke: propose→hold→CEO sign-off applies; non-CEO + self-approval refused; reject leaves it put + e2e queue) |
| GJ-19 | NDPA access and erasure requests | ✅ (smoke: access disclose + idempotent, erasure anonymises via chat, staff decline, control fail-closed + e2e board) |
| GJ-20 | SOM-01 scope of management | ✅ (smoke: default→rent-only gates maintenance + e2e) |
| GJ-21 | Quick notice in WhatsApp, service end to end | ✅ (verified) |
| GJ-22 | Renewal window, Notice to Quit Runway | ✅ (smoke: window→renew/decline→runway stages + e2e) |
| GJ-23 | Bulk intake from photographed agreements | ✅ (smoke: capture→confirm→commit + reject + e2e) |
| GJ-24 | Mixed-use building (flats and shops) | ✅ (smoke: flat + shop derives MIXED_USE, per-unit regime + chat + e2e board) |

---

## What's next (immediate)

**All 24 golden journeys (GJ-01 to GJ-24) are now built to the full-stack definition of done** and covered by regression (smoke 221, e2e 34, verify green with 13 unit tests). **Phase 5's code-complete work is done** — security hardening, observability (incl. the Sentry transport), performance (admin-board N+1 elimination), accessibility (axe WCAG AA), and the load-test script. Everything left needs a real environment, not code. Decision in force: **WhatsApp is the landlord's surface** (no landlord web app by design).

1. **Phase 5 — needs a target environment, not code:** run the k6 load test against staging, a penetration test, a restore/backup drill, a live Sentry project + hosted dashboards/uptime monitors, production cut-over and Terraform for staging/production (P0-03).
2. **Client dependencies:** WhatsApp go-live (live Meta credentials, the business number, template approval in Meta Business Manager); Paystack subaccount provisioning so the split's net has a real destination per landlord, and refunds.
4. **Nice-to-have (optional code):** broader proactive WhatsApp triggers (auto-notify the landlord on tenant response/payment) wired to the existing notification queue; Information outputs and the QMS workbench (Phase 4 tail).
