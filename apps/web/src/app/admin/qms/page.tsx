"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface Row {
  id: string;
  reference: string;
  address: string;
  buildingUse: string;
  state: string;
  qcStatus: string;
  createdAt: string;
}
interface Board {
  counts: Record<string, number>;
  rows: Row[];
}

function qcTone(s: string): "ok" | "warn" | "muted" | "info" {
  if (s === "PASSED") return "ok";
  if (s === "FLAGGED") return "warn";
  if (s === "IN_REVIEW") return "info";
  return "muted";
}

export default function QmsBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Board>("/internal/board/qms")
      .then((r) => { setBoard(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, qcStatus: string) {
    let note: string | undefined;
    if (qcStatus === "FLAGGED") {
      const entered = window.prompt("Flagging this property. Note the data-quality issue:") ?? "";
      if (!entered.trim()) return;
      note = entered.trim();
    }
    setBusy(id); setError(""); setNotice("");
    try { await apiSend("PUT", `/internal/qms/${id}`, { qcStatus, note }); setNotice(`QC set to ${qcStatus}.`); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  const c = board?.counts ?? {};

  return (
    <AdminShell active="qms" title="Quality (QMS)" subtitle="Review each Property File for data quality and sign it off (P4). NOT_STARTED to IN_REVIEW to PASSED or FLAGGED, each change audited.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading QMS...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Not started" value={c.NOT_STARTED ?? 0} />
            <StatCard label="In review" value={c.IN_REVIEW ?? 0} />
            <StatCard label="Passed" value={c.PASSED ?? 0} tone="ok" />
            <StatCard label="Flagged" value={c.FLAGGED ?? 0} tone={(c.FLAGGED ?? 0) > 0 ? "warn" : undefined} />
          </div>

          <Section title="Property files" subtitle="Set a file In review, then Pass it or Flag it with a note.">
            {!board || board.rows.length === 0 ? (
              <Empty>No property files to review.</Empty>
            ) : (
              <Table head={["Reference", "Address", "Use", "State", "QC", "Review"]}>
                {board.rows.map((r) => (
                  <tr key={r.id}>
                    <Td mono>{r.reference}</Td>
                    <Td>{r.address}</Td>
                    <Td>{r.buildingUse}</Td>
                    <Td>{r.state}</Td>
                    <Td><Tag tone={qcTone(r.qcStatus)}>{r.qcStatus}</Tag></Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.qcStatus !== "IN_REVIEW" && r.qcStatus !== "PASSED" && (
                          <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === r.id} onClick={() => setStatus(r.id, "IN_REVIEW")}>In review</button>
                        )}
                        <button className="btn btn-primary" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === r.id} onClick={() => setStatus(r.id, "PASSED")}>Pass</button>
                        <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === r.id} onClick={() => setStatus(r.id, "FLAGGED")}>Flag</button>
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
