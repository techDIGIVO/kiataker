"use client";

import { useState } from "react";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

export default function ProviderApplyPage() {
  const [form, setForm] = useState({ name: "", services: "", contactEmail: "", contactPhone: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    if (!form.name.trim() || !form.services.trim()) {
      setError("Please give your firm's name and the services you offer.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/providers/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not submit your application");
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 480, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>

        {done ? (
          <>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Application received</h1>
            <p style={{ fontSize: 14, color: "var(--k-text-secondary)" }}>
              Thank you. Our team reviews every provider. If you&apos;re admitted, we&apos;ll send you a workspace link to start quoting Work.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>Join Konnect</h1>
            <p style={{ fontSize: 14, color: "var(--k-text-muted)", marginBottom: 18 }}>Apply to deliver maintenance Work for landlords on Kiataker.</p>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Firm name" value={form.name} onChange={(v) => set("name", v)} placeholder="SafeFix Services" />
              <Field label="Services you offer" value={form.services} onChange={(v) => set("services", v)} placeholder="Plumbing, electrical, general repairs" />
              <Field label="Email (optional)" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} placeholder="hello@safefix.ng" />
              <Field label="Phone (optional)" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="+234..." />
              {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5 }}>{error}</p>}
              <button className="btn btn-primary" style={{ height: 46 }} disabled={busy} onClick={submit}>
                {busy ? "Submitting..." : "Apply to join"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
      <span style={{ color: "var(--k-text-muted)" }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ height: 42, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 12px", fontSize: 14 }} />
    </label>
  );
}
