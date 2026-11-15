"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface View {
  reference: string;
  kind: string;
  subjectName: string;
  status: string;
  fulfilled: boolean;
  package: Record<string, unknown> | null;
  fulfilledAt: string | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--k-border)", fontSize: 13.5 }}>
      <span style={{ color: "var(--k-text-muted)" }}>{label}</span>
      <span style={{ textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

/** Render the disclosed copy (access) or the erasure summary, straight from the package JSON. */
function Package({ kind, pkg }: { kind: string; pkg: Record<string, unknown> }) {
  if (kind === "ERASURE") {
    const erased = (pkg.erased as { category: string; detail: string }[]) ?? [];
    const retained = (pkg.retained as { category: string; basis: string; count?: number }[]) ?? [];
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Erased</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {erased.map((e, i) => (
              <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--k-border)", borderRadius: 10 }}>
                <strong style={{ fontSize: 13.5 }}>{e.category}</strong>
                <div style={{ fontSize: 13, color: "var(--k-text-muted)", marginTop: 2 }}>{e.detail}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Kept, because the law requires it</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {retained.map((r, i) => (
              <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--k-border)", borderRadius: 10, background: "var(--k-surface-muted)" }}>
                <strong style={{ fontSize: 13.5 }}>{r.category}{typeof r.count === "number" ? ` (${r.count})` : ""}</strong>
                <div style={{ fontSize: 13, color: "var(--k-text-muted)", marginTop: 2 }}>{r.basis}</div>
              </div>
            ))}
          </div>
        </div>
        {typeof pkg.note === "string" && <p style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>{pkg.note}</p>}
      </div>
    );
  }

  const profile = (pkg.profile as Record<string, unknown>) ?? {};
  const contacts = (pkg.contactPoints as { channel: string; value: string; verified: boolean }[]) ?? [];
  const properties = (pkg.properties as { reference: string; address: string; basis: string }[]) ?? [];
  const terms = (pkg.termsAccepted as { channel: string; acceptedAt: string }[]) ?? [];
  const retained = (pkg.retained as { category: string; basis: string; count?: number }[]) ?? [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Profile</h3>
        <Field label="Name" value={String(profile.name ?? "")} />
        <Field label="Role" value={String(profile.role ?? "")} />
        <Field label="Email verified" value={profile.emailVerified ? "Yes" : "No"} />
        <Field label="Phone verified" value={profile.phoneVerified ? "Yes" : "No"} />
        <Field label="Joined" value={profile.joinedAt ? new Date(String(profile.joinedAt)).toLocaleDateString() : ""} />
      </div>
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Contact details</h3>
        {contacts.length === 0 ? <p style={{ fontSize: 13, color: "var(--k-text-muted)" }}>None on file.</p> : contacts.map((c, i) => <Field key={i} label={c.channel} value={`${c.value || "(hidden)"}${c.verified ? " ✓" : ""}`} />)}
      </div>
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Properties on your account</h3>
        {properties.length === 0 ? <p style={{ fontSize: 13, color: "var(--k-text-muted)" }}>None.</p> : properties.map((p, i) => <Field key={i} label={p.reference} value={p.address} />)}
      </div>
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Agreements and conversations</h3>
        <Field label="Terms accepted" value={`${terms.length} time${terms.length === 1 ? "" : "s"}`} />
        <Field label="WhatsApp messages on record" value={String(pkg.conversationMessages ?? 0)} />
      </div>
      {retained.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 6 }}>Kept under a legal basis</h3>
          {retained.map((r, i) => (
            <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--k-border)", borderRadius: 10, background: "var(--k-surface-muted)", marginBottom: 6 }}>
              <strong style={{ fontSize: 13.5 }}>{r.category}{typeof r.count === "number" ? ` (${r.count})` : ""}</strong>
              <div style={{ fontSize: 13, color: "var(--k-text-muted)", marginTop: 2 }}>{r.basis}</div>
            </div>
          ))}
        </div>
      )}
      {typeof pkg.note === "string" && <p style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>{pkg.note}</p>}
    </div>
  );
}

export default function DataRequestPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/data-request/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This link is not valid");
      setV(json);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/data-request/${token}/confirm`, { method: "POST", headers: { "content-type": "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not complete your request");
      setV(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isErase = v?.kind === "ERASURE";

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
            <h1 style={{ fontSize: 21, marginBottom: 4 }}>{isErase ? "Erase my data" : "Get a copy of my data"}</h1>
            <p style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 18 }}>
              Request {v.reference} for {v.subjectName}. Your right under the Nigeria Data Protection Act.
            </p>

            {v.fulfilled && v.package ? (
              <>
                <div style={{ background: "var(--k-green-soft)", color: "var(--k-green-deep)", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 18 }}>
                  {isErase ? "✓ Your data has been erased." : "✓ Identity confirmed. Here is the data Kiataker holds about you."}
                </div>
                <Package kind={v.kind} pkg={v.package} />
              </>
            ) : v.status === "REFUSED" ? (
              <div style={{ background: "var(--k-warning-bg)", color: "var(--k-warning-fg)", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                This request was declined. Our team will be in touch.
              </div>
            ) : (
              <>
                {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
                <p style={{ fontSize: 13.5, marginBottom: 14 }}>
                  {isErase
                    ? "Confirm it is really you to erase your personal data. Records Kiataker must keep by law stay, and we will show you which. This cannot be undone."
                    : "Confirm it is really you to see the personal data Kiataker holds about you."}
                </p>
                <button className="btn btn-primary" style={{ width: "100%", height: 46 }} disabled={busy} onClick={confirm}>
                  {busy ? "..." : isErase ? "Confirm and erase my data" : "Confirm and show my data"}
                </button>
                <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 14, textAlign: "center" }}>This secure link is for you only and expires in 7 days.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
