"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface Centre { key: string; name: string }
interface Member { centre: string; name: string; role: string }
interface Staff {
  id: string;
  displayName: string;
  email: string | null;
  status: string;
  isSuperAdmin: boolean;
  centres: Member[];
}

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid var(--k-border)", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginBottom: 10 };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--k-text-secondary)", marginBottom: 5 };

export default function TeamBoard() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState({ displayName: "", email: "", password: "", centreKey: "operations", role: "" });

  const load = useCallback(() => {
    Promise.all([apiGet<Staff[]>("/internal/team"), apiGet<Centre[]>("/internal/command-centres")])
      .then(([s, c]) => { setStaff(s); setCentres(c); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string, id = "x") {
    setBusy(id); setError(""); setNotice("");
    try { await fn(); setNotice(ok); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  const add = () => run(async () => {
    await apiSend("POST", "/internal/team", { ...draft, role: draft.role.trim() || `${draft.centreKey}_member` });
    setDraft({ displayName: "", email: "", password: "", centreKey: "operations", role: "" });
  }, "Staff user added.");

  const setStatus = (id: string, status: string) => run(() => apiSend("PUT", `/internal/team/${id}/status`, { status }), `User ${status === "ACTIVE" ? "reactivated" : "suspended"}.`, id);
  const remove = (id: string) => { if (window.confirm("Remove this user? They are suspended and all access is revoked.")) run(() => apiSend("DELETE", `/internal/team/${id}`), "User removed.", id); };
  const assign = (id: string) => {
    const centreKey = window.prompt(`Assign to which centre? (${centres.map((c) => c.key).join(", ")})`);
    if (!centreKey) return;
    const role = window.prompt("Role for this centre:", `${centreKey}_member`) || `${centreKey}_member`;
    run(() => apiSend("POST", `/internal/team/${id}/centres`, { centreKey, role }), "Access assigned.", id);
  };
  const unassign = (id: string, centreKey: string) => run(() => apiSend("DELETE", `/internal/team/${id}/centres/${centreKey}`), "Access removed.", id);

  const supers = staff.filter((s) => s.isSuperAdmin).length;

  return (
    <AdminShell active="team" title="Team & access" subtitle="Manage staff and their Command Centre access (P0-07). Members of the CEO Command Centre are super-admins: full access and the only role that can manage the team.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading team...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Staff users" value={staff.length} />
            <StatCard label="Active" value={staff.filter((s) => s.status === "ACTIVE").length} />
            <StatCard label="Super-admins" value={supers} />
          </div>

          <Section title="Add a staff user" subtitle="They sign in with this email and password, with access to the chosen Command Centre.">
            <div style={{ padding: 20, maxWidth: 640 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={labelStyle}>Name</label><input style={inputStyle} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></div>
                <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div><label style={labelStyle}>Temp password</label><input style={inputStyle} type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></div>
                <div>
                  <label style={labelStyle}>Command Centre</label>
                  <select aria-label="Command Centre" style={inputStyle} value={draft.centreKey} onChange={(e) => setDraft({ ...draft, centreKey: e.target.value })}>
                    {centres.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Role (optional)</label><input style={inputStyle} value={draft.role} placeholder="e.g. analyst" onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></div>
              </div>
              <button className="btn btn-primary" disabled={busy === "x" || !draft.displayName || !draft.email || draft.password.length < 8} onClick={add}>Add user</button>
            </div>
          </Section>

          <Section title="Staff" subtitle="Members of the CEO centre are super-admins. Assign or remove centres, suspend or remove a user.">
            {staff.length === 0 ? (
              <Empty>No staff users.</Empty>
            ) : (
              <Table head={["Name", "Email", "Access", "Status", "Actions"]}>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <Td>{s.displayName}{s.isSuperAdmin && <Tag tone="info"> super-admin</Tag>}</Td>
                    <Td mono>{s.email ?? "None"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {s.centres.length === 0 ? <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>No centre</span> : s.centres.map((c) => (
                          <Tag key={c.centre} tone={c.centre === "ceo" ? "info" : "muted"}>
                            {c.centre} ({c.role}) <button onClick={() => unassign(s.id, c.centre)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", fontWeight: 700 }} aria-label={`Remove ${c.centre}`}>×</button>
                          </Tag>
                        ))}
                      </div>
                    </Td>
                    <Td><Tag tone={s.status === "ACTIVE" ? "ok" : "warn"}>{s.status}</Tag></Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === s.id} onClick={() => assign(s.id)}>Assign</button>
                        {s.status === "ACTIVE"
                          ? <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === s.id} onClick={() => setStatus(s.id, "SUSPENDED")}>Suspend</button>
                          : <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === s.id} onClick={() => setStatus(s.id, "ACTIVE")}>Reactivate</button>}
                        <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px", color: "var(--k-warning-fg)" }} disabled={busy === s.id} onClick={() => remove(s.id)}>Remove</button>
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
