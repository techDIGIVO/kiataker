"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface ChangeRequest {
  id: string;
  controlKey: string;
  fromEnabled: boolean;
  toEnabled: boolean;
  risk: string;
  reason: string;
  status: string;
  decisionReason: string | null;
  createdAt: string;
}

export default function SignOffBoard() {
  const [rows, setRows] = useState<ChangeRequest[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      const r = await apiGet<ChangeRequest[]>("/internal/control-changes");
      setRows(r);
      setLoading(false);
    } catch (err) {
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
      else {
        setError((err as Error).message);
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(id: string, action: "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      const entered = window.prompt("Reason for declining this control change:") ?? "";
      if (!entered.trim()) return;
      reason = entered.trim();
    } else {
      reason = window.prompt("Add a sign-off note (optional):") ?? undefined;
    }
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await apiSend("POST", `/internal/control-changes/${id}/${action}`, { reason });
      setNotice(action === "approve" ? "Signed off. The control change has been applied." : "Declined. The control did not change.");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId("");
    }
  }

  const pending = rows.filter((r) => r.status === "PENDING");

  return (
    <AdminShell active="signoff" title="CEO sign-off" subtitle="High-risk platform control changes wait here for a CEO Command Centre decision (GJ-18, BP-08). The person who proposed a change cannot sign it off.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading sign-off queue...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Awaiting sign-off" value={pending.length} tone={pending.length ? "warn" : undefined} />
            <StatCard label="All changes" value={rows.length} />
          </div>

          <Section title="Change requests" subtitle="Approve applies the change atomically and audits it. Decline leaves the control untouched. Only the CEO Command Centre can decide.">
            {rows.length === 0 ? (
              <Empty>No high-risk control changes have been proposed.</Empty>
            ) : (
              <Table head={["Control", "Change", "Risk", "Reason", "Status", "Decision"]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td mono>{r.controlKey}</Td>
                    <Td>{r.fromEnabled ? "On" : "Off"} → <strong>{r.toEnabled ? "On" : "Off"}</strong></Td>
                    <Td><Tag tone="warn">{r.risk}</Tag></Td>
                    <Td>{r.reason}</Td>
                    <Td><Tag tone={statusTone(r.status === "APPLIED" ? "APPROVED" : r.status)}>{r.status}</Tag></Td>
                    <Td>
                      {r.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-primary" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>
                            {busyId === r.id ? "…" : "Sign off"}
                          </button>
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}>
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>{r.decisionReason ?? "No note"}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
