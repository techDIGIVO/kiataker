"use client";

import { useEffect, useState } from "react";
import { getToken, apiGet, apiSend } from "@/lib/admin-api";

interface Provider { id: string; label: string; models: string[] }
interface Config { provider: string; model: string; temperature: number; systemStyle: string }
interface TestResult { intent: string; path: "llm" | "fallback"; provider: string; model: string; ms: number; error?: string }
interface Status {
  ai: { provider: string; model: string; keySet: boolean; keyHint: string | null; working: boolean; note: string };
  whatsapp: { mode: string; phoneNumberIdSet: boolean; accessTokenSet: boolean; accessTokenHint: string | null; verifyTokenSet: boolean; appSecretSet: boolean; businessNumber: string; working: boolean; note: string };
  payments: { mode: string; secretKeySet: boolean; secretKeyHint: string | null; publicKeySet: boolean; feeBps: number; working: boolean; note: string };
}

const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--k-text-secondary)", margin: "0 0 7px" };
const input: React.CSSProperties = { width: "100%", border: "1px solid var(--k-border)", borderRadius: 9, padding: "11px 13px", fontSize: 15, fontFamily: "var(--k-font-body)", background: "#fff" };
const cardHead: React.CSSProperties = { fontSize: 18, marginBottom: 4 };

