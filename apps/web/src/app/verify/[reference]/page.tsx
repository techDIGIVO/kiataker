"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface Verification {
  reference: string;
  type: string;
  title: string;
  status: string;
  contentHash: string | null;
  sealedAt: string | null;
  signedAt: string | null;
  valid: boolean;
  signatures: { role: string; name: string; method: string; status: string; signedAt: string | null }[];
}

export default function VerifyPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const [v, setV] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [copy, setCopy] = useState("");
  const [tamper, setTamper] = useState<null | boolean>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/verify/${reference}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "No document with that reference");
        setV(json);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [reference]);

  async function check() {
    setChecking(true);
    setTamper(null);
    try {
      const res = await fetch(`${API_BASE}/v1/verify/${reference}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: copy }) });
      const json = await res.json();
      setTamper(Boolean(json.matches));
    } catch {
      setTamper(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 620, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>

        {error && !v && (
          <div>
            <h1 style={{ fontSize: 21, marginBottom: 8 }}>Not found</h1>
            <p style={{ fontSize: 14, color: "var(--k-text-muted)" }}>{error}</p>
          </div>
        )}

        {v && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: v.valid ? "var(--k-green-primary)" : "var(--k-warning-fg)" }} />
              <h1 style={{ fontSize: 21 }}>{v.valid ? "Authentic document" : "Not valid"}</h1>
            </div>
            <p style={{ fontSize: 14, marginBottom: 2 }}>{v.title}</p>
            <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 12 }}>Reference {v.reference} · status {v.status}</p>

            <a className="btn btn-outline" href={`${API_BASE}/v1/verify/${v.reference}/pdf`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", height: 38, padding: "0 16px", fontSize: 13.5, marginBottom: 16 }}>
              Download PDF
            </a>

            <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
              <Field label="Seal (SHA-256)" value={v.contentHash ? `${v.contentHash.slice(0, 32)}…` : "none"} mono />
              <Field label="Sealed" value={v.sealedAt ? new Date(v.sealedAt).toLocaleString() : "not sealed"} />
              <Field label="Fully signed" value={v.signedAt ? new Date(v.signedAt).toLocaleString() : "not yet"} />
            </div>

            <h2 style={{ fontSize: 15, marginBottom: 8 }}>Signatures</h2>
            {v.signatures.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--k-text-muted)", marginBottom: 18 }}>No signatures requested.</p>
            ) : (
              <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
                {v.signatures.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "8px 12px", border: "1px solid var(--k-border)", borderRadius: 9 }}>
                    <span>{s.name} ({s.role.toLowerCase()}, {s.method.toLowerCase()})</span>
                    <span style={{ color: s.status === "SIGNED" ? "var(--k-green-primary)" : "var(--k-text-muted)" }}>{s.status === "SIGNED" ? `signed ${s.signedAt ? new Date(s.signedAt).toLocaleDateString() : ""}` : "awaiting"}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--k-border)", paddingTop: 16 }}>
              <h2 style={{ fontSize: 15, marginBottom: 6 }}>Tamper check</h2>
              <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 10 }}>Paste a copy of the document to confirm it matches the sealed original, exactly.</p>
              <textarea value={copy} onChange={(e) => { setCopy(e.target.value); setTamper(null); }} placeholder="Paste the document text here" style={{ width: "100%", minHeight: 110, borderRadius: 10, border: "1px solid var(--k-border)", padding: 12, fontSize: 13, fontFamily: "var(--k-font-mono)", marginBottom: 10 }} />
              <button className="btn btn-outline" style={{ height: 42, padding: "0 18px" }} disabled={checking || !copy} onClick={check}>
                {checking ? "Checking..." : "Check this copy"}
              </button>
              {tamper !== null && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, fontSize: 14, background: tamper ? "var(--k-green-soft)" : "var(--k-warning-bg)", color: tamper ? "var(--k-green-deep)" : "var(--k-warning-fg)" }}>
                  {tamper ? "✓ This copy matches the sealed original. It has not been altered." : "✗ This copy does not match the seal. It has been altered or is not the sealed version."}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5 }}>
      <span style={{ color: "var(--k-text-muted)" }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--k-font-mono)" : "inherit" }}>{value}</span>
    </div>
  );
}
