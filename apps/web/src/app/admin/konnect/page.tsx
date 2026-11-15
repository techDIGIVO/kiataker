"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, fmtNaira, statusTone } from "@/components/admin-ui";

interface IssueRow {
  id: string;
  category: string;
  description: string;
  urgency: string;
  status: string;
  property: string | null;
  quoteCount: number;
  workStatus: string | null;
  workId: string | null;
  createdAt: string;
}
interface Quote {
  id: string;
  providerName: string;
  amountKobo: string;
  scope: string;
  status: string;
}
interface IssueDetail extends Omit<IssueRow, "quoteCount" | "workStatus" | "workId"> {
  quotes: Quote[];
  work: { id: string; status: string; providerName: string; acceptedAt: string | null } | null;
}

export default function KonnectBoard() {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [selected, setSelected] = useState<IssueDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function loadBoard() {
    return apiGet<IssueRow[]>("/internal/board/issues")
      .then((rows) => {
        setIssues(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else {
          setError((err as Error).message);
          setLoading(false);
        }
      });
  }

  useEffect(() => {
    loadBoard();
  }, []);

  function openIssue(id: string) {
    setError("");
    apiGet<IssueDetail>(`/internal/board/issues/${id}`).then(setSelected).catch((e) => setError((e as Error).message));
  }

  const open = issues.filter((i) => !["COMPLETED"].includes(i.status)).length;
  const awaitingAcceptance = issues.filter((i) => i.workStatus === "COMPLETION_SUBMITTED").length;

  return (
    <AdminShell active="konnect" title="Konnect & maintenance" subtitle="Reported issues, provider Quotes and Work. Vocabulary is Work and Quote (GJ-09).">
      {error && <Banner tone="warn">{error}</Banner>}
      {loading ? (
        <Banner>Loading issues...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Total issues" value={issues.length} />
            <StatCard label="Open" value={open} tone={open > 0 ? "warn" : "ok"} />
            <StatCard label="Awaiting landlord acceptance" value={awaitingAcceptance} tone={awaitingAcceptance > 0 ? "warn" : "ok"} />
          </div>

          <Section title="Issues" subtitle="Admit sealed Quotes and record Work completion. Landlord acceptance closes the Work (BP-12).">
            {issues.length === 0 ? (
              <Empty>No issues reported yet.</Empty>
            ) : (
              <Table head={["Category", "Property", "Urgency", "Status", "Quotes", "Work", ""]}>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <Td>{i.category}</Td>
                    <Td>{i.property ?? "None"}</Td>
                    <Td><Tag tone={i.urgency === "URGENT" ? "warn" : "muted"}>{i.urgency}</Tag></Td>
                    <Td><Tag tone={statusTone(i.status)}>{i.status}</Tag></Td>
                    <Td>{i.quoteCount}</Td>
                    <Td>{i.workStatus ? <Tag tone={statusTone(i.workStatus)}>{i.workStatus}</Tag> : "None"}</Td>
                    <Td>
                      <button className="btn btn-outline" style={{ height: 34, fontSize: 13, padding: "0 14px" }} onClick={() => openIssue(i.id)}>
                        Manage
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {selected && (
            <IssuePanel
              detail={selected}
              onClose={() => setSelected(null)}
              onChanged={() => {
                openIssue(selected.id);
                loadBoard();
              }}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

function IssuePanel({ detail, onClose, onChanged }: { detail: IssueDetail; onClose: () => void; onChanged: () => void }) {
  const [providerName, setProviderName] = useState("");
  const [amountNaira, setAmountNaira] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  async function admitQuote() {
    if (!providerName || !amountNaira || !scope) {
      setMsg("Provider, amount and scope are all required.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const amountKobo = (BigInt(Math.round(Number(amountNaira) * 100))).toString();
      await apiSend("POST", `/internal/issues/${detail.id}/quotes`, { providerName, amountKobo, scope });
      setProviderName("");
      setAmountNaira("");
      setScope("");
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEvidence() {
    if (!detail.work) return;
    setBusy(true);
    setMsg("");
    try {
      await apiSend("POST", `/internal/work/${detail.work.id}/evidence`, { evidence: { note: note || "Work completed", submittedAt: new Date().toISOString() } });
      setNote("");
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canQuote = ["REPORTED", "QUOTING"].includes(detail.status);
  const canSubmitEvidence = detail.work?.status === "IN_PROGRESS";

  return (
    <Section title={`Issue: ${detail.category}`} subtitle={detail.property ?? undefined}>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 14, marginBottom: 6 }}>{detail.description}</p>
            <Tag tone={statusTone(detail.status)}>{detail.status}</Tag>
          </div>
          <button className="btn btn-outline" style={{ height: 34, fontSize: 13, padding: "0 14px" }} onClick={onClose}>
            Close
          </button>
        </div>

        {msg && <Banner tone="warn">{msg}</Banner>}

        <h3 style={{ fontSize: 15, margin: "10px 0 8px" }}>Quotes</h3>
        {detail.quotes.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--k-text-muted)", marginBottom: 12 }}>No Quotes admitted yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {detail.quotes.map((q) => (
              <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--k-border)", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{q.providerName} · {fmtNaira(q.amountKobo)}</div>
                  <div style={{ fontSize: 13, color: "var(--k-text-muted)" }}>{q.scope}</div>
                </div>
                <Tag tone={statusTone(q.status)}>{q.status}</Tag>
              </div>
            ))}
          </div>
        )}

        {canQuote && (
          <div style={{ border: "1px solid var(--k-border)", borderRadius: 10, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
            <strong style={{ fontSize: 14 }}>Admit a sealed Quote</strong>
            <Field label="Provider" value={providerName} onChange={setProviderName} placeholder="SafeFix Services" />
            <Field label="Amount (₦)" value={amountNaira} onChange={setAmountNaira} placeholder="45000" type="number" />
            <Field label="Scope" value={scope} onChange={setScope} placeholder="Replace tap and seals" />
            <button className="btn btn-primary" style={{ height: 40, width: "fit-content", padding: "0 18px" }} disabled={busy} onClick={admitQuote}>
              {busy ? "Admitting..." : "Admit Quote"}
            </button>
          </div>
        )}

        <h3 style={{ fontSize: 15, margin: "10px 0 8px" }}>Work</h3>
        {!detail.work ? (
          <p style={{ fontSize: 13.5, color: "var(--k-text-muted)" }}>
            No Work yet. Work begins once the landlord accepts a Quote (that acceptance happens on the landlord&apos;s side).
          </p>
        ) : (
          <div style={{ border: "1px solid var(--k-border)", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{detail.work.providerName}</span>
              <Tag tone={statusTone(detail.work.status)}>{detail.work.status}</Tag>
            </div>
            {canSubmitEvidence && (
              <>
                <Field label="Completion note" value={note} onChange={setNote} placeholder="Tap replaced, pressure tested" />
                <button className="btn btn-primary" style={{ height: 40, width: "fit-content", padding: "0 18px" }} disabled={busy} onClick={submitEvidence}>
                  {busy ? "Submitting..." : "Submit completion with evidence"}
                </button>
                <p style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>
                  Submitting completion does not close the Work. The landlord accepts it to close it (BP-12).
                </p>
              </>
            )}
            {detail.work.status === "COMPLETION_SUBMITTED" && (
              <p style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>Awaiting the landlord&apos;s acceptance to complete.</p>
            )}
            {detail.work.status === "COMPLETED" && detail.work.acceptedAt && (
              <p style={{ fontSize: 12.5, color: "var(--k-green-primary)" }}>Accepted by the landlord on {new Date(detail.work.acceptedAt).toLocaleString()}.</p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
      <span style={{ color: "var(--k-text-muted)" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type ?? "text"}
        style={{ height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 12px", fontSize: 14 }}
      />
    </label>
  );
}
