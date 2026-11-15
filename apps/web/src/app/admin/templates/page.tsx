"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface Version {
  id: string;
  version: number;
  name: string;
  legalBasis: string | null;
  fields: string[];
  body: string;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}
interface Template {
  id: string;
  code: string;
  name: string;
  versionCount: number;
  hasApproved: boolean;
  versions: Version[];
}

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid var(--k-border)", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginBottom: 10, fontFamily: "var(--k-font-body)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--k-text-secondary)", marginBottom: 5 };

export default function TemplateStudio() {
  const [rows, setRows] = useState<Template[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ code: "", name: "", legalBasis: "", body: "" });
  const [addVersionFor, setAddVersionFor] = useState<string | null>(null);
  const [versionDraft, setVersionDraft] = useState({ name: "", legalBasis: "", body: "" });
  const [preview, setPreview] = useState<{ id: string; rendered: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows(await apiGet<Template[]>("/internal/board/templates"));
      setLoading(false);
    } catch (err) {
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
      else { setError((err as Error).message); setLoading(false); }
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(ok); await load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const createTemplate = () =>
    run(async () => {
      await apiSend("POST", "/internal/templates", draft);
      setDraft({ code: "", name: "", legalBasis: "", body: "" });
    }, "Template created (version 1, awaiting counsel approval).");

  const addVersion = (id: string) =>
    run(async () => {
      await apiSend("POST", `/internal/templates/${id}/versions`, versionDraft);
      setAddVersionFor(null); setVersionDraft({ name: "", legalBasis: "", body: "" });
    }, "New version added, awaiting counsel approval.");

  const approve = (versionId: string) => {
    const counselName = window.prompt("Counsel name recording this approval (optional):") ?? undefined;
    return run(() => apiSend("POST", `/internal/template-versions/${versionId}/approve`, { counselName }), "Version approved. The notice engine can now use it.");
  };

  async function showPreview(versionId: string) {
    setError("");
    try {
      const r = await apiSend<{ rendered: string }>("POST", `/internal/template-versions/${versionId}/preview`, { values: {} });
      setPreview({ id: versionId, rendered: r.rendered });
    } catch (err) { setError((err as Error).message); }
  }

  const approvedCount = rows.filter((t) => t.hasApproved).length;

  return (
    <AdminShell active="templates" title="Template studio" subtitle="Author and counsel-approve notice and agreement templates (NT/AG codes, P0-09). The notice engine only instructs a counsel-approved version; versions are append-only.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading templates...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Templates" value={rows.length} />
            <StatCard label="With an approved version" value={approvedCount} />
          </div>

          <Section title="New template" subtitle="Use {placeholders} in the body, e.g. {tenantName}, {propertyAddress}, {effectiveDate}. Placeholders are detected automatically.">
            <div style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Code</label>
                  <input style={inputStyle} placeholder="NT-03" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} placeholder="Notice to Remedy a Breach" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
              </div>
              <label style={labelStyle}>Legal basis</label>
              <input style={inputStyle} placeholder="Lagos State Tenancy Law 2011, s.13" value={draft.legalBasis} onChange={(e) => setDraft({ ...draft, legalBasis: e.target.value })} />
              <label style={labelStyle}>Body</label>
              <textarea style={{ ...inputStyle, minHeight: 120, fontFamily: "var(--k-font-mono)", fontSize: 13 }} placeholder={"NOTICE TO REMEDY A BREACH\n\nTo {tenantName},\nRe: {propertyAddress}\n\nTake notice that..."} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              <button className="btn btn-primary" disabled={busy || !draft.code || !draft.name || !draft.body} onClick={createTemplate}>Create template</button>
            </div>
          </Section>

          {rows.length === 0 ? (
            <Section title="Templates"><Empty>No templates yet.</Empty></Section>
          ) : (
            rows.map((t) => (
              <Section key={t.id} title={`${t.code} · ${t.name}`} subtitle={`${t.versionCount} version${t.versionCount === 1 ? "" : "s"}${t.hasApproved ? "" : " · no approved version yet"}`}>
                <Table head={["Version", "Status", "Legal basis", "Fields", ""]}>
                  {t.versions.map((v) => (
                    <tr key={v.id}>
                      <Td>v{v.version}</Td>
                      <Td><Tag tone={v.approved ? "ok" : "muted"}>{v.approved ? "Approved" : "Draft"}</Tag>{v.approved && v.approvedAt && <div style={{ fontSize: 12, color: "var(--k-text-muted)", marginTop: 3 }}>{v.approvedBy} · {new Date(v.approvedAt).toLocaleDateString()}</div>}</Td>
                      <Td>{v.legalBasis ?? "none"}</Td>
                      <Td mono>{v.fields.join(", ") || "none"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} onClick={() => showPreview(v.id)}>Preview</button>
                          {!v.approved && <button className="btn btn-primary" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busy} onClick={() => approve(v.id)}>Approve</button>}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Table>
                <div style={{ padding: "12px 16px" }}>
                  {addVersionFor === t.id ? (
                    <div style={{ borderTop: "1px solid var(--k-border)", paddingTop: 14 }}>
                      <label style={labelStyle}>New version name</label>
                      <input style={inputStyle} value={versionDraft.name} onChange={(e) => setVersionDraft({ ...versionDraft, name: e.target.value })} />
                      <label style={labelStyle}>Legal basis</label>
                      <input style={inputStyle} value={versionDraft.legalBasis} onChange={(e) => setVersionDraft({ ...versionDraft, legalBasis: e.target.value })} />
                      <label style={labelStyle}>Body</label>
                      <textarea style={{ ...inputStyle, minHeight: 110, fontFamily: "var(--k-font-mono)", fontSize: 13 }} value={versionDraft.body} onChange={(e) => setVersionDraft({ ...versionDraft, body: e.target.value })} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" disabled={busy || !versionDraft.name || !versionDraft.body} onClick={() => addVersion(t.id)}>Save version</button>
                        <button className="btn btn-outline" onClick={() => setAddVersionFor(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-outline" style={{ height: 34, fontSize: 13 }} onClick={() => { setAddVersionFor(t.id); setVersionDraft({ name: t.name, legalBasis: t.versions[0]?.legalBasis ?? "", body: t.versions[0]?.body ?? "" }); }}>Add a version</button>
                  )}
                </div>
                {preview && t.versions.some((v) => v.id === preview.id) && (
                  <div style={{ margin: "0 16px 16px", padding: 16, background: "var(--k-surface-muted)", borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--k-text-muted)", marginBottom: 8 }}>PREVIEW (placeholders shown as [field])</div>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--k-font-mono)", fontSize: 13, margin: 0 }}>{preview.rendered}</pre>
                  </div>
                )}
              </Section>
            ))
          )}
        </>
      )}
    </AdminShell>
  );
}
