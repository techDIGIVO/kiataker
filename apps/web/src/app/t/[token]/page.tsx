"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Logo } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface Task { purpose: string; recipientRole: string; expiresAt: string; state: string }

const PURPOSE_COPY: Record<string, { title: string; intro: string }> = {
  TENANT_CONFIRM: { title: "Confirm your tenancy record", intro: "Your landlord recorded a tenancy with Kiataker and asked you to confirm the details. You can confirm, dispute or correct. This does not create an account." },
  APPROVE_NOTICE: { title: "Approve and dispatch a notice", intro: "You instructed a notice on WhatsApp. Approving here authorises Kiataker to generate and dispatch it on your behalf, and preserves the evidence." },
  SIGN: { title: "Sign a document", intro: "Please review and sign." },
  PAYEE_CHANGE: { title: "Approve a payee change", intro: "Please review and approve this change." },
};

export default function SecureTaskPage() {
  const token = (useParams().token as string) ?? "";
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/t/${token}`);
        const json = await res.json();
        if (!res.ok) setError(json.message ?? "This link is not valid.");
        else setTask(json);
      } catch {
        setError("Could not reach Kiataker. Please try again.");
      }
      setLoading(false);
    })();
  }, [token]);

  async function respond(body: unknown, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/t/${token}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) setError(json.message ?? "Could not complete this.");
      else setDone(successMsg);
    } catch {
      setError("Could not reach Kiataker. Please try again.");
    }
    setBusy(false);
  }

  const copy = task ? (PURPOSE_COPY[task.purpose] ?? { title: "Secure task", intro: "Please complete this task." }) : null;

  return (
    <main style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: 30 }}>
        <div style={{ marginBottom: 22 }}><Logo /></div>

        {loading && <p>Loading...</p>}

        {!loading && error && (
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 10 }}>This link cannot be used</h1>
            <p style={{ fontSize: 15 }}>{error}</p>
          </div>
        )}

        {!loading && done && (
          <div>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "var(--k-green-soft)", color: "var(--k-green-primary)", display: "grid", placeItems: "center", marginBottom: 16 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
            </div>
            <h1 style={{ fontSize: 22, marginBottom: 10 }}>Done</h1>
            <p style={{ fontSize: 15 }}>{done} You can close this page and return to WhatsApp.</p>
          </div>
        )}

        {!loading && task && !done && !error && copy && (
          <div>
            <h1 style={{ fontSize: 23, marginBottom: 10 }}>{copy.title}</h1>
            <p style={{ fontSize: 15, marginBottom: 24 }}>{copy.intro}</p>

            {task.purpose === "TENANT_CONFIRM" && (
              <div style={{ display: "grid", gap: 10 }}>
                <button className="btn btn-primary" disabled={busy} onClick={() => respond({ kind: "CONFIRM" }, "You confirmed the record.")}>Confirm the details</button>
                <button className="btn btn-outline" disabled={busy} onClick={() => respond({ kind: "DISPUTE" }, "You disputed the record. Your landlord will review it.")}>Dispute</button>
                <button className="btn btn-outline" disabled={busy} onClick={() => respond({ kind: "CORRECT" }, "You asked for a correction. Your landlord will review it.")}>Correct</button>
              </div>
            )}

            {task.purpose === "APPROVE_NOTICE" && (
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => respond({ approve: true }, "You approved the notice. Kiataker is dispatching it now.")}>
                {busy ? "Approving..." : "Approve and dispatch"}
              </button>
            )}

            <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 20, borderTop: "1px solid var(--k-border)", paddingTop: 16 }}>
              This is a secure, time-limited link. Kiataker protects your personal data under the Nigeria Data Protection Act 2023. Questions? Reply to your Kiataker chat.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
