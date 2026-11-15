"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Job {
  id: string;
  kind: string;
  subjectRef: string | null;
  state: string;
  runAt: string;
  createdAt: string;
}

export default function JobsBoard() {
  const [rows, setRows] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<Job[]>("/internal/board/jobs")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(ok); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const pending = rows.filter((r) => r.state === "PENDING").length;

  return (
    <AdminShell active="jobs" title="Job queue" subtitle="Durable scheduled work (P0-05). Jobs persist in the database and survive restarts; the scheduler runs due jobs automatically, and you can run them now.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading jobs...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Jobs" value={rows.length} />
            <StatCard label="Pending" value={pending} tone={pending ? "warn" : "ok"} />
          </div>

          <Section title="Controls" subtitle="Enqueue a test job or process everything that is due right now.">
            <div style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-outline" disabled={busy} onClick={() => run(() => apiSend("POST", "/internal/jobs", { kind: "noop" }), "Enqueued a noop job.")}>Enqueue test job</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => run(() => apiSend("POST", "/internal/jobs/process", {}), "Processed due jobs.")}>Process due now</button>
            </div>
          </Section>

          <Section title="Scheduled jobs" subtitle="Newest first. A job is PENDING until its runAt passes, then RUNNING, then DONE / FAILED / SKIPPED (no handler).">
            {rows.length === 0 ? (
              <Empty>No scheduled jobs yet.</Empty>
            ) : (
              <Table head={["Kind", "Subject", "State", "Run at", "Created"]}>
                {rows.map((j) => (
                  <tr key={j.id}>
                    <Td mono>{j.kind}</Td>
                    <Td mono>{j.subjectRef ?? "None"}</Td>
                    <Td><Tag tone={statusTone(j.state === "DONE" ? "COMPLETED" : j.state === "FAILED" ? "REJECTED" : j.state)}>{j.state}</Tag></Td>
                    <Td>{new Date(j.runAt).toLocaleString()}</Td>
                    <Td>{new Date(j.createdAt).toLocaleString()}</Td>
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
