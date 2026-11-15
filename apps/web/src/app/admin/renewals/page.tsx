"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface Runway {
  tenancyId: string;
  property: string | null;
  tenant: string | null;
  decision: string | null;
  stage: string;
  expiryDate: string | null;
  lastSafeNoticeDate: string | null;
}

function stageTone(stage: string): "ok" | "warn" | "muted" | "info" {
  if (stage === "RENEWED") return "ok";
  if (stage === "POSSESSION_READY") return "warn";
  if (stage === "NOTICE_TO_QUIT" || stage === "NOTICE_SERVED") return "info";
  return "muted";
}

export default function RenewalsBoard() {
  const [rows, setRows] = useState<Runway[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Runway[]>("/internal/board/renewals")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(tenancyId: string, path: string, body: unknown, ok: string) {
    setBusy(tenancyId); setError(""); setNotice("");
    try { await apiSend("POST", `/internal/renewals/${tenancyId}/${path}`, body); setNotice(ok); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }
  function renew(tenancyId: string) {
    const months = window.prompt("Renew for how many months?", "12");
    if (!months) return;
    act(tenancyId, "renew", { months: Number(months) }, "Tenancy renewed.");
  }
  function decline(tenancyId: string) {
    if (!window.confirm("Decline renewal and open the Notice to Quit runway?")) return;
    act(tenancyId, "not-renew", {}, "Renewal declined; possession runway opened.");
  }
  function advance(tenancyId: string) {
    act(tenancyId, "advance", {}, "Runway advanced one stage.");
  }

  const renewed = rows.filter((r) => r.decision === "RENEW").length;
  const runways = rows.filter((r) => r.decision === "NOT_RENEW").length;

  return (
    <AdminShell active="renewals" title="Renewals" subtitle="Renewal decisions and the Notice to Quit runway (GJ-22). The runway is anchored on the last safe date to serve notice.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading renewals...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Renewed" value={renewed} />
            <StatCard label="Possession runways" value={runways} tone={runways > 0 ? "warn" : "ok"} />
          </div>

          <Section title="Renewal decisions" subtitle="A declined renewal opens a staged runway to recover possession.">
            {rows.length === 0 ? (
              <Empty>No renewal decisions recorded yet.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Decision", "Stage", "Expiry", "Last safe notice", "Actions"]}>
                {rows.map((r) => (
                  <tr key={r.tenancyId + r.stage}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td>{r.decision ? <Tag tone={r.decision === "RENEW" ? "ok" : "warn"}>{r.decision}</Tag> : "pending"}</Td>
                    <Td><Tag tone={stageTone(r.stage)}>{r.stage}</Tag></Td>
                    <Td>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : "None"}</Td>
                    <Td>{r.lastSafeNoticeDate ? new Date(r.lastSafeNoticeDate).toLocaleDateString() : "None"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {r.decision !== "RENEW" && r.stage !== "RENEWED" && (
                          <button className="btn btn-primary" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.tenancyId} onClick={() => renew(r.tenancyId)}>Renew</button>
                        )}
                        {!r.decision && (
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.tenancyId} onClick={() => decline(r.tenancyId)}>Decline</button>
                        )}
                        {r.decision === "NOT_RENEW" && r.stage !== "POSSESSION_READY" && (
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.tenancyId} onClick={() => advance(r.tenancyId)}>Advance</button>
                        )}
                      </div>
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