export default function AiSettings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [aiKey, setAiKey] = useState("");
  const [wa, setWa] = useState({ phoneNumberId: "", businessAccountId: "", accessToken: "", verifyToken: "", appSecret: "" });
  const [ps, setPs] = useState({ secretKey: "", publicKey: "" });
  const [feePct, setFeePct] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [testMsg, setTestMsg] = useState("my tenant has not paid rent");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  async function reload() {
    const [c, s] = await Promise.all([
      apiGet<{ config: Config; providers: Provider[] }>("/internal/ai/config"),
      apiGet<Status>("/internal/integrations/status"),
    ]);
    setCfg(c.config); setProviders(c.providers); setStatus(s); setLoading(false);
  }

  useEffect(() => {
    if (!getToken()) { window.location.href = "/admin/login"; return; }
    reload().catch((e) => {
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes((e as Error).message)) window.location.href = "/admin/login";
      else { setMsg((e as Error).message); setLoading(false); }
    });
  }, []);

  const current = providers.find((p) => p.id === cfg?.provider);

  async function saveConfig() {
    if (!cfg) return;
    setMsg("Saving...");
    try { await apiSend("PUT", "/internal/ai/config", cfg); await reload(); setMsg("Model saved ✔"); }
    catch (e) { setMsg("Error: " + (e as Error).message); }
  }
  async function saveAiKey() {
    if (!cfg || !aiKey) return;
    setMsg("Saving key...");
    try { await apiSend("PUT", "/internal/integrations/ai-key", { provider: cfg.provider, apiKey: aiKey }); setAiKey(""); await reload(); setMsg("API key saved ✔"); }
    catch (e) { setMsg("Error: " + (e as Error).message); }
  }
  async function saveWa() {
    setMsg("Saving WhatsApp keys...");
    try { await apiSend("PUT", "/internal/integrations/whatsapp", wa); setWa({ phoneNumberId: "", businessAccountId: "", accessToken: "", verifyToken: "", appSecret: "" }); await reload(); setMsg("WhatsApp keys saved ✔"); }
    catch (e) { setMsg("Error: " + (e as Error).message); }
  }
  async function saveFee() {
    const pct = Number(feePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 20) { setMsg("Fee must be between 0% and 20%."); return; }
    setMsg("Saving fee...");
    try { await apiSend("PUT", "/internal/integrations/payments-config", { feeBps: Math.round(pct * 100) }); setFeePct(""); await reload(); setMsg("Coordination fee saved ✔"); }
    catch (e) { setMsg("Error: " + (e as Error).message); }
  }
  async function testAgent() {
    if (!testMsg.trim()) return;
    setTesting(true); setTestResult(null);
    try { setTestResult(await apiSend<TestResult>("POST", "/internal/ai/test", { message: testMsg })); }
    catch (e) { setMsg("Error: " + (e as Error).message); }
    finally { setTesting(false); }
  }
  async function savePs() {
    const data: Record<string, string> = {};
    if (ps.secretKey) data.secretKey = ps.secretKey;
    if (ps.publicKey) data.publicKey = ps.publicKey;
    if (Object.keys(data).length === 0) { setMsg("Enter a Paystack key first."); return; }
    setMsg("Saving Paystack keys...");
    try { await apiSend("PUT", "/internal/integrations/payments", data); setPs({ secretKey: "", publicKey: "" }); await reload(); setMsg("Paystack keys saved ✔"); }
    catch (e) { setMsg("Error: " + (e as Error).message); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid var(--k-border)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/admin" style={{ fontSize: 14, color: "var(--k-text-secondary)" }}>← Admin</a>
        <strong style={{ fontSize: 15 }}>WhatsApp AI & integrations</strong>
        {msg && <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--k-text-secondary)" }}>{msg}</span>}
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px" }}>
        {loading || !cfg || !status ? (
          <div className="card" style={{ padding: 20 }}>Loading...</div>
        ) : (
          <>
            {/* What's in place */}
            <h2 style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--k-text-muted)", marginBottom: 12 }}>What&apos;s in place</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, marginBottom: 32 }}>
              <StatusCard title="WhatsApp AI" working={status.ai.working} lines={[`Provider: ${status.ai.provider}`, `Model: ${status.ai.model}`, status.ai.keySet ? `Key: ${status.ai.keyHint ?? "set"}` : "Key: not set", status.ai.note]} />
              <StatusCard title="WhatsApp channel" working={status.whatsapp.working} lines={[`Mode: ${status.whatsapp.mode}`, status.whatsapp.accessTokenSet ? `Token: ${status.whatsapp.accessTokenHint}` : "Meta token: not set", status.whatsapp.note]} />
              <StatusCard title="Payments" working={status.payments.working} lines={[`Mode: ${status.payments.mode}`, status.payments.secretKeySet ? `Key: ${status.payments.secretKeyHint}` : "Paystack key: not set", status.payments.note]} />
            </div>

            {/* Model & behaviour */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={cardHead}>Model and behaviour</h3>
              <p style={{ fontSize: 14, marginBottom: 20 }}>Switching is instant, no code release. The AI understands and routes, it never decides for the landlord.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                <div>
                  <label style={label}>Provider</label>
                  <select aria-label="AI provider" style={input} value={cfg.provider} onChange={(e) => { const prov = providers.find((p) => p.id === e.target.value); setCfg({ ...cfg, provider: e.target.value, model: prov?.models[0] ?? cfg.model }); }}>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Model</label>
                  <select aria-label="AI model" style={input} value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })}>
                    {(current?.models ?? [cfg.model]).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <label style={label}>Temperature ({cfg.temperature.toFixed(2)})</label>
              <input aria-label="Temperature" type="range" min={0} max={1} step={0.05} value={cfg.temperature} style={{ width: "100%", marginBottom: 16 }} onChange={(e) => setCfg({ ...cfg, temperature: Number(e.target.value) })} />
              <label style={label}>Conversation style</label>
              <textarea aria-label="Conversation style" style={{ ...input, minHeight: 72, resize: "vertical", marginBottom: 18 }} value={cfg.systemStyle} onChange={(e) => setCfg({ ...cfg, systemStyle: e.target.value })} />
              <button className="btn btn-primary" onClick={saveConfig}>Save model</button>
            </div>

            {/* Test the agent */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={cardHead}>Test the agent</h3>
              <p style={{ fontSize: 14, marginBottom: 16 }}>Type a message the way a landlord would. The agent classifies it into an action. With a hosted model + key it uses the LLM; otherwise it uses the built-in rules. The AI only ever routes, it never decides.</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <input aria-label="Test message" style={input} value={testMsg} placeholder="e.g. my tenant has not paid rent" onChange={(e) => setTestMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") testAgent(); }} />
                <button className="btn btn-primary" style={{ flex: "none" }} onClick={testAgent} disabled={testing || !testMsg.trim()}>{testing ? "..." : "Classify"}</button>
              </div>
              {testResult && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "12px 14px", borderRadius: 10, background: "var(--k-green-soft)" }}>
                  <span style={{ fontWeight: 700, color: "var(--k-green-deep)" }}>→ {testResult.intent}</span>
                  <span style={{ fontSize: 13, color: "var(--k-text-secondary)" }}>
                    via {testResult.path === "llm" ? `LLM (${testResult.provider} ${testResult.model}, ${testResult.ms}ms)` : "built-in rules"}
                    {testResult.error ? ` (${testResult.error})` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Keys */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={cardHead}>API keys</h3>
              <p style={{ fontSize: 14, marginBottom: 20 }}>Enter the keys the platform needs to run. Saved secrets are never shown again, only a masked hint. Leave a field blank to keep its current value.</p>

              <label style={label}>{current?.label ?? "AI provider"} API key {status.ai.keySet && status.ai.provider !== "fake" ? `(current: ${status.ai.keyHint})` : ""}</label>
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <input aria-label="AI provider API key" style={input} type="password" placeholder={cfg.provider === "fake" ? "Local engine needs no key" : "Paste API key"} value={aiKey} disabled={cfg.provider === "fake"} onChange={(e) => setAiKey(e.target.value)} />
                <button className="btn btn-outline" style={{ flex: "none" }} onClick={saveAiKey} disabled={cfg.provider === "fake" || !aiKey}>Save key</button>
              </div>

              <div style={{ borderTop: "1px solid var(--k-border)", paddingTop: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>WhatsApp (Meta Cloud API)</div>
                <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 16 }}>Business number {status.whatsapp.businessNumber}. Enter these to go live on the real WhatsApp number.</p>
                <WaField l="Phone number ID" v={wa.phoneNumberId} set={status.whatsapp.phoneNumberIdSet} onChange={(v) => setWa({ ...wa, phoneNumberId: v })} />
                <WaField l="Business account ID" v={wa.businessAccountId} onChange={(v) => setWa({ ...wa, businessAccountId: v })} />
                <WaField l="Access token" v={wa.accessToken} set={status.whatsapp.accessTokenSet} secret onChange={(v) => setWa({ ...wa, accessToken: v })} />
                <WaField l="Verify token" v={wa.verifyToken} set={status.whatsapp.verifyTokenSet} secret onChange={(v) => setWa({ ...wa, verifyToken: v })} />
                <WaField l="App secret" v={wa.appSecret} set={status.whatsapp.appSecretSet} secret onChange={(v) => setWa({ ...wa, appSecret: v })} />
                <button className="btn btn-primary" onClick={saveWa}>Save WhatsApp keys</button>
              </div>

              <div style={{ borderTop: "1px solid var(--k-border)", paddingTop: 20, marginTop: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Payments (Paystack)</div>
                <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 16 }}>
                  Mode: {status.payments.mode}. Enter Paystack keys to settle live. Payments stay behind their own platform control and Kiataker never holds the money (BP-07).
                </p>
                <WaField l="Secret key" v={ps.secretKey} set={status.payments.secretKeySet} secret onChange={(v) => setPs({ ...ps, secretKey: v })} />
                <WaField l="Public key" v={ps.publicKey} set={status.payments.publicKeySet} onChange={(v) => setPs({ ...ps, publicKey: v })} />
                <button className="btn btn-primary" onClick={savePs}>Save Paystack keys</button>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--k-border)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Coordination fee</div>
                  <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 12 }}>
                    Kiataker&apos;s share of each on-platform payment, taken as the split. Currently {(status.payments.feeBps / 100).toFixed(2)}%. The rest settles to the landlord.
                  </p>
                  <label style={label}>New fee (% of rent, 0 to 20)</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input aria-label="New coordination fee percent" style={input} type="number" min={0} max={20} step={0.25} placeholder={`${(status.payments.feeBps / 100).toFixed(2)}`} value={feePct} onChange={(e) => setFeePct(e.target.value)} />
                    <button className="btn btn-outline" style={{ flex: "none" }} onClick={saveFee} disabled={feePct === ""}>Save fee</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 16px", background: "var(--k-green-soft)", borderRadius: 10, fontSize: 13.5, color: "var(--k-green-deep)" }}>
              Guardrail: whichever model you choose, the AI stays a constrained tool. It never approves, signs, moves money or makes a management decision. Those always go to the landlord.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, working, lines }: { title: string; working: boolean; lines: string[] }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: working ? "var(--k-green-primary)" : "var(--k-warning-fg)" }} />
        <strong style={{ fontSize: 14.5 }}>{title}</strong>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: working ? "var(--k-green-primary)" : "var(--k-warning-fg)" }}>{working ? "LIVE" : "NEEDS KEYS"}</span>
      </div>
      {lines.map((l, i) => <div key={i} style={{ fontSize: 12.5, color: i === lines.length - 1 ? "var(--k-text-muted)" : "var(--k-text-secondary)", marginTop: 2 }}>{l}</div>)}
    </div>
  );
}

function WaField({ l, v, set, secret, onChange }: { l: string; v: string; set?: boolean; secret?: boolean; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ ...label, marginBottom: 5 }}>{l} {set ? "✓ set" : ""}</label>
      <input aria-label={l} style={input} type={secret ? "password" : "text"} value={v} placeholder={set ? "Keep current (leave blank)" : ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
