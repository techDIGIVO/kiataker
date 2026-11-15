"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  status: string;
  rejectionReason: string | null;
}
interface QuietHours {
  startHour: number;
  endHour: number;
}
interface Notification {
  id: string;
  templateName: string;
  status: string;
  reason: string | null;
  scheduledFor: string | null;
  createdAt: string;
}

export default function WhatsAppChannel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quiet, setQuiet] = useState<QuietHours | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // new template form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [body, setBody] = useState("");
  const [qStart, setQStart] = useState("");
  const [qEnd, setQEnd] = useState("");

  function load() {
    return Promise.all([
      apiGet<Template[]>("/internal/whatsapp/templates"),
      apiGet<QuietHours>("/internal/whatsapp/quiet-hours"),
      apiGet<Notification[]>("/internal/whatsapp/notifications"),
    ])
      .then(([t, q, n]) => {
        setTemplates(t);
        setQuiet(q);
        setNotifications(n);
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
    load();
  }, []);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setError("");
    setMsg("");
    try {
      await fn();
      await load();
      setMsg(okMsg);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const createTemplate = () =>
    run(async () => {
      if (!name.trim() || !body.trim()) throw new Error("Name and body are required.");
      await apiSend("POST", "/internal/whatsapp/templates", { name, category, body });
      setName("");
      setBody("");
    }, "Template created");

  const saveQuiet = () =>
    run(async () => {
      await apiSend("PUT", "/internal/whatsapp/quiet-hours", { startHour: Number(qStart), endHour: Number(qEnd) });
      setQStart("");
      setQEnd("");
    }, "Quiet hours saved");

  return (
    <AdminShell active="whatsapp" title="WhatsApp channel" subtitle="Message templates (Meta approval) and quiet hours for proactive messages.">
      {error && <Banner tone="warn">{error}</Banner>}
      {msg && <Banner>{msg}</Banner>}
      {loading ? (
        <Banner>Loading channel settings...</Banner>
      ) : (
        <>
          <Section title="Quiet hours" subtitle="Proactive messages raised in this window are deferred to the next open hour, never dropped.">
            <div style={{ padding: 20, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ fontSize: 14 }}>
                Currently {quiet ? `${pad(quiet.startHour)}:00 to ${pad(quiet.endHour)}:00` : "not set"}
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span style={{ color: "var(--k-text-muted)" }}>Start hour (0–23)</span>
                <input value={qStart} onChange={(e) => setQStart(e.target.value)} type="number" min={0} max={23} placeholder={quiet ? String(quiet.startHour) : "21"} style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span style={{ color: "var(--k-text-muted)" }}>End hour (0–23)</span>
                <input value={qEnd} onChange={(e) => setQEnd(e.target.value)} type="number" min={0} max={23} placeholder={quiet ? String(quiet.endHour) : "8"} style={inputStyle} />
              </label>
              <button className="btn btn-primary" style={{ height: 40, padding: "0 18px" }} disabled={qStart === "" || qEnd === ""} onClick={saveQuiet}>
                Save quiet hours
              </button>
            </div>
          </Section>

          <Section title="Message templates" subtitle="Business-initiated messages must use a Meta-approved template. Use {{1}}, {{2}} for variables.">
            <div style={{ padding: 20, display: "grid", gap: 10, maxWidth: 620, borderBottom: "1px solid var(--k-border)" }}>
              <strong style={{ fontSize: 14 }}>New template</strong>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="template_name" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, width: 170 }}>
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your rent of {{1}} is now due on {{2}}." style={{ ...inputStyle, minHeight: 64, resize: "vertical", padding: "10px 12px" }} />
              <button className="btn btn-primary" style={{ height: 40, width: "fit-content", padding: "0 18px" }} onClick={createTemplate}>
                Create template
              </button>
            </div>
            {templates.length === 0 ? (
              <Empty>No templates yet.</Empty>
            ) : (
              <Table head={["Name", "Category", "Status", "Body", "Actions"]}>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <Td mono>{t.name}</Td>
                    <Td>{t.category}</Td>
                    <Td><Tag tone={statusTone(t.status)}>{t.status}</Tag>{t.rejectionReason ? <div style={{ fontSize: 12, color: "var(--k-text-muted)" }}>{t.rejectionReason}</div> : null}</Td>
                    <Td>{t.body}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {t.status === "DRAFT" && (
                          <button className="btn btn-outline" style={btnSm} onClick={() => run(() => apiSend("POST", `/internal/whatsapp/templates/${t.id}/submit`, {}), "Submitted for approval")}>Submit</button>
                        )}
                        {t.status !== "APPROVED" && (
                          <button className="btn btn-outline" style={btnSm} onClick={() => run(() => apiSend("PUT", `/internal/whatsapp/templates/${t.id}/status`, { status: "APPROVED" }), "Marked approved")}>Mark approved</button>
                        )}
                        {t.status !== "REJECTED" && (
                          <button className="btn btn-outline" style={btnSm} onClick={() => run(() => apiSend("PUT", `/internal/whatsapp/templates/${t.id}/status`, { status: "REJECTED", rejectionReason: "Rejected by Meta" }), "Marked rejected")}>Mark rejected</button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <Section title="Proactive notification queue" subtitle="Deferred messages wait for the open window. Process runs anything now due.">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--k-border)" }}>
              <button className="btn btn-outline" style={{ height: 36, padding: "0 14px", fontSize: 13 }} onClick={() => run(() => apiSend("POST", "/internal/whatsapp/notifications/process", {}), "Processed due notifications")}>
                Process due now
              </button>
            </div>
            {notifications.length === 0 ? (
              <Empty>No notifications yet.</Empty>
            ) : (
              <Table head={["Template", "Status", "Reason", "Scheduled"]}>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <Td mono>{n.templateName}</Td>
                    <Td><Tag tone={statusTone(n.status)}>{n.status}</Tag></Td>
                    <Td>{n.reason ?? "None"}</Td>
                    <Td>{n.scheduledFor ? new Date(n.scheduledFor).toLocaleString() : "None"}</Td>
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

function pad(h: number): string {
  return String(h).padStart(2, "0");
}
const inputStyle: React.CSSProperties = { height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 12px", fontSize: 14, background: "#fff" };
const btnSm: React.CSSProperties = { height: 30, fontSize: 12, padding: "0 10px" };
