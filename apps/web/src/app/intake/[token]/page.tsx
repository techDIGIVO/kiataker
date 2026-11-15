"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface Row {
  addressRaw: string;
  tenantName: string;
  rentKobo: string;
  frequency: string;
}
interface View {
  status: string;
  committed: boolean;
  rows: Row[];
}

function naira(kobo: string): string {
  return `₦${(BigInt(kobo || "0") / 100n).toLocaleString("en-NG")}`;
}

export default function IntakeConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { created: number } | "REJECTED">(null);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/intake/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This link is not valid");
      setV(json);
      if (json.committed) setResult({ created: json.rows.length });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function act(kind: "confirm" | "reject") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/intake/${token}/${kind}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not record your response");
      setResult(kind === "confirm" ? { created: json.created } : "REJECTED");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 560, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>

        {error && !v && <p style={{ color: "var(--k-warning-fg)", fontSize: 14 }}>{error}</p>}

        {v && (
          <>
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>Confirm your tenancies</h1>
            <p style={{ fontSize: 13.5, color: "var(--k-text-muted)", marginBottom: 16 }}>Our team captured these from your records. Please confirm they are accurate before we record them.</p>

            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {v.rows.map((r, i) => (
                <div key={i} style={{ padding: "10px 14px", border: "1px solid var(--k-border)", borderRadius: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.addressRaw}</div>
                  <div style={{ fontSize: 13, color: "var(--k-text-muted)" }}>{r.tenantName} · {naira(r.rentKobo)} / {r.frequency}</div>
                </div>
              ))}
            </div>

            {result ? (
              result === "REJECTED" ? (
                <div style={{ background: "var(--k-warning-bg)", color: "var(--k-warning-fg)", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                  You flagged these as not accurate. Our team will review them with you; nothing has been recorded.
                </div>
              ) : (
                <div style={{ background: "var(--k-green-soft)", color: "var(--k-green-deep)", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                  ✓ Confirmed. {result.created} tenanc{result.created === 1 ? "y is" : "ies are"} now on your account. Your tenants will be notified to confirm their details.
                </div>
              )
            ) : (
              <>
                {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
                <p style={{ fontSize: 13.5, marginBottom: 12 }}>Confirming records these as you state them; your tenants then confirm their own details.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1, height: 46 }} disabled={busy} onClick={() => act("confirm")}>
                    {busy ? "..." : "Yes, confirm all"}
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1, height: 46 }} disabled={busy} onClick={() => act("reject")}>
                    Not accurate
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
