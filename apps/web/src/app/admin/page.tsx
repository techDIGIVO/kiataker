"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Overview {
  landlords: number;
  properties: number;
  tenancies: number;
  openActions: number;
  controlsEnabled: number;
  pendingDisputes: number;
}
interface QueueRow {
  id: string;
  title: string;
  callToAction: string;
  priority: string;
  status: string;
  property: string | null;
}
interface Landlord {
  id: string;
  displayName: string;
  status: string;
  properties: number;
  tenancies: number;
}
interface Control {
  key: string;
  enabled: boolean;
  risk: string;
  parentKey: string | null;
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  async function toggleControl(c: Control) {
    const next = !c.enabled;
    let reason: string | undefined;
    if (c.risk === "HIGH") {
      const entered = window.prompt(`This is a high-risk control. It needs CEO sign-off. Enter a reason to propose turning it ${next ? "on" : "off"}:`) ?? "";
      if (!entered.trim()) return;
      reason = entered.trim();
    }
    setBusyKey(c.key);
    setError("");
    setNotice("");
    try {
      const res = await apiSend<{ mode: string }>("PUT", `/internal/controls/${c.key}`, { enabled: next, reason });
      if (res.mode === "PENDING_SIGN_OFF") {
        setNotice(`Proposed. ${c.key} is held for CEO sign-off. Review it under CEO sign-off.`);
      } else {
        setControls(await apiGet<Control[]>("/internal/controls"));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey("");
    }
  }

  useEffect(() => {
    Promise.all([
      apiGet<Overview>("/internal/overview"),
      apiGet<QueueRow[]>("/internal/centres/operations/queue"),
      apiGet<Landlord[]>("/internal/landlords"),
      apiGet<Control[]>("/internal/controls"),
    ])
      .then(([o, q, l, c]) => {
        setOverview(o);
        setQueue(q);
        setLandlords(l);
        setControls(c);
        setLoading(false);
      })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) {
          window.location.href = "/admin/login";
        } else {
          setError((err as Error).message);
          setLoading(false);
        }
      });
  }, []);

  return (
    <AdminShell
      active="overview"
      title="Operations Command Centre"
      subtitle="Queues, records and platform controls, under least privilege."
      actions={
        <>
          <a className="btn btn-outline" style={{ height: 42, fontSize: 14, padding: "0 16px" }} href="/admin/ai">
            Integrations &amp; keys
          </a>
          <a className="btn btn-primary" style={{ height: 42, fontSize: 14, padding: "0 16px" }} href="/admin/pages/home">
            Edit landing page
          </a>
        </>
      }
    >
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading the Command Centre...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Landlords" value={overview?.landlords ?? 0} />
            <StatCard label="Properties" value={overview?.properties ?? 0} />
            <StatCard label="Tenancies" value={overview?.tenancies ?? 0} />
            <StatCard label="Open actions" value={overview?.openActions ?? 0} tone={overview && overview.openActions > 0 ? "warn" : "ok"} />
            <StatCard label="Pending disputes" value={overview?.pendingDisputes ?? 0} tone={overview && overview.pendingDisputes > 0 ? "warn" : "ok"} />
            <StatCard label="Controls on" value={overview?.controlsEnabled ?? 0} />
          </div>

          <Section title="Operations queue" subtitle="Open actions across every landlord, highest priority first.">
            {queue.length === 0 ? (
              <Empty>All clear. No open actions.</Empty>
            ) : (
              <Table head={["Item", "Call to action", "Priority", "Status", "Property"]}>
                {queue.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.title}</Td>
                    <Td>{r.callToAction}</Td>
                    <Td><Tag tone={r.priority === "OVERDUE" || r.priority === "URGENT" ? "warn" : "muted"}>{r.priority}</Tag></Td>
                    <Td>{r.status}</Td>
                    <Td>{r.property ?? "None"}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <Section title="Platform controls" subtitle="Features ship behind their control and fail closed until switched on. A high-risk change is not applied here; it is proposed and held for CEO sign-off (GJ-18).">
            <Table head={["Control", "State", "Risk", "Depends on", ""]}>
              {controls.map((c) => (
                <tr key={c.key}>
                  <Td mono>{c.key}</Td>
                  <Td><Tag tone={c.enabled ? "ok" : "muted"}>{c.enabled ? "On" : "Off"}</Tag></Td>
                  <Td><Tag tone={c.risk === "HIGH" ? "warn" : "muted"}>{c.risk}</Tag></Td>
                  <Td mono>{c.parentKey ?? "None"}</Td>
                  <Td>
                    <button
                      className="btn btn-outline"
                      style={{ height: 32, fontSize: 12.5, padding: "0 12px" }}
                      disabled={busyKey === c.key}
                      onClick={() => toggleControl(c)}
                    >
                      {busyKey === c.key ? "…" : c.risk === "HIGH" ? (c.enabled ? "Propose off" : "Propose on") : c.enabled ? "Turn off" : "Turn on"}
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="Landlords (360)" subtitle="Every onboarded landlord and their portfolio.">
            {landlords.length === 0 ? (
              <Empty>No landlords yet.</Empty>
            ) : (
              <Table head={["Landlord", "Status", "Properties", "Tenancies"]}>
                {landlords.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.displayName}</Td>
                    <Td><Tag tone={statusTone(l.status)}>{l.status}</Tag></Td>
                    <Td>{l.properties}</Td>
                    <Td>{l.tenancies}</Td>
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
