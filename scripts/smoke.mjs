#!/usr/bin/env node
// Kiataker smoke test. Drives the golden-journey slice end to end over HTTP against a
// running API: GJ-01 (sign up + verify + accept terms), GJ-02 (property to MANAGED),
// GJ-03 (record a tenancy + notify + tenant confirms), GJ-04 (dispute raises an action).
import { createHmac } from "node:crypto";

const BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
const V1 = `${BASE}/v1`;
// Mirror of FAKE_PSP_SECRET in apps/api/src/modules/payments/psp.service.ts.
const FAKE_PSP_SECRET = "kiataker-fake-psp-secret";

/** Post a PSP webhook with an exact-bytes body and a matching (or deliberately wrong) signature. */
async function postWebhook(payload, { valid = true } = {}) {
  const raw = JSON.stringify(payload);
  const sig = valid ? createHmac("sha256", FAKE_PSP_SECRET).update(raw).digest("hex") : "deadbeef";
  const res = await fetch(`${V1}/payments/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-paystack-signature": sig },
    body: raw,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
};

async function call(method, path, body, token) {
  const res = await fetch(`${V1}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

/** Drive the WhatsApp engine through the simulator entry (same engine the Meta webhook uses). */
async function chat(from, msg) {
  const res = await call("POST", "/whatsapp/inbound", { from, ...msg });
  return res.json;
}
function findItemId(messages, prefix) {
  for (const m of messages ?? []) {
    if (m.type === "list") { const it = m.items.find((i) => i.id.startsWith(prefix)); if (it) return it.id; }
    if (m.type === "buttons") { const b = m.buttons.find((x) => x.id.startsWith(prefix)); if (b) return b.id; }
  }
  return null;
}
const chatText = (messages) => (messages ?? []).map((m) => m.text).join("\n");

async function main() {
  console.log(`Kiataker smoke test against ${V1}\n`);

  const health = await call("GET", "/health");
  ok("health is ok", health.json.status === "ok");

  // Phase 5 hardening: security headers and rate-limit headers are present on every response.
  const headRes = await fetch(`${V1}/health`);
  ok("response sets X-Content-Type-Options nosniff", headRes.headers.get("x-content-type-options") === "nosniff");
  ok("response denies framing", headRes.headers.get("x-frame-options") === "DENY");
  ok("response sets a content security policy", (headRes.headers.get("content-security-policy") ?? "").includes("default-src 'none'"));
  ok("response does not advertise the server stack", !headRes.headers.get("x-powered-by"));
  const rootRes = await fetch(`${V1}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  ok("auth responses carry rate-limit headers", rootRes.headers.get("x-ratelimit-limit") !== null && rootRes.headers.get("x-ratelimit-remaining") !== null);

  // Phase 5 observability: every response carries a request id, and metrics are exposed read-only.
  ok("every response carries a request id", !!headRes.headers.get("x-request-id"));
  const metrics = await call("GET", "/metrics");
  ok("metrics endpoint reports request totals", metrics.status === 200 && metrics.json.requests.total > 0 && typeof metrics.json.uptimeSeconds === "number");
  ok("metrics classify responses by status", typeof metrics.json.requests.byStatusClass["2xx"] === "number");
  ok("metrics report whether error tracking is configured", typeof metrics.json.errorReporting.configured === "boolean");

  // GJ-01: sign up, verify, accept Terms + Mandate + Privacy
  const phone = "+23480" + Math.floor(10000000 + Math.random() * 89999999);
  const signup = await call("POST", "/auth/signup", {
    displayName: "Test Landlord",
    channel: "WHATSAPP",
    phone,
  });
  ok("signup returns a participant", !!signup.json.participantId);
  ok("signup returns a dev code (fake adapter)", !!signup.json.devCode);

  const verify = await call("POST", "/auth/code/verify", {
    channel: "WHATSAPP",
    target: phone,
    code: signup.json.devCode,
  });
  ok("verify returns tokens", !!verify.json.accessToken);
  const token = verify.json.accessToken;

  const terms = await call("GET", "/terms/current");
  ok("terms lists three documents", Array.isArray(terms.json) && terms.json.length >= 3);
  const accept = await call(
    "POST",
    "/account/agreements",
    { termsVersionIds: terms.json.map((t) => t.termsVersionId) },
    token,
  );
  ok("terms accepted", accept.json.accepted === true);

  const me = await call("GET", "/auth/me", undefined, token);
  ok("me returns the landlord", me.json.kind === "LANDLORD");

  // GJ-02: create a Property File, reach MANAGED
  const prop = await call(
    "POST",
    "/properties",
    { addressRaw: "15 Test Street, Yaba, Lagos", buildingUse: "RESIDENTIAL", acceptMandate: true },
    token,
  );
  ok("property created and MANAGED", prop.json.state === "MANAGED");
  ok("property has a reference", /^KT-\d{4}-/.test(prop.json.reference ?? ""));

  // GJ-03: record an existing tenancy, notify, tenant confirms
  const ten = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Test Tenant", whatsapp: "+2348031111111" },
      terms: {
        rentKobo: "100000000",
        frequency: "annual",
        commencementDate: "2025-01-01T00:00:00.000Z",
        expiryDate: "2026-12-31T00:00:00.000Z",
      },
      accuracyAcknowledged: true,
    },
    token,
  );
  ok("tenancy recorded", ten.json.status === "RECORDED");

  const notify = await call("POST", `/tenancies/${ten.json.id}/notify`, {}, token);
  ok("tenancy notified", notify.json.status === "TENANT_NOTIFIED");

  const confirm = await call("POST", `/tenancies/${ten.json.id}/tenant-response`, { kind: "CONFIRM" });
  ok("tenant confirmed", confirm.json.status === "TENANT_CONFIRMED");

  // Illegal transition is refused (state machine, §41.4)
  const illegal = await call("POST", `/tenancies/${ten.json.id}/notify`, {}, token);
  ok("illegal transition refused with 409", illegal.status === 409);

  // GJ-04: a second tenancy, tenant disputes, an Act Now action appears
  const ten2 = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Second Tenant", whatsapp: "+2348032222222" },
      terms: {
        rentKobo: "50000000",
        frequency: "annual",
        commencementDate: "2025-01-01T00:00:00.000Z",
        expiryDate: "2026-12-31T00:00:00.000Z",
      },
      accuracyAcknowledged: true,
    },
    token,
  );
  await call("POST", `/tenancies/${ten2.json.id}/notify`, {}, token);
  await call("POST", `/tenancies/${ten2.json.id}/tenant-response`, { kind: "DISPUTE" });
  const summary = await call("GET", "/actions/summary", undefined, token);
  ok("a dispute raises an Act Now item", summary.json.act >= 1 && summary.json.allClear === false);

  // Phase 1: secure page engine (SEC). Notify issues a secure task; tenant confirms via /t/:token.
  const ten3 = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Third Tenant", whatsapp: "+2348033333333" },
      terms: {
        rentKobo: "75000000",
        frequency: "annual",
        commencementDate: "2025-01-01T00:00:00.000Z",
        expiryDate: "2026-12-31T00:00:00.000Z",
      },
      accuracyAcknowledged: true,
    },
    token,
  );
  const notify3 = await call("POST", `/tenancies/${ten3.json.id}/notify`, {}, token);
  const secureToken = notify3.json.secureTaskToken;
  ok("notify issues a secure task token", !!secureToken);

  const taskView = await call("GET", `/t/${secureToken}`);
  ok("secure page resolves to a tenant-confirm task", taskView.json.purpose === "TENANT_CONFIRM");

  const taskConfirm = await call("POST", `/t/${secureToken}/respond`, { kind: "CONFIRM" });
  ok("tenant confirms via the secure page", taskConfirm.json.status === "TENANT_CONFIRMED");

  const reuse = await call("POST", `/t/${secureToken}/respond`, { kind: "CONFIRM" });
  ok("a used secure link is refused (409)", reuse.status === 409);

  const badLink = await call("GET", "/t/not-a-real-token");
  ok("an invalid secure link is refused", badLink.status === 404);

  // Phase 1: admin (staff only).
  const staffLogin = await call("POST", "/auth/login", {
    email: "operations@kiataker.ng",
    password: "kiataker-dev",
  });
  ok("staff can sign in to the admin", !!staffLogin.json.accessToken);
  const staffToken = staffLogin.json.accessToken;

  // The CEO Command Centre staff sign off high-risk control changes (GJ-18).
  const ceoLogin = await call("POST", "/auth/login", { email: "ceo@kiataker.ng", password: "kiataker-dev" });
  const ceoToken = ceoLogin.json.accessToken;
  ok("the CEO can sign in to the admin", !!ceoToken);

  const overview = await call("GET", "/internal/overview", undefined, staffToken);
  ok("admin overview returns counts", typeof overview.json.landlords === "number" && overview.json.landlords >= 1);

  const landlordBlocked = await call("GET", "/internal/overview", undefined, token);
  ok("a landlord cannot reach the admin (403)", landlordBlocked.status === 403);

  // GJ-11: rent cycle. Rent due, overdue, payment recorded with proof, actions close.
  const actBefore = (await call("GET", "/actions/summary", undefined, token)).json.act;
  const past = new Date();
  past.setMonth(past.getMonth() - 3);
  const rentExpiry = new Date();
  rentExpiry.setFullYear(rentExpiry.getFullYear() + 1);
  const ten4 = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Rent Tenant", whatsapp: "+2348034444444" },
      terms: { rentKobo: "20000000", frequency: "monthly", commencementDate: past.toISOString(), expiryDate: rentExpiry.toISOString() },
      accuracyAcknowledged: true,
    },
    token,
  );
  const rentStatus = await call("GET", `/tenancies/${ten4.json.id}/rent`, undefined, token);
  ok("rent shows an overdue charge", rentStatus.json.overdueCount >= 1);

  const actAfter = (await call("GET", "/actions/summary", undefined, token)).json.act;
  ok("overdue rent raises an Act Now item", actAfter > actBefore);

  const pay = await call("POST", "/payments/off-platform", { tenancyId: ten4.json.id, amountKobo: "20000000", reference: "TRF-001" }, token);
  ok("off-platform payment recorded", pay.json.recorded === true);

  const actClosed = (await call("GET", "/actions/summary", undefined, token)).json.act;
  ok("recording payment closes the rent action", actClosed < actAfter);

  // GJ-07: notices. Instruct, approve on a secure page, dispatch, delivery unconfirmed, physical service.
  const templates = await call("GET", "/notices/templates", undefined, token);
  ok("counsel-approved notice templates exist", Array.isArray(templates.json) && templates.json.length >= 1);
  const tmpl = templates.json.find((t) => t.code === "NT-02") ?? templates.json[0];

  const instruct = await call("POST", "/notices", { tenancyId: ten.json.id, templateVersionId: tmpl.templateVersionId, effectiveDate: rentExpiry.toISOString() }, token);
  ok("notice instructed", instruct.json.notice?.status === "INSTRUCTED");
  ok("approval needs a secure page", !!instruct.json.secureTaskToken);

  const noticeTask = await call("GET", `/t/${instruct.json.secureTaskToken}`);
  ok("secure page is a notice approval", noticeTask.json.purpose === "APPROVE_NOTICE");

  const approve = await call("POST", `/t/${instruct.json.secureTaskToken}/respond`, { approve: true });
  ok("approving dispatches the notice", approve.json.status === "DISPATCHED");
  ok("electronic delivery recorded but unconfirmed", approve.json.delivery?.status === "sent, not confirmed");
  ok("the notice has a content hash (sealed)", !!approve.json.contentHash);

  const phys = await call("POST", `/notices/${instruct.json.notice.id}/physical-service`, {}, token);
  ok("physical service can be requested", phys.json.requested === true);

  // GJ-09: maintenance. Report an issue, sealed Quote, accept, Work with evidence, landlord acceptance.
  const issue = await call("POST", "/issues", { propertyId: prop.json.id, category: "Plumbing", description: "Leaking kitchen tap", urgency: "NORMAL" }, token);
  ok("issue reported", issue.json.status === "REPORTED");

  const quote = await call("POST", `/internal/issues/${issue.json.id}/quotes`, { providerName: "SafeFix Services", amountKobo: "4500000", scope: "Replace tap and seals" }, staffToken);
  ok("staff admit a sealed Quote", !!quote.json.id);

  const issueView = await call("GET", `/issues/${issue.json.id}`, undefined, token);
  ok("landlord sees the Quote", issueView.json.quotes.length >= 1);

  const acceptQ = await call("POST", `/issues/${issue.json.id}/quotes/${quote.json.id}/accept`, {}, token);
  ok("accepting a Quote starts the Work", acceptQ.json.status === "IN_PROGRESS");
  const workId = acceptQ.json.workId;

  const evid = await call("POST", `/internal/work/${workId}/evidence`, { evidence: { photos: 2, note: "Tap replaced" } }, staffToken);
  ok("provider submits completion with evidence", evid.json.status === "COMPLETION_SUBMITTED");

  const issueMid = await call("GET", `/issues/${issue.json.id}`, undefined, token);
  ok("a provider claim does not close the Work (BP-12)", issueMid.json.work.status === "COMPLETION_SUBMITTED");

  const acceptW = await call("POST", `/work/${workId}/accept`, {}, token);
  ok("landlord acceptance completes the Work", acceptW.json.status === "COMPLETED");

  // Admin Command Centre boards (staff operational surfaces backfilled for GJ-07/09/11/04).
  const issuesBoard = await call("GET", "/internal/board/issues", undefined, staffToken);
  ok("Konnect board lists the issue", Array.isArray(issuesBoard.json) && issuesBoard.json.some((i) => i.id === issue.json.id));

  const issueBoardDetail = await call("GET", `/internal/board/issues/${issue.json.id}`, undefined, staffToken);
  ok("Konnect board shows the issue's Quotes and Work", issueBoardDetail.json.quotes?.length >= 1 && issueBoardDetail.json.work?.status === "COMPLETED");

  const noticesBoard = await call("GET", "/internal/board/notices", undefined, staffToken);
  ok("Notices board lists the dispatched notice", Array.isArray(noticesBoard.json) && noticesBoard.json.some((n) => n.id === instruct.json.notice.id));

  const boardsNeedStaff = await call("GET", "/internal/board/issues", undefined, token);
  ok("a landlord cannot read the admin boards (403)", boardsNeedStaff.status === 403);

  // Reconciliation queue + staff reconcile (concierge). ten2 was disputed earlier (GJ-04).
  const reconQueue = await call("GET", "/internal/board/reconciliations", undefined, staffToken);
  ok("reconciliation queue lists the disputed tenancy", Array.isArray(reconQueue.json) && reconQueue.json.some((d) => d.tenancyId === ten2.json.id));

  const staffReconcile = await call("POST", `/internal/tenancies/${ten2.json.id}/reconcile`, {}, staffToken);
  ok("staff reconcile a disputed tenancy (concierge)", staffReconcile.json.status === "RECONCILED");

  const reconQueueAfter = await call("GET", "/internal/board/reconciliations", undefined, staffToken);
  ok("the reconciled tenancy leaves the queue", !reconQueueAfter.json.some((d) => d.tenancyId === ten2.json.id));

  // Arrears board + staff record payment (concierge). Fresh overdue tenancy.
  const pastRent = new Date();
  pastRent.setMonth(pastRent.getMonth() - 3);
  const rentExp2 = new Date();
  rentExp2.setFullYear(rentExp2.getFullYear() + 1);
  const ten5 = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Arrears Tenant", whatsapp: "+2348035555555" },
      terms: { rentKobo: "30000000", frequency: "monthly", commencementDate: pastRent.toISOString(), expiryDate: rentExp2.toISOString() },
      accuracyAcknowledged: true,
    },
    token,
  );
  await call("GET", `/tenancies/${ten5.json.id}/rent`, undefined, token); // generates + marks overdue

  const arrears = await call("GET", "/internal/board/arrears", undefined, staffToken);
  ok("arrears board lists the overdue tenancy", Array.isArray(arrears.json) && arrears.json.some((a) => a.tenancyId === ten5.json.id));

  const staffPay = await call("POST", "/internal/rent/record", { tenancyId: ten5.json.id, amountKobo: "30000000", reference: "STAFF-TRF-001" }, staffToken);
  ok("staff record an off-platform payment (concierge)", staffPay.json.recorded === true);

  // GJ-12: on-platform payment through a Paystack split (test mode). Fresh overdue tenancy.
  const pastRent2 = new Date();
  pastRent2.setMonth(pastRent2.getMonth() - 2);
  const rentExp3 = new Date();
  rentExp3.setFullYear(rentExp3.getFullYear() + 1);
  const ten6 = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Online Tenant", whatsapp: "+2348036666666" },
      terms: { rentKobo: "25000000", frequency: "monthly", commencementDate: pastRent2.toISOString(), expiryDate: rentExp3.toISOString() },
      accuracyAcknowledged: true,
    },
    token,
  );
  await call("GET", `/tenancies/${ten6.json.id}/rent`, undefined, token); // generate + mark overdue

  await call("PUT", "/internal/integrations/payments-config", { feeBps: 500 }, staffToken); // baseline 5%
  const checkout = await call("POST", "/payments/checkout", { tenancyId: ten6.json.id }, token);
  ok("checkout is created and pending", checkout.json.status === "PENDING" && !!checkout.json.reference);
  const amount = BigInt(checkout.json.amountKobo);
  const fee = BigInt(checkout.json.feeKobo);
  const net = BigInt(checkout.json.netKobo);
  ok("the split is computed (fee + net = amount)", fee + net === amount);
  ok("the fee is 5% (default) of the rent", fee === (amount * 5n) / 100n);
  ok("checkout returns a hosted pay link", typeof checkout.json.authorizationUrl === "string" && checkout.json.authorizationUrl.length > 0);
  const payRef = checkout.json.reference;

  const pub = await call("GET", `/payments/${payRef}/public`);
  ok("the public pay page resolves to a pending payment", pub.json.status === "PENDING");

  const badSig = await postWebhook({ event: "charge.success", data: { reference: payRef, amount: Number(amount) } }, { valid: false });
  ok("a webhook with a bad signature is rejected (403)", badSig.status === 403);

  const goodSig = await postWebhook({ event: "charge.success", data: { reference: payRef, amount: Number(amount) } }, { valid: true });
  ok("a signed webhook settles the payment", goodSig.json.status === "SUCCESS");

  const replay = await postWebhook({ event: "charge.success", data: { reference: payRef, amount: Number(amount) } }, { valid: true });
  ok("replaying the webhook is idempotent", replay.json.status === "SUCCESS" && replay.json.idempotent === true);

  const rentAfterPay = await call("GET", `/tenancies/${ten6.json.id}/rent`, undefined, token);
  ok("the paid charge is settled (no longer overdue)", rentAfterPay.json.overdueCount === 0);

  const payBoard = await call("GET", "/internal/board/payments", undefined, staffToken);
  ok("payments board shows the settled split", Array.isArray(payBoard.json) && payBoard.json.some((p) => p.reference === payRef && p.status === "SUCCESS" && p.netKobo === net.toString()));

  // The coordination fee is admin-configurable (definition-of-done #4) and drives the split.
  const setFee = await call("PUT", "/internal/integrations/payments-config", { feeBps: 1000 }, staffToken);
  ok("staff can set the coordination fee", setFee.json.saved === true && setFee.json.feeBps === 1000);
  const statusFee = await call("GET", "/internal/integrations/status", undefined, staffToken);
  ok("status reflects the configured fee", statusFee.json.payments.feeBps === 1000);

  const ten7 = await call(
    "POST",
    "/tenancies",
    {
      propertyId: prop.json.id,
      tenant: { name: "Fee Tenant", whatsapp: "+2348037777777" },
      terms: { rentKobo: "40000000", frequency: "monthly", commencementDate: pastRent2.toISOString(), expiryDate: rentExp3.toISOString() },
      accuracyAcknowledged: true,
    },
    token,
  );
  await call("GET", `/tenancies/${ten7.json.id}/rent`, undefined, token);
  const checkout2 = await call("POST", "/payments/checkout", { tenancyId: ten7.json.id }, token);
  ok("a new checkout uses the configured fee (10%)", BigInt(checkout2.json.feeKobo) === (BigInt(checkout2.json.amountKobo) * 10n) / 100n);
  await call("PUT", "/internal/integrations/payments-config", { feeBps: 500 }, staffToken); // reset baseline

  // WhatsApp is the landlord's surface: run the chat flows end to end (GJ-09 + GJ-12 in chat).
  const waFrom = "23480" + Math.floor(10000000 + Math.random() * 89999999);
  const greet = await chat(waFrom, { text: "hi" });
  ok("chat greets a new landlord with a menu", greet.messages.some((m) => m.type === "list"));

  await chat(waFrom, { replyId: "add_property" });
  await chat(waFrom, { text: "9 Chat Avenue, Lekki, Lagos" });
  const propMade = await chat(waFrom, { replyId: "use:RESIDENTIAL" });
  ok("chat creates a Property File", chatText(propMade.messages).includes("Property File created"));

  const ri = await chat(waFrom, { replyId: "report_issue" });
  const rprop = findItemId(ri.messages, "rprop:");
  ok("report-a-problem lists the property", !!rprop);
  await chat(waFrom, { replyId: rprop });
  await chat(waFrom, { replyId: "rcat:Plumbing" });
  await chat(waFrom, { text: "Kitchen tap is leaking" });
  const logged = await chat(waFrom, { replyId: "confirm" });
  ok("report-a-problem logs the issue in chat", chatText(logged.messages).includes("Issue logged"));

  const rt = await chat(waFrom, { replyId: "record_tenancy" });
  const rtProp = findItemId(rt.messages, "prop:");
  await chat(waFrom, { replyId: rtProp });
  await chat(waFrom, { text: "Chat Tenant" });
  await chat(waFrom, { text: "1200000" });
  const recorded = await chat(waFrom, { replyId: "confirm" });
  ok("chat records a tenancy", chatText(recorded.messages).includes("Tenancy recorded"));

  // Arrears gate (GJ-16, BP-10): collect-rent is blocked until its HIGH-risk control is on.
  const crBlocked = await chat(waFrom, { replyId: "collect_rent" });
  ok("collect-rent is blocked while the arrears control is off", chatText(crBlocked.messages).includes("isn't switched on"));

  // The arrears control is HIGH-risk, so enabling it needs CEO sign-off (GJ-18): a toggle is a proposal.
  const noReason = await call("PUT", "/internal/controls/channel.whatsapp.arrears", { enabled: true }, staffToken);
  ok("proposing a high-risk control change without a reason is refused (409)", noReason.status === 409);
  const proposeArrears = await call("PUT", "/internal/controls/channel.whatsapp.arrears", { enabled: true, reason: "open arrears for this landlord" }, staffToken);
  ok("a high-risk change is held for CEO sign-off, not applied", proposeArrears.json.mode === "PENDING_SIGN_OFF");
  const arrearsStillBlocked = await chat(waFrom, { replyId: "collect_rent" });
  ok("the arrears control stays off until the CEO signs off", chatText(arrearsStillBlocked.messages).includes("isn't switched on"));
  const signOff = await call("POST", `/internal/control-changes/${proposeArrears.json.request.id}/approve`, { reason: "approved" }, ceoToken);
  ok("the CEO signs off and the arrears control is applied", signOff.json.status === "APPLIED");

  const cr = await chat(waFrom, { replyId: "collect_rent" });
  const crten = findItemId(cr.messages, "crten:");
  ok("collect-rent lists the tenancy once the control is on", !!crten);
  const payLink = await chat(waFrom, { replyId: crten });
  ok("collect-rent returns a pay link in chat", chatText(payLink.messages).includes("/pay/"));

  // Reset to the fail-closed default, again through sign-off (propose off, CEO approves).
  const proposeOff = await call("PUT", "/internal/controls/channel.whatsapp.arrears", { enabled: false, reason: "reset" }, staffToken);
  await call("POST", `/internal/control-changes/${proposeOff.json.request.id}/approve`, { reason: "reset approved" }, ceoToken);

  // The WhatsApp AI agent: the Test-AI endpoint classifies a message. Local mode uses the
  // deterministic fallback (no key needed); a hosted provider + key would route through the LLM.
  const aiTest = await call("POST", "/internal/ai/test", { message: "collect rent" }, staffToken);
  ok("the AI test endpoint routes a message to an intent", aiTest.json.intent === "collect_rent" && aiTest.json.path === "fallback" && aiTest.json.provider === "fake");
  const aiTest2 = await call("POST", "/internal/ai/test", { message: "report a leak in my flat" }, staffToken);
  ok("the AI test endpoint understands a maintenance report", aiTest2.json.intent === "report_issue");

  // Meta Cloud API webhook (go-live): subscription handshake + signed inbound.
  await call("PUT", "/internal/integrations/whatsapp", { verifyToken: "kt-verify-token", appSecret: "kt-app-secret" }, staffToken);

  const vOk = await fetch(`${V1}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=kt-verify-token&hub.challenge=echo123`);
  const vBody = await vOk.text();
  ok("webhook verify echoes the challenge on a token match", vOk.status === 200 && vBody === "echo123");

  const vBad = await fetch(`${V1}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=echo123`);
  ok("webhook verify rejects a wrong token (403)", vBad.status === 403);

  const metaFrom = "23480" + Math.floor(10000000 + Math.random() * 89999999);
  const metaPayload = { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ from: metaFrom, type: "text", text: { body: "hi" } }] } }] }] };
  const metaRaw = JSON.stringify(metaPayload);
  const metaSig = "sha256=" + createHmac("sha256", "kt-app-secret").update(metaRaw).digest("hex");
  const wGood = await fetch(`${V1}/whatsapp/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": metaSig }, body: metaRaw });
  const wGoodJson = await wGood.json();
  ok("a signed Meta webhook is accepted and routed", wGoodJson.received === true && wGoodJson.handled === 1);

  const wBad = await fetch(`${V1}/whatsapp/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=deadbeef" }, body: metaRaw });
  ok("an unsigned/wrong Meta webhook is rejected (403)", wBad.status === 403);

  // WhatsApp templates + quiet hours + proactive notification queue (go-live hardening).
  const tname = "rent_due_" + Math.floor(Math.random() * 1000000);
  const tCreate = await call("POST", "/internal/whatsapp/templates", { name: tname, category: "UTILITY", body: "Your rent of {{1}} is due on {{2}}." }, staffToken);
  ok("a message template is created as DRAFT", tCreate.json.status === "DRAFT");
  const tId = tCreate.json.id;
  const tSub = await call("POST", `/internal/whatsapp/templates/${tId}/submit`, {}, staffToken);
  ok("a template can be submitted for Meta approval", tSub.json.status === "SUBMITTED");
  const tApp = await call("PUT", `/internal/whatsapp/templates/${tId}/status`, { status: "APPROVED" }, staffToken);
  ok("a template can be marked approved", tApp.json.status === "APPROVED");

  const pid = signup.json.participantId;
  const skip = await call("POST", "/internal/whatsapp/notifications", { participantId: pid, templateName: "not_a_real_template", params: [] }, staffToken);
  ok("a proactive send with an unapproved template is skipped", skip.json.status === "SKIPPED");

  const nowHour = new Date().getHours();
  const openNow = { startHour: (nowHour + 1) % 24, endHour: (nowHour + 1) % 24 }; // start===end → never quiet
  const quietNow = { startHour: nowHour, endHour: (nowHour + 1) % 24 }; // includes this hour

  await call("PUT", "/internal/whatsapp/quiet-hours", openNow, staffToken);
  const sentNow = await call("POST", "/internal/whatsapp/notifications", { participantId: pid, templateName: tname, params: ["N1,000,000", "1 Dec"] }, staffToken);
  ok("a proactive send outside quiet hours is sent", sentNow.json.status === "SENT");

  await call("PUT", "/internal/whatsapp/quiet-hours", quietNow, staffToken);
  const deferred = await call("POST", "/internal/whatsapp/notifications", { participantId: pid, templateName: tname, params: ["N500,000", "1 Dec"] }, staffToken);
  ok("a proactive send during quiet hours is deferred", deferred.json.status === "DEFERRED");

  await call("PUT", "/internal/whatsapp/quiet-hours", openNow, staffToken);
  const processed = await call("POST", "/internal/whatsapp/notifications/process", {}, staffToken);
  ok("processing flushes deferred notifications once the window opens", processed.json.sent >= 1);
  await call("PUT", "/internal/whatsapp/quiet-hours", { startHour: 21, endHour: 8 }, staffToken); // restore default

  // GJ-17: resume a flow after a pause, complete once, no duplicate.
  const resumeFrom = "23480" + Math.floor(10000000 + Math.random() * 89999999);
  await chat(resumeFrom, { text: "hi" });
  await chat(resumeFrom, { replyId: "add_property" });
  await chat(resumeFrom, { text: "7 Resume Road, Lagos" }); // captured, then "disconnect"
  const resumed = await chat(resumeFrom, { replyId: "use:RESIDENTIAL" }); // come back and finish
  ok("a half-finished flow resumes and completes (GJ-17)", chatText(resumed.messages).includes("Property File created"));
  await chat(resumeFrom, { replyId: "use:RESIDENTIAL" }); // stale duplicate reply, session already cleared
  const propsList = await chat(resumeFrom, { replyId: "my_properties" });
  ok("resuming never creates a duplicate (GJ-17)", (chatText(propsList.messages).match(/KT-/g) || []).length === 1);

  // GJ-05: new-tenancy origination through every gate to atomic activation.
  const origExpiry = new Date();
  origExpiry.setFullYear(origExpiry.getFullYear() + 1);
  const orig = await call(
    "POST",
    "/originations",
    { propertyId: prop.json.id, tenant: { name: "Origination Tenant" }, terms: { rentKobo: "180000000", frequency: "annual", commencementDate: new Date().toISOString(), expiryDate: origExpiry.toISOString(), cautionFeeKobo: "15000000" } },
    token,
  );
  ok("origination starts with an accept link", !!orig.json.originationId && typeof orig.json.acceptUrl === "string");
  const origId = orig.json.originationId;
  const acceptToken = orig.json.acceptToken;

  const gates0 = await call("GET", `/originations/${origId}/gates`, undefined, token);
  ok("terms gate is set, the rest are open", gates0.json.gates.termsSet === true && gates0.json.gates.tenantAccepted === false && gates0.json.gates.cautionFeeSettled === false && gates0.json.ready === false);

  const earlyActivate = await call("POST", `/originations/${origId}/activate`, {}, token);
  ok("activation is refused while gates are open (409)", earlyActivate.status === 409);

  const viewBefore = await call("GET", `/originations/accept/${acceptToken}`);
  ok("the tenant accept page resolves (not yet accepted)", viewBefore.json.accepted === false && viewBefore.json.tenant === "Origination Tenant");

  const tenantAccept = await call("POST", `/originations/accept/${acceptToken}`);
  ok("the tenant accepts on the secure link", tenantAccept.json.accepted === true);

  const stillBlocked = await call("POST", `/originations/${origId}/activate`, {}, token);
  ok("activation is still refused with the caution fee open (409)", stillBlocked.status === 409);

  const cf = await call("POST", `/originations/${origId}/caution-fee`, { waived: true }, token);
  ok("settling the caution fee makes every gate green", cf.json.ready === true);

  const activated = await call("POST", `/originations/${origId}/activate`, {}, token);
  ok("activation succeeds once every gate is green", activated.json.activated === true && activated.json.idempotent === false);

  const again = await call("POST", `/originations/${origId}/activate`, {}, token);
  ok("re-activating is idempotent", again.json.activated === true && again.json.idempotent === true);

  const newRent = await call("GET", `/tenancies/${activated.json.tenancyId}/rent`, undefined, token);
  ok("activation started the rent schedule", Array.isArray(newRent.json.charges) && newRent.json.charges.length >= 1);

  const origBoard = await call("GET", "/internal/board/originations", undefined, staffToken);
  ok("the originations board shows the activated tenancy", Array.isArray(origBoard.json) && origBoard.json.some((o) => o.id === origId && o.status === "ACTIVATED"));

  // GJ-05 over the landlord's WhatsApp surface: set up a new tenancy, get the accept link.
  const nt = await chat(waFrom, { replyId: "new_tenancy" });
  const nprop = findItemId(nt.messages, "nprop:");
  ok("new-tenancy chat lists the property", !!nprop);
  await chat(waFrom, { replyId: nprop });
  await chat(waFrom, { text: "Chat New Tenant" });
  await chat(waFrom, { text: "1800000" });
  const ntDone = await chat(waFrom, { replyId: "confirm" });
  ok("new-tenancy chat returns a tenant accept link", chatText(ntDone.messages).includes("/accept/"));

  // GJ-06 + GJ-14: seal a tenancy agreement, sign it, verify it publicly, tamper-check a copy.
  const doc = await call("POST", "/documents/tenancy-agreement", { tenancyId: activated.json.tenancyId }, token);
  ok("a tenancy agreement is sealed with a content hash", !!doc.json.reference && typeof doc.json.contentHash === "string");
  const docRef = doc.json.reference;
  const llToken = doc.json.landlordSignUrl.split("/sign/")[1];
  const tnToken = doc.json.tenantSignUrl.split("/sign/")[1];

  const verify0 = await call("GET", `/verify/${docRef}`);
  ok("the document verifies as authentic and sealed", verify0.json.valid === true && verify0.json.status === "SEALED");

  const signView = await call("GET", `/sign/${llToken}`);
  ok("a signer sees the sealed document on the link", signView.json.reference === docRef && signView.json.signed === false);

  const sign1 = await call("POST", `/sign/${llToken}`);
  ok("the landlord signs by e-signature", sign1.json.signed === true);

  const midVerify = await call("GET", `/verify/${docRef}`);
  ok("one signature recorded, not yet fully signed", midVerify.json.signatures.filter((s) => s.status === "SIGNED").length === 1 && midVerify.json.status === "SEALED");

  const sign2 = await call("POST", `/sign/${tnToken}`);
  ok("the tenant signs too", sign2.json.signed === true);

  const fullVerify = await call("GET", `/verify/${docRef}`);
  ok("with every signature the document becomes SIGNED", fullVerify.json.status === "SIGNED");

  const tamperOk = await call("POST", `/verify/${docRef}`, { body: signView.json.body });
  ok("the original copy passes the tamper check", tamperOk.json.matches === true);
  const tamperBad = await call("POST", `/verify/${docRef}`, { body: signView.json.body + " altered" });
  ok("an altered copy fails the tamper check", tamperBad.json.matches === false);

  const docBoard = await call("GET", "/internal/board/documents", undefined, staffToken);
  ok("the documents board shows the signed agreement", Array.isArray(docBoard.json) && docBoard.json.some((d) => d.reference === docRef && d.status === "SIGNED"));

  // GJ-14: the sealed document downloads as a PDF (public, by reference).
  const pdfRes = await fetch(`${V1}/verify/${docRef}/pdf`);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  ok("a sealed document downloads as a PDF", pdfRes.status === 200 && pdfRes.headers.get("content-type") === "application/pdf" && pdfBuf.subarray(0, 5).toString() === "%PDF-" && pdfBuf.length > 800);
  const pdfMissing = await fetch(`${V1}/verify/KT-DOC-NOPE/pdf`);
  ok("a PDF for an unknown reference is refused (404)", pdfMissing.status === 404);

  // Template studio (P0-09): author, version and counsel-approve notice templates.
  const tplBoard0 = await call("GET", "/internal/board/templates", undefined, staffToken);
  ok("the template studio lists seeded templates with versions", Array.isArray(tplBoard0.json) && tplBoard0.json.some((t) => t.code === "NT-01" && t.versions.length >= 1));
  const tplCode = `NT-SMK-${Math.floor(Math.random() * 100000)}`;
  const tplNew = await call("POST", "/internal/templates", { code: tplCode, name: "Smoke Notice", legalBasis: "Test basis", body: "NOTICE\n\nTo {tenantName}, re {propertyAddress}, effective {effectiveDate}." }, staffToken);
  ok("staff create a template (version 1, unapproved)", tplNew.json.code === tplCode && tplNew.json.hasApproved === false && tplNew.json.versions[0].version === 1);
  const draftVersion = tplNew.json.versions[0];
  ok("placeholders are detected from the body", draftVersion.fields.includes("tenantName") && draftVersion.fields.includes("effectiveDate"));
  const prev = await call("POST", `/internal/template-versions/${draftVersion.id}/preview`, { values: { tenantName: "Ada" } }, staffToken);
  ok("preview renders the body with supplied + placeholder values", prev.json.rendered.includes("To Ada,") && prev.json.rendered.includes("[propertyAddress]"));

  // A draft template is not usable by the notice engine until counsel-approved.
  const beforeApprove = await call("GET", "/notices/templates", undefined, token);
  ok("an unapproved template is not offered to notices", Array.isArray(beforeApprove.json) && !beforeApprove.json.some((t) => t.code === tplCode));
  const approved = await call("POST", `/internal/template-versions/${draftVersion.id}/approve`, { counselName: "Counsel Test" }, staffToken);
  ok("counsel approval marks the version approved", approved.json.hasApproved === true && approved.json.versions[0].approved === true);
  const afterTplApprove = await call("GET", "/notices/templates", undefined, token);
  ok("an approved template is offered to the notice engine", afterTplApprove.json.some((t) => t.code === tplCode));

  const tplV2 = await call("POST", `/internal/templates/${tplNew.json.id}/versions`, { name: "Smoke Notice v2", body: "NOTICE v2\n\nTo {tenantName}." }, staffToken);
  ok("staff add a new (unapproved) version", tplV2.json.versionCount === 2 && tplV2.json.versions.find((v) => v.version === 2).approved === false);

  // GJ-06 over the landlord's WhatsApp surface: draft an agreement, get sign + verify links.
  const da = await chat(waFrom, { replyId: "draft_agreement" });
  const dten = findItemId(da.messages, "dten:");
  ok("draft-agreement chat lists a tenancy", !!dten);
  const daDone = await chat(waFrom, { replyId: dten });
  ok("draft-agreement chat returns verify + sign links", chatText(daDone.messages).includes("/verify/") && chatText(daDone.messages).includes("/sign/"));

  // GJ-13: close-out with the caution-fee outcome (refund, partial, forfeit). Fresh tenancies.
  const coExp = new Date();
  coExp.setFullYear(coExp.getFullYear() + 1);
  const mkTenancy = (name, phone, caution) =>
    call("POST", "/tenancies", { propertyId: prop.json.id, tenant: { name, whatsapp: phone }, terms: { rentKobo: "100000000", frequency: "annual", commencementDate: new Date().toISOString(), expiryDate: coExp.toISOString(), cautionFeeKobo: caution }, accuracyAcknowledged: true }, token);

  const tenCo = await mkTenancy("Close Tenant", "+2348039000001", "20000000");
  const co = await call("POST", "/closeouts", { tenancyId: tenCo.json.id }, token);
  ok("close-out starts, the tenancy ends, caution fee carried", co.json.status === "OPEN" && co.json.cautionFeeKobo === "20000000");
  const coId = co.json.closeoutId;
  ok("with no deductions the preview is a full refund", co.json.outcome === "REFUND" && co.json.refundKobo === "20000000");

  const endedTen = await call("GET", `/tenancies/${tenCo.json.id}`, undefined, token);
  ok("the tenancy is now ENDED", endedTen.json.status === "ENDED");

  const ded = await call("POST", `/closeouts/${coId}/deductions`, { reason: "Unpaid rent", amountKobo: "5000000" }, token);
  ok("a deduction makes it a partial refund", ded.json.deductionsKobo === "5000000" && ded.json.outcome === "PARTIAL" && ded.json.refundKobo === "15000000");

  const settle = await call("POST", `/closeouts/${coId}/settle`, {}, token);
  ok("settling records the partial-refund outcome", settle.json.status === "SETTLED" && settle.json.outcome === "PARTIAL" && settle.json.refundKobo === "15000000" && settle.json.idempotent === false);
  const settleAgain = await call("POST", `/closeouts/${coId}/settle`, {}, token);
  ok("settling again is idempotent", settleAgain.json.idempotent === true);

  const tenCo2 = await mkTenancy("Forfeit Tenant", "+2348039000002", "10000000");
  const co2 = await call("POST", "/closeouts", { tenancyId: tenCo2.json.id }, token);
  await call("POST", `/closeouts/${co2.json.closeoutId}/deductions`, { reason: "Damage beyond the deposit", amountKobo: "12000000" }, token);
  const settle2 = await call("POST", `/closeouts/${co2.json.closeoutId}/settle`, {}, token);
  ok("deductions beyond the caution fee forfeit it", settle2.json.outcome === "FORFEIT" && settle2.json.refundKobo === "0");

  const coBoard = await call("GET", "/internal/board/closeouts", undefined, staffToken);
  ok("the close-outs board shows the settled outcome", Array.isArray(coBoard.json) && coBoard.json.some((c) => c.id === coId && c.status === "SETTLED"));

  // GJ-13 over the landlord's WhatsApp surface: end a tenancy, start the close-out.
  const et = await chat(waFrom, { replyId: "end_tenancy" });
  const eten = findItemId(et.messages, "eten:");
  ok("end-a-tenancy chat lists a tenancy", !!eten);
  await chat(waFrom, { replyId: eten });
  const etDone = await chat(waFrom, { replyId: "confirm" });
  ok("end-a-tenancy chat starts the close-out", chatText(etDone.messages).includes("close-out started"));

  // GJ-08: condition checks. Handover baseline, tenant confirms, exit check compared to it.
  const ccExp = new Date();
  ccExp.setFullYear(ccExp.getFullYear() + 1);
  const tenCC = await call("POST", "/tenancies", { propertyId: prop.json.id, tenant: { name: "Condition Tenant", whatsapp: "+2348039100001" }, terms: { rentKobo: "100000000", frequency: "annual", commencementDate: new Date().toISOString(), expiryDate: ccExp.toISOString() }, accuracyAcknowledged: true }, token);

  const base = await call("POST", "/condition-checks", { tenancyId: tenCC.json.id, kind: "BASELINE", items: [{ area: "Living room", condition: "good", note: "clean" }, { area: "Kitchen", condition: "good" }] }, token);
  ok("a handover baseline is created as a draft", base.json.kind === "BASELINE" && base.json.status === "DRAFT" && base.json.items.length === 2);
  const baseId = base.json.id;

  const ccSend = await call("POST", `/condition-checks/${baseId}/send`, {}, token);
  ok("the baseline is sent to the tenant", typeof ccSend.json.confirmUrl === "string" && !!ccSend.json.token);
  const ccToken = ccSend.json.token;

  const ccView = await call("GET", `/condition/${ccToken}`);
  ok("the tenant sees the baseline items", ccView.json.items.length === 2 && ccView.json.responded === false);

  const ccConfirm = await call("POST", `/condition/${ccToken}`, { kind: "CONFIRM" });
  ok("the tenant confirms the baseline (BP-19)", ccConfirm.json.status === "CONFIRMED");

  const exit = await call("POST", "/condition-checks", { tenancyId: tenCC.json.id, kind: "EXIT", items: [{ area: "Living room", condition: "damaged", note: "stain on the carpet" }, { area: "Kitchen", condition: "good" }] }, token);
  ok("an exit check is created", exit.json.kind === "EXIT");

  const cmp = await call("GET", `/condition-checks/${exit.json.id}/compare`, undefined, token);
  ok("the exit compares to the baseline and flags the change", cmp.json.changedCount === 1 && cmp.json.rows.some((r) => r.area === "Living room" && r.changed === true));

  const ccBoard = await call("GET", "/internal/board/condition-checks", undefined, staffToken);
  ok("the condition-checks board shows the confirmed baseline", Array.isArray(ccBoard.json) && ccBoard.json.some((c) => c.id === baseId && c.status === "CONFIRMED"));

  // GJ-08 over the landlord's WhatsApp surface: capture a handover condition, get a confirm link.
  const ccChat = await chat(waFrom, { replyId: "condition_check" });
  const ccten = findItemId(ccChat.messages, "cc:");
  ok("condition-check chat lists a tenancy", !!ccten);
  await chat(waFrom, { replyId: ccten });
  const ccChatDone = await chat(waFrom, { text: "Freshly painted, all appliances working." });
  ok("condition-check chat returns a tenant confirm link", chatText(ccChatDone.messages).includes("/condition/"));

  // GJ-22: renewals + Notice to Quit runway. Tenancies expiring within the renewal window.
  const soonExp = new Date();
  soonExp.setDate(soonExp.getDate() + 30);
  const commenced = new Date(Date.now() - 335 * 86400000).toISOString();
  const mkExpiring = (name, phone) => call("POST", "/tenancies", { propertyId: prop.json.id, tenant: { name, whatsapp: phone }, terms: { rentKobo: "120000000", frequency: "annual", commencementDate: commenced, expiryDate: soonExp.toISOString() }, accuracyAcknowledged: true }, token);

  const tenR = await mkExpiring("Renewal Tenant", "+2348039200001");
  const win = await call("GET", "/renewals/window", undefined, token);
  ok("the renewal window lists the expiring tenancy", Array.isArray(win.json) && win.json.some((w) => w.tenancyId === tenR.json.id));
  const winRow = win.json.find((w) => w.tenancyId === tenR.json.id);
  ok("the window computes a last safe notice date", typeof winRow.lastSafeNoticeDate === "string");

  const renew = await call("POST", `/renewals/${tenR.json.id}/renew`, { months: 12 }, token);
  ok("renewing extends the tenancy by a year", renew.json.stage === "RENEWED" && new Date(renew.json.newExpiry) > soonExp);
  const renewedTen = await call("GET", `/tenancies/${tenR.json.id}`, undefined, token);
  ok("the renewed tenancy status is RENEWED", renewedTen.json.status === "RENEWED");

  const tenR2 = await mkExpiring("Possession Tenant", "+2348039200002");
  const nr = await call("POST", `/renewals/${tenR2.json.id}/not-renew`, {}, token);
  ok("declining opens the Notice to Quit runway", nr.json.decision === "NOT_RENEW" && nr.json.stage === "NOTICE_TO_QUIT");
  const adv1 = await call("POST", `/renewals/${tenR2.json.id}/advance`, {}, token);
  ok("the runway advances to notice served", adv1.json.stage === "NOTICE_SERVED");
  const adv2 = await call("POST", `/renewals/${tenR2.json.id}/advance`, {}, token);
  ok("the runway advances to possession ready", adv2.json.stage === "POSSESSION_READY");
  const adv3 = await call("POST", `/renewals/${tenR2.json.id}/advance`, {}, token);
  ok("the runway cannot advance past its final stage (409)", adv3.status === 409);

  const renBoard = await call("GET", "/internal/board/renewals", undefined, staffToken);
  ok("the renewals board shows the possession runway", Array.isArray(renBoard.json) && renBoard.json.some((r) => r.tenancyId === tenR2.json.id && r.stage === "POSSESSION_READY"));

  // GJ-22 over the landlord's WhatsApp surface: the renewals intent runs the window check.
  const renChat = await chat(waFrom, { replyId: "renewals" });
  ok("renewals chat routes and runs the window check", chatText(renChat.messages).includes("No tenancies are due") || !!findItemId(renChat.messages, "rnw:"));

  // GJ-10: provider self-service portal. Apply, admit, quote, landlord accepts, deliver.
  const prApply = await call("POST", "/providers/apply", { name: "SelfServe Fixers", services: "Plumbing and electrical", contactEmail: "hello@fixers.ng" });
  ok("a provider can apply to join Konnect", !!prApply.json.id && prApply.json.status === "APPLIED");
  const providerId = prApply.json.id;

  const admit = await call("POST", `/internal/providers/${providerId}/admit`, {}, staffToken);
  ok("staff admit the provider and get a workspace link", typeof admit.json.workspaceUrl === "string" && !!admit.json.token);
  const pToken = admit.json.token;

  const pIssue = await call("POST", "/issues", { propertyId: prop.json.id, category: "Electrical", description: "Socket sparking", urgency: "URGENT" }, token);
  ok("an issue is reported for the provider to quote", pIssue.json.status === "REPORTED");

  const ws1 = await call("GET", `/providers/workspace/${pToken}`);
  ok("the provider workspace lists the open issue", Array.isArray(ws1.json.openIssues) && ws1.json.openIssues.some((i) => i.id === pIssue.json.id));

  const pQuote = await call("POST", `/providers/workspace/${pToken}/quotes/${pIssue.json.id}`, { amountKobo: "6000000", scope: "Replace socket and wiring" });
  ok("the provider submits a Quote from the portal", !!pQuote.json.id && pQuote.json.status === "SUBMITTED");

  const issueView2 = await call("GET", `/issues/${pIssue.json.id}`, undefined, token);
  ok("the landlord sees the provider's Quote", issueView2.json.quotes.some((q) => q.id === pQuote.json.id));
  const acceptPQ = await call("POST", `/issues/${pIssue.json.id}/quotes/${pQuote.json.id}/accept`, {}, token);
  ok("accepting the provider Quote starts the Work", acceptPQ.json.status === "IN_PROGRESS");
  const pWorkId = acceptPQ.json.workId;

  const ws2 = await call("GET", `/providers/workspace/${pToken}`);
  ok("the provider sees the accepted Work in the portal", ws2.json.myWork.some((w) => w.id === pWorkId && w.status === "IN_PROGRESS"));
  const pDeliver = await call("POST", `/providers/workspace/${pToken}/work/${pWorkId}`, { evidence: { photos: 2 } });
  ok("the provider submits completion (does not close it, BP-12)", pDeliver.json.status === "COMPLETION_SUBMITTED");

  const acceptPW = await call("POST", `/work/${pWorkId}/accept`, {}, token);
  ok("landlord acceptance completes the provider's Work", acceptPW.json.status === "COMPLETED");

  const badWs = await call("GET", "/providers/workspace/not-a-real-token");
  ok("an invalid provider workspace link is refused", badWs.status === 404);

  const prBoard = await call("GET", "/internal/board/providers", undefined, staffToken);
  ok("the providers board shows the admitted provider", Array.isArray(prBoard.json) && prBoard.json.some((p) => p.id === providerId && p.status === "ADMITTED"));

  // GJ-23: bulk / concierge intake. Staff capture a batch, the landlord confirms, tenancies created.
  const yr = new Date(Date.now() + 365 * 86400000).toISOString();
  const nowIso = new Date().toISOString();
  const intakeRows = [
    { addressRaw: "21 Intake Street, Yaba, Lagos", buildingUse: "RESIDENTIAL", tenantName: "Intake Tenant A", rentKobo: "90000000", frequency: "annual", commencementDate: nowIso, expiryDate: yr },
    { addressRaw: "22 Intake Street, Yaba, Lagos", buildingUse: "RESIDENTIAL", tenantName: "Intake Tenant B", rentKobo: "75000000", frequency: "annual", commencementDate: nowIso, expiryDate: yr },
  ];
  const batch = await call("POST", "/internal/intake", { landlordId: signup.json.participantId, rows: intakeRows }, staffToken);
  ok("staff create an intake batch", batch.json.status === "DRAFT" && batch.json.rowCount === 2);

  const iSend = await call("POST", `/internal/intake/${batch.json.id}/send`, {}, staffToken);
  ok("the batch is sent to the landlord to confirm", typeof iSend.json.confirmUrl === "string" && !!iSend.json.token);
  const intakeToken = iSend.json.token;

  const iView = await call("GET", `/intake/${intakeToken}`);
  ok("the landlord sees the batch rows", iView.json.rows.length === 2 && iView.json.committed === false);

  const iConfirm = await call("POST", `/intake/${intakeToken}/confirm`);
  ok("confirming commits the batch and creates the tenancies", iConfirm.json.committed === true && iConfirm.json.created === 2);
  const iConfirmAgain = await call("POST", `/intake/${intakeToken}/confirm`);
  ok("re-confirming an intake batch is idempotent", iConfirmAgain.json.idempotent === true);

  const iBoard = await call("GET", "/internal/board/intake", undefined, staffToken);
  ok("the intake board shows the committed batch", Array.isArray(iBoard.json) && iBoard.json.some((b) => b.id === batch.json.id && b.status === "COMMITTED" && b.committedCount === 2));

  const batch2 = await call("POST", "/internal/intake", { landlordId: signup.json.participantId, rows: [intakeRows[0]] }, staffToken);
  const iSend2 = await call("POST", `/internal/intake/${batch2.json.id}/send`, {}, staffToken);
  const iReject = await call("POST", `/intake/${iSend2.json.token}/reject`);
  ok("the landlord can reject a batch as inaccurate", iReject.json.status === "REJECTED");
  const iConfirmRejected = await call("POST", `/intake/${iSend2.json.token}/confirm`);
  ok("a rejected batch cannot be confirmed (409)", iConfirmRejected.status === 409);

  // GJ-20: scope of management. Default all in scope; a rent-only scope gates maintenance.
  const somProp = (await call("POST", "/properties", { addressRaw: "5 Scope Lane, Lagos", buildingUse: "RESIDENTIAL", acceptMandate: true }, token)).json;

  const somDef = await call("GET", `/properties/${somProp.id}/scope`, undefined, token);
  ok("a property defaults to full management", somDef.json.status === "DEFAULT" && somDef.json.services.maintenance === true);
  const rep0 = await call("POST", "/issues", { propertyId: somProp.id, category: "Plumbing", description: "leak", urgency: "NORMAL" }, token);
  ok("maintenance is allowed when in scope", rep0.json.status === "REPORTED");

  const setRent = await call("PUT", `/properties/${somProp.id}/scope`, { rentCollection: true, maintenance: false, notices: false, inspections: false, renewals: false }, token);
  ok("the landlord agrees a rent-only scope", setRent.json.status === "AGREED" && setRent.json.services.maintenance === false);

  const repBlocked = await call("POST", "/issues", { propertyId: somProp.id, category: "Electrical", description: "spark", urgency: "NORMAL" }, token);
  ok("maintenance is refused when out of scope (409)", repBlocked.status === 409);

  const setFull = await call("PUT", `/properties/${somProp.id}/scope`, { maintenance: true }, token);
  ok("restoring maintenance to scope re-enables it", setFull.json.services.maintenance === true);
  const rep1 = await call("POST", "/issues", { propertyId: somProp.id, category: "Electrical", description: "spark", urgency: "NORMAL" }, token);
  ok("maintenance works again once back in scope", rep1.json.status === "REPORTED");

  const somBoard = await call("GET", "/internal/board/scope", undefined, staffToken);
  ok("the scope board shows the agreed scope", Array.isArray(somBoard.json) && somBoard.json.some((s) => s.propertyId === somProp.id));

  // GJ-20 over the landlord's WhatsApp surface: set a property's scope of management.
  const scopeChat = await chat(waFrom, { replyId: "scope" });
  const scopProp = findItemId(scopeChat.messages, "scop:");
  ok("scope chat lists a property", !!scopProp);
  await chat(waFrom, { replyId: scopProp });
  const scopeDone = await chat(waFrom, { replyId: `somfull:${scopProp.slice(5)}` });
  ok("scope chat sets full management", chatText(scopeDone.messages).includes("full management"));

  // GJ-19: NDPA data-subject rights. Access discloses a copy; erasure anonymises; both verify identity.
  const dsrRaise = await call("POST", "/data-requests", { kind: "ACCESS" }, token);
  ok("a person raises an access request", dsrRaise.json.reference?.startsWith("KT-DSR-") && !!dsrRaise.json.token);
  const dsrToken = dsrRaise.json.token;
  const dsrView = await call("GET", `/data-request/${dsrToken}`);
  ok("the access request is awaiting the subject on a secure link", dsrView.json.kind === "ACCESS" && dsrView.json.status === "RECEIVED" && dsrView.json.fulfilled === false);
  const dsrConfirm = await call("POST", `/data-request/${dsrToken}/confirm`);
  ok("confirming identity discloses the data copy", dsrConfirm.json.fulfilled === true && !!dsrConfirm.json.package?.profile?.name);
  ok("the disclosed copy lists records kept under a legal basis", Array.isArray(dsrConfirm.json.package?.retained) && dsrConfirm.json.package.retained.length > 0);
  const dsrConfirmAgain = await call("POST", `/data-request/${dsrToken}/confirm`);
  ok("confirming again is idempotent", dsrConfirmAgain.json.status === "FULFILLED");
  const dsrBoard = await call("GET", "/internal/board/data-requests", undefined, staffToken);
  ok("the data-requests board shows the request", Array.isArray(dsrBoard.json) && dsrBoard.json.some((r) => r.reference === dsrRaise.json.reference));

  // Erasure over the landlord's WhatsApp surface, on a throwaway number so the main account is untouched.
  const eraseFrom = "23480" + Math.floor(10000000 + Math.random() * 89999999);
  await chat(eraseFrom, { text: "hi" });
  const dataChat = await chat(eraseFrom, { replyId: "my_data" });
  ok("my-data chat offers access and erasure", !!findItemId(dataChat.messages, "dsr_erase") || chatText(dataChat.messages).includes("data rights"));
  const eraseStart = await chat(eraseFrom, { replyId: "dsr_erase" });
  const eraseToken = (chatText(eraseStart.messages).match(/dev token: ([0-9a-f]+)/) ?? [])[1];
  ok("erasure chat returns a secure confirmation link", !!eraseToken && chatText(eraseStart.messages).includes("cannot be undone"));
  const eraseView = await call("GET", `/data-request/${eraseToken}`);
  ok("the erasure request is an ERASURE awaiting the subject", eraseView.json.kind === "ERASURE" && eraseView.json.status === "RECEIVED");
  const eraseConfirm = await call("POST", `/data-request/${eraseToken}/confirm`);
  ok("confirming erasure anonymises the person", eraseConfirm.json.fulfilled === true && Array.isArray(eraseConfirm.json.package?.erased));
  const afterErase = await chat(eraseFrom, { text: "hello" });
  ok("the erased person is no longer linked (a fresh account is created)", chatText(afterErase.messages).includes("your details are confirmed") || chatText(afterErase.messages).includes("Welcome"));

  // Staff can decline a request with a reason (identity not established, or a legal exemption).
  const onBehalf = await call("POST", "/internal/data-requests", { subjectId: signup.json.participantId, kind: "ACCESS" }, staffToken);
  ok("staff raise a request on a person's behalf", onBehalf.json.reference?.startsWith("KT-DSR-"));
  const boardForId = await call("GET", "/internal/board/data-requests", undefined, staffToken);
  const onBehalfId = boardForId.json.find((r) => r.reference === onBehalf.json.reference)?.id;
  const refused = await call("POST", `/internal/data-requests/${onBehalfId}/refuse`, { reason: "Identity could not be established" }, staffToken);
  ok("staff decline a data request with a reason", refused.json.status === "REFUSED" && refused.json.refusedReason.length > 0);

  // NDPA requests fail closed behind their control (BP-08). Re-enabled right after.
  await call("PUT", "/internal/controls/compliance.ndpa", { enabled: false, reason: "smoke" }, staffToken);
  const ndpaOff = await call("POST", "/data-requests", { kind: "ACCESS" }, token);
  ok("data requests fail closed when the control is off", ndpaOff.status === 403);
  await call("PUT", "/internal/controls/compliance.ndpa", { enabled: true, reason: "smoke" }, staffToken);

  // GJ-18: control change with CEO sign-off. A high-risk change is proposed, held, and applied
  // only when a CEO signs it off; the proposer cannot sign off their own (two-person rule).
  const controlsBefore = await call("GET", "/internal/controls", undefined, staffToken);
  const paymentsLiveOff = () => (controlsBefore.json.find((c) => c.key === "payments.live") ?? {}).enabled === false;
  ok("payments.live starts off (HIGH-risk, fail-closed)", paymentsLiveOff());

  const propose = await call("PUT", "/internal/controls/payments.live", { enabled: true, reason: "go live after Paystack onboarding" }, staffToken);
  ok("a high-risk change is proposed, not applied", propose.json.mode === "PENDING_SIGN_OFF" && propose.json.request.status === "PENDING");
  const heldControls = await call("GET", "/internal/controls", undefined, staffToken);
  ok("the control does not move while the change is pending", heldControls.json.find((c) => c.key === "payments.live").enabled === false);
  const dupPropose = await call("PUT", "/internal/controls/payments.live", { enabled: true, reason: "again" }, staffToken);
  ok("a second pending change for the same control is refused (409)", dupPropose.status === 409);
  const pendingQueue = await call("GET", "/internal/control-changes/pending", undefined, staffToken);
  ok("the sign-off queue shows the pending change", pendingQueue.json.some((r) => r.id === propose.json.request.id));

  const proposerApprove = await call("POST", `/internal/control-changes/${propose.json.request.id}/approve`, { reason: "self" }, staffToken);
  ok("a non-CEO cannot sign off a control change (403)", proposerApprove.status === 403);

  const ceoApprove = await call("POST", `/internal/control-changes/${propose.json.request.id}/approve`, { reason: "approved by CEO" }, ceoToken);
  ok("the CEO signs off and the change is applied", ceoApprove.json.status === "APPLIED" && ceoApprove.json.decidedBy);
  const afterApprove = await call("GET", "/internal/controls", undefined, staffToken);
  ok("the control is now on after sign-off", afterApprove.json.find((c) => c.key === "payments.live").enabled === true);

  // Two-person rule: a CEO proposing a change still cannot sign off their own.
  const ceoProposes = await call("PUT", "/internal/controls/payments.live", { enabled: false, reason: "pause live payments" }, ceoToken);
  const ceoSelfApprove = await call("POST", `/internal/control-changes/${ceoProposes.json.request.id}/approve`, { reason: "self" }, ceoToken);
  ok("the proposer cannot sign off their own change, even a CEO (409)", ceoSelfApprove.status === 409);
  await call("POST", `/internal/control-changes/${ceoProposes.json.request.id}/cancel`, {}, ceoToken); // withdraw it

  // Reject path: a proposed change the CEO declines leaves the control untouched.
  const proposeAgain = await call("PUT", "/internal/controls/payments.live", { enabled: false, reason: "reset to off" }, staffToken);
  const rejected = await call("POST", `/internal/control-changes/${proposeAgain.json.request.id}/reject`, { reason: "keep live for now" }, ceoToken);
  ok("the CEO can decline a change with a reason", rejected.json.status === "REJECTED");
  const stillOnControls = await call("GET", "/internal/controls", undefined, staffToken);
  ok("a declined change does not move the control", stillOnControls.json.find((c) => c.key === "payments.live").enabled === true);

  // Reset payments.live back off through the governed path so the suite is repeatable.
  const resetProp = await call("PUT", "/internal/controls/payments.live", { enabled: false, reason: "reset after smoke" }, staffToken);
  await call("POST", `/internal/control-changes/${resetProp.json.request.id}/approve`, { reason: "reset" }, ceoToken);
  const changeBoard = await call("GET", "/internal/control-changes", undefined, staffToken);
  ok("the control-change board lists the history", Array.isArray(changeBoard.json) && changeBoard.json.length >= 3);

  // GJ-24: mixed-use building. A building groups units of differing use; flats + shops make it MIXED_USE.
  const bld = await call("POST", "/buildings", { addressRaw: "12 Market Street, Lagos Island" }, token);
  ok("a landlord creates a building", bld.json.reference?.startsWith("KT-BLD-") && bld.json.use === "UNKNOWN" && bld.json.unitCount === 0);
  const addFlat = await call("POST", `/buildings/${bld.json.id}/units`, { unitUse: "RESIDENTIAL" }, token);
  ok("a residential unit makes the building residential", addFlat.json.building.use === "RESIDENTIAL" && addFlat.json.building.unitCount === 1);
  const addShop = await call("POST", `/buildings/${bld.json.id}/units`, { unitUse: "SHOP" }, token);
  ok("adding a shop makes the building mixed-use", addShop.json.building.use === "MIXED_USE" && addShop.json.building.mixedUse === true);
  ok("the building counts residential and commercial units", addShop.json.building.residentialCount === 1 && addShop.json.building.commercialCount === 1);
  const flatUnit = addShop.json.building.units.find((u) => u.unitUse === "RESIDENTIAL");
  const shopUnit = addShop.json.building.units.find((u) => u.unitUse === "SHOP");
  ok("a flat resolves the residential regime", flatUnit.regime === "RESIDENTIAL");
  ok("a shop resolves the commercial regime", shopUnit.regime === "COMMERCIAL");
  const bldView = await call("GET", `/buildings/${bld.json.id}`, undefined, token);
  ok("the building view reports mixed-use", bldView.json.use === "MIXED_USE" && bldView.json.units.length === 2);
  const bldBoard = await call("GET", "/internal/board/buildings", undefined, staffToken);
  ok("the buildings board shows the mixed-use building", Array.isArray(bldBoard.json) && bldBoard.json.some((b) => b.id === bld.json.id && b.mixedUse));

  // GJ-24 over the landlord's WhatsApp surface: set up a mixed-use building by chat.
  const bChat = await chat(waFrom, { replyId: "buildings" });
  ok("building chat asks for the address", chatText(bChat.messages).toLowerCase().includes("address"));
  const bCreated = await chat(waFrom, { text: "7 Balogun Street, Lagos" });
  ok("building chat creates the building and offers units", !!findItemId(bCreated.messages, "bunit:"));
  await chat(waFrom, { replyId: "bunit:RESIDENTIAL" });
  const bMixed = await chat(waFrom, { replyId: "bunit:SHOP" });
  ok("building chat reports mixed-use after a flat and a shop", chatText(bMixed.messages).toLowerCase().includes("mixed-use"));
  const bDone = await chat(waFrom, { replyId: "bfinish" });
  ok("building chat summarises the units and regimes", chatText(bDone.messages).includes("MIXED_USE") && chatText(bDone.messages).toLowerCase().includes("regime"));

  // Full admin control: staff run operations from the admin on the landlord's behalf (concierge).
  // Scope: staff set a property's scope of management.
  const admScope = await call("PUT", `/internal/scope/${somProp.id}`, { rentCollection: true, maintenance: true, notices: true, inspections: true, renewals: true }, staffToken);
  ok("staff set a property's scope of management", admScope.json.status === "AGREED" && admScope.json.services.maintenance === true);
  // Buildings: staff add a unit to a grouped building.
  const admUnit = await call("POST", `/internal/buildings/${bld.json.id}/units`, { unitUse: "OFFICE" }, staffToken);
  ok("staff add a unit to a building", admUnit.json.building.unitCount >= 3 && admUnit.json.building.commercialCount >= 2);
  // Documents: staff record a paper signature.
  const admPaper = await call("POST", `/internal/documents/${doc.json.documentId}/paper-signature`, { signerRole: "WITNESS", signerName: "A. Witness" }, staffToken);
  ok("staff record a paper signature", Array.isArray(admPaper.json.signatures) && admPaper.json.signatures.some((s) => s.role === "WITNESS"));
  // Condition: staff compare an exit check to the confirmed baseline.
  const admCmp = await call("GET", `/internal/condition-checks/${exit.json.id}/compare`, undefined, staffToken);
  ok("staff compare an exit check to the baseline", typeof admCmp.json.changedCount === "number" && admCmp.json.changedCount >= 1);

  // Close-out: staff create-path via landlord, then staff add a deduction and settle.
  const admCoTen = await call("POST", "/tenancies", { propertyId: prop.json.id, tenant: { name: "Admin Closeout Tenant", whatsapp: "+2348039300001" }, terms: { rentKobo: "90000000", frequency: "annual", commencementDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000).toISOString(), cautionFeeKobo: "9000000" }, accuracyAcknowledged: true }, token);
  const admCo = await call("POST", "/closeouts", { tenancyId: admCoTen.json.id }, token);
  const admDed = await call("POST", `/internal/closeouts/${admCo.json.closeoutId}/deductions`, { reason: "Cleaning", amountKobo: "2000000" }, staffToken);
  ok("staff add a deduction to a close-out", admDed.json.deductionsKobo === "2000000");
  const admSettle = await call("POST", `/internal/closeouts/${admCo.json.closeoutId}/settle`, {}, staffToken);
  ok("staff settle a close-out", admSettle.json.status === "SETTLED" && admSettle.json.outcome === "PARTIAL");

  // Origination: staff activate a ready origination (concierge).
  const admOrigProp = (await call("POST", "/properties", { addressRaw: "9 Concierge Court, Lagos", buildingUse: "RESIDENTIAL", acceptMandate: true }, token)).json;
  const admOrig = await call("POST", "/originations", { propertyId: admOrigProp.id, tenant: { name: "Concierge Tenant" }, terms: { rentKobo: "100000000", frequency: "annual", commencementDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 365 * 86400000).toISOString() } }, token);
  await call("POST", `/originations/accept/${admOrig.json.acceptToken}`);
  await call("POST", `/originations/${admOrig.json.originationId}/caution-fee`, { waived: true }, token);
  const admActivate = await call("POST", `/internal/originations/${admOrig.json.originationId}/activate`, {}, staffToken);
  ok("staff activate a ready origination", admActivate.json.activated === true);

  // Renewal: staff renew and run the possession runway.
  const admRenTen = await mkExpiring("Concierge Renewal", "+2348039300002");
  const admRenew = await call("POST", `/internal/renewals/${admRenTen.json.id}/renew`, { months: 12 }, staffToken);
  ok("staff renew a tenancy", admRenew.json.stage === "RENEWED");
  const admRenTen2 = await mkExpiring("Concierge Possession", "+2348039300003");
  const admNotRenew = await call("POST", `/internal/renewals/${admRenTen2.json.id}/not-renew`, {}, staffToken);
  ok("staff decline a renewal and open the runway", admNotRenew.json.stage === "NOTICE_TO_QUIT");
  const admAdvance = await call("POST", `/internal/renewals/${admRenTen2.json.id}/advance`, {}, staffToken);
  ok("staff advance the possession runway", admAdvance.json.stage === "NOTICE_SERVED");

  // The whole WhatsApp channel fails closed behind its control (BP-08). Re-enabled right after.
  await call("PUT", "/internal/controls/channel.whatsapp", { enabled: false, reason: "smoke" }, staffToken);
  const channelOff = await chat("2348090000001", { text: "hi" });
  ok("the WhatsApp channel fails closed when its control is off", chatText(channelOff.messages).includes("temporarily unavailable"));
  const reEnable = await call("PUT", "/internal/controls/channel.whatsapp", { enabled: true, reason: "smoke" }, staffToken);
  ok("staff re-enable the WhatsApp channel", reEnable.json.mode === "APPLIED" && reEnable.json.control.enabled === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Smoke test error:", e.message);
  process.exit(1);
});
