"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface SignView {
  reference: string;
  title: string;
  body: string;
  signerName: string;
  signerRole: string;
  signed: boolean;
}

export default function SignPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [doc, setDoc] = useState<SignView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/sign/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This link is not valid");
      setDoc(json);
      if (json.signed) setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function sign() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/sign/${token}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not sign");
      setDone(true);
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

        {error && !doc && <p style={{ color: "var(--k-warning-fg)", fontSize: 14 }}>{error}</p>}

        {doc && (
          <>
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>{doc.title}</h1>
            <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 16 }}>Reference {doc.reference}</p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--k-font-mono)", fontSize: 13, background: "var(--k-surface-muted)", borderRadius: 10, padding: 16, marginBottom: 18, lineHeight: 1.6 }}>{doc.body}</pre>
            {done ? (
              <div style={{ background: "var(--k-green-soft)", color: "var(--k-green-deep)", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                ✓ Signed as {doc.signerName} ({doc.signerRole.toLowerCase()}). This signature is recorded against the sealed document.
              </div>
            ) : (
              <>
                {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
                <button className="btn btn-primary" style={{ width: "100%", height: 48, fontSize: 16 }} disabled={busy} onClick={sign}>
                  {busy ? "Signing..." : `Sign as ${doc.signerRole.toLowerCase()} (${doc.signerName})`}
                </button>
                <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 14, textAlign: "center" }}>
                  Signing records your name and the sealed document hash as your e-signature.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
