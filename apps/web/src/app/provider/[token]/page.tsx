"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface Issue {
  id: string;
  category: string;
  description: string;
  urgency: string;
  status: string;
  alreadyQuoted: boolean;
}
interface Quote {
  id: string;
  issueId: string;
  amountKobo: string;
  scope: string;
  status: string;
}
interface Work {
  id: string;
  issueId: string;
  status: string;
}
interface Workspace {
  provider: { name: string; services: string };
  openIssues: Issue[];
  myQuotes: Quote[];
  myWork: Work[];
}

function naira(kobo: string): string {
  return `₦${(BigInt(kobo) / 100n).toLocaleString("en-NG")}`;
}

export default function ProviderWorkspace() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [quoting, setQuoting] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/providers/workspace/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This workspace link is not valid");
      setWs(json);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitQuote(issueId: string) {
    if (!amount || !scope) return;
    setBusy(true);
    try {
      const amountKobo = BigInt(Math.round(Number(amount) * 100)).toString();
      const res = await fetch(`${API_BASE}/v1/providers/workspace/${token}/quotes/${issueId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountKobo, scope }) });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not submit the Quote");
      setQuoting(null);
      setAmount("");
      setScope("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitWork(workId: string) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/providers/workspace/${token}/work/${workId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ evidence: { note: "Completed" } }) });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not submit completion");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker · Konnect</span>
        </div>

        {error && !ws && <div className="card" style={{ padding: 24 }}>{error}</div>}

        {ws && (
          <>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>{ws.provider.name}</h1>
            <p style={{ fontSize: 14, color: "var(--k-text-muted)", marginBottom: 24 }}>{ws.provider.services}</p>
            {error && <div className="card" style={{ padding: 14, marginBottom: 16, color: "var(--k-warning-fg)" }}>{error}</div>}

            <h2 style={{ fontSize: 17, marginBottom: 10 }}>Open issues to quote</h2>
            {ws.openIssues.length === 0 ? (
              <div className="card" style={{ padding: 18, marginBottom: 24, color: "var(--k-text-muted)" }}>No open issues right now.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
                {ws.openIssues.map((i) => (
                  <div key={i.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong style={{ fontSize: 15 }}>{i.category}</strong>
                      <span style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>{i.urgency}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--k-text-secondary)", marginBottom: 10 }}>{i.description}</p>
                    {i.alreadyQuoted ? (
                      <span style={{ fontSize: 13, color: "var(--k-green-primary)" }}>✓ You have quoted this.</span>
                    ) : quoting === i.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="Amount (₦)" style={inputStyle} />
                        <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope of work" style={inputStyle} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-primary" style={{ height: 38, padding: "0 16px" }} disabled={busy} onClick={() => submitQuote(i.id)}>Submit Quote</button>
                          <button className="btn btn-outline" style={{ height: 38, padding: "0 16px" }} onClick={() => setQuoting(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-outline" style={{ height: 38, padding: "0 16px" }} onClick={() => { setQuoting(i.id); setAmount(""); setScope(""); }}>Submit a Quote</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: 17, marginBottom: 10 }}>Your Work</h2>
            {ws.myWork.length === 0 ? (
              <div className="card" style={{ padding: 18, color: "var(--k-text-muted)" }}>No accepted Work yet. Once a landlord accepts your Quote, the Work appears here.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ws.myWork.map((w) => (
                  <div key={w.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14 }}>Work · {w.status}</span>
                    {w.status === "IN_PROGRESS" ? (
                      <button className="btn btn-primary" style={{ height: 36, padding: "0 14px", fontSize: 13 }} disabled={busy} onClick={() => submitWork(w.id)}>Submit completion</button>
                    ) : w.status === "COMPLETION_SUBMITTED" ? (
                      <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>Awaiting the landlord&apos;s acceptance</span>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--k-green-primary)" }}>Accepted</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 16 }}>Submitting completion does not close the Work. The landlord accepts it (BP-12).</p>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 12px", fontSize: 14 };
