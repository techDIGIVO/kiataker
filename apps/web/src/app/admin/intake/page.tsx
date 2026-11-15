"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Landlord {
  id: string;
  displayName: string;
}
interface Batch {
  id: string;
  landlord: string | null;
  status: string;
  rowCount: number;
  committedCount: number;
  createdAt: string;
}
interface Row {
  addressRaw: string;
  buildingUse: string;
  tenantName: string;
  rentKobo: string;
  frequency: string;
  commencementDate: string;
  expiryDate: string;
}

function parseLines(text: string): Row[] {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [addressRaw, tenantName, rentNaira] = l.split("|").map((s) => s.trim());
      return {
        addressRaw: addressRaw ?? "",
        buildingUse: "RESIDENTIAL",
        tenantName: tenantName ?? "",
        rentKobo: String((Number((rentNaira ?? "0").replace(/[^0-9]/g, "")) || 0) * 100),
        frequency: "annual",
        commencementDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
      };
    })
    .filter((r) => r.addressRaw && r.tenantName);
}

export default function IntakeBoard() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [landlordId, setLandlordId] = useState("");
  const [lines, setLines] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    return Promise.all([apiGet<Landlord[]>("/internal/landlords"), apiGet<Batch[]>("/internal/board/intake")])
      .then(([l, b]) => {
        setLandlords(l);
        setBatches(b);
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

  async function createAndSend() {
    const rows = parseLines(lines);
    if (!landlordId) { setError("Pick a landlord."); return; }
    if (rows.length === 0) { setError("Add at least one row: address | tenant | annual rent."); return; }
    setBusy(true);
    setError("");
    setMsg("");
    setLink(null);
    try {
      const batch = await apiSend<{ id: string }>("POST", "/internal/intake", { landlordId, rows });
      const sent = await apiSend<{ confirmUrl: string }>("POST", `/internal/intake/${batch.id}/send`, {});
      setLink(sent.confirmUrl);
      setLines("");
      setMsg(`Batch of ${rows.length} created and sent for confirmation.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend(id: string) {
    setError(""); setMsg("");
    try { const r = await apiSend<{ confirmUrl: string }>("POST", `/internal/intake/${id}/send`, {}); setLink(r.confirmUrl); setMsg("Confirmation link re-issued."); load(); }
    catch (e) { setError((e as Error).message); }
  }

  const committed = batches.reduce((s, b) => s + b.committedCount, 0);

  return (
    <AdminShell active="intake" title="Bulk intake" subtitle="Concierge onboarding (GJ-23). Capture many tenancies, the landlord confirms, then they are created in one go.">
      {error && <Banner tone="warn">{error}</Banner>}
      {msg && <Banner>{msg}</Banner>}
      {link && (
        <Banner>
          Landlord confirm link: <span style={{ fontFamily: "var(--k-font-mono)", fontSize: 13 }}>{link}</span>
        </Banner>
      )}
      {loading ? (
        <Banner>Loading intake...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Batches" value={batches.length} />
            <StatCard label="Tenancies created" value={committed} />
          </div>

          <Section title="New batch" subtitle="One row per line: address | tenant name | annual rent. The landlord confirms before anything is created.">
            <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 640 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span style={{ color: "var(--k-text-muted)" }}>Landlord</span>
                <select value={landlordId} onChange={(e) => setLandlordId(e.target.value)} style={{ height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 10px", fontSize: 14, background: "#fff" }}>
                  <option value="">Select a landlord…</option>
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>{l.displayName}</option>
                  ))}
                </select>
              </label>
              <textarea
                value={lines}
                onChange={(e) => setLines(e.target.value)}
                placeholder={"12 Marina Road, Lagos | Ada Obi | 1500000\n7 Allen Ave, Ikeja | Bola Ade | 900000"}
                style={{ minHeight: 120, borderRadius: 10, border: "1px solid var(--k-border)", padding: 12, fontSize: 13.5, fontFamily: "var(--k-font-mono)" }}
              />
              <button className="btn btn-primary" style={{ height: 42, width: "fit-content", padding: "0 18px" }} disabled={busy} onClick={createAndSend}>
                {busy ? "Creating..." : "Create & send for confirmation"}
              </button>
            </div>
          </Section>

          <Section title="Batches" subtitle="A batch is created only after the landlord confirms it.">
            {batches.length === 0 ? (
              <Empty>No intake batches yet.</Empty>
            ) : (
              <Table head={["Landlord", "Rows", "Status", "Created", "Date", "Action"]}>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <Td>{b.landlord ?? "None"}</Td>
                    <Td>{b.rowCount}</Td>
                    <Td><Tag tone={statusTone(b.status === "COMMITTED" ? "COMPLETED" : b.status === "REJECTED" ? "DISPUTED" : b.status)}>{b.status}</Tag></Td>
                    <Td>{b.committedCount}</Td>
                    <Td>{new Date(b.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      {b.status === "DRAFT" || b.status === "AWAITING_LANDLORD" ? (
                        <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} onClick={() => resend(b.id)}>Resend link</button>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>None</span>
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
