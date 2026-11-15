"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface Item {
  area: string;
  condition: string;
  note?: string;
}
interface View {
  kind: string;
  status: string;
  property: string | null;
  items: Item[];
  responded: boolean;
}

export default function ConditionConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/condition/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This link is not valid");
      setV(json);
      if (json.responded) setResult(json.status);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function respond(kind: "CONFIRM" | "DISPUTE") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/condition/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not record your response");
      setResult(json.status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 520, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>

        {error && !v && <p style={{ color: "var(--k-warning-fg)", fontSize: 14 }}>{error}</p>}

        {v && (
          <>
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>{v.kind === "EXIT" ? "Move-out condition" : "Handover condition"}</h1>
            {v.property && <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 16 }}>{v.property}</p>}

            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {v.items.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--k-text-muted)" }}>No items recorded.</p>
              ) : (
                v.items.map((it, i) => (
                  <div key={i} style={{ padding: "10px 14px", border: "1px solid var(--k-border)", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <strong>{it.area}</strong>
                      <span style={{ color: "var(--k-text-secondary)" }}>{it.condition}</span>
                    </div>
                    {it.note && <div style={{ fontSize: 13, color: "var(--k-text-muted)", marginTop: 2 }}>{it.note}</div>}
                  </div>
                ))
              )}
            </div>

            {result ? (
              <div style={{ background: result === "CONFIRMED" ? "var(--k-green-soft)" : "var(--k-warning-bg)", color: result === "CONFIRMED" ? "var(--k-green-deep)" : "var(--k-warning-fg)", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                {result === "CONFIRMED" ? "✓ You confirmed this condition record. It is the agreed baseline for your tenancy." : "You disputed this condition record. Your landlord and our team will follow up."}
              </div>
            ) : (
              <>
                {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
                <p style={{ fontSize: 13.5, marginBottom: 12 }}>Does this match the condition you see?</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1, height: 46 }} disabled={busy} onClick={() => respond("CONFIRM")}>
                    {busy ? "..." : "Yes, confirm"}
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1, height: 46 }} disabled={busy} onClick={() => respond("DISPUTE")}>
                    No, dispute
                  </button>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 14, textAlign: "center" }}>You can confirm or dispute. You cannot edit the record.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
