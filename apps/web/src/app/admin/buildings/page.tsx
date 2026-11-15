"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface Unit {
  id: string;
  reference: string;
  label: string;
  unitUse: string;
  state: string;
  regime: string;
}
interface Building {
  id: string;
  reference: string;
  addressRaw: string;
  use: string;
  mixedUse: boolean;
  unitCount: number;
  residentialCount: number;
  commercialCount: number;
  units: Unit[];
}

const USE_LABEL: Record<string, string> = { RESIDENTIAL: "Flat", SHOP: "Shop", OFFICE: "Office", WAREHOUSE: "Warehouse", OTHER_BUSINESS: "Business" };

export default function BuildingsBoard() {
  const [rows, setRows] = useState<Building[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Building[]>("/internal/board/buildings")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addUnit(buildingId: string, unitUse: string) {
    setBusy(buildingId); setError(""); setNotice("");
    try { await apiSend("POST", `/internal/buildings/${buildingId}/units`, { unitUse }); setNotice("Unit added."); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  const mixed = rows.filter((b) => b.mixedUse).length;

  return (
    <AdminShell active="buildings" title="Buildings" subtitle="Grouped buildings with more than one unit (GJ-24). A building holding both flats and shops is mixed-use; each unit is governed by its own regime.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading buildings...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Buildings" value={rows.length} />
            <StatCard label="Mixed-use" value={mixed} />
          </div>

          {rows.length === 0 ? (
            <Section title="Buildings"><Empty>No grouped buildings yet. Landlords set them up from WhatsApp.</Empty></Section>
          ) : (
            rows.map((b) => (
              <Section key={b.id} title={`${b.reference} · ${b.addressRaw}`} subtitle={`${b.unitCount} unit${b.unitCount === 1 ? "" : "s"}: ${b.residentialCount} residential, ${b.commercialCount} commercial`}>
                <div style={{ padding: "0 16px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Tag tone={b.mixedUse ? "info" : "muted"}>{b.use}</Tag>
                  {b.mixedUse && <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>Residential and commercial units under one building.</span>}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button className="btn btn-outline" style={{ height: 30, fontSize: 12.5, padding: "0 10px" }} disabled={busy === b.id} onClick={() => addUnit(b.id, "RESIDENTIAL")}>Add flat</button>
                    <button className="btn btn-outline" style={{ height: 30, fontSize: 12.5, padding: "0 10px" }} disabled={busy === b.id} onClick={() => addUnit(b.id, "SHOP")}>Add shop</button>
                    <button className="btn btn-outline" style={{ height: 30, fontSize: 12.5, padding: "0 10px" }} disabled={busy === b.id} onClick={() => addUnit(b.id, "OFFICE")}>Add office</button>
                  </div>
                </div>
                {b.units.length === 0 ? (
                  <Empty>No units added yet.</Empty>
                ) : (
                  <Table head={["Unit", "Reference", "Use", "Regime", "State"]}>
                    {b.units.map((u) => (
                      <tr key={u.id}>
                        <Td>{u.label}</Td>
                        <Td mono>{u.reference}</Td>
                        <Td>{USE_LABEL[u.unitUse] ?? u.unitUse}</Td>
                        <Td><Tag tone={u.regime === "RESIDENTIAL" ? "ok" : "info"}>{u.regime}</Tag></Td>
                        <Td>{u.state}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Section>
            ))
          )}
        </>
      )}
    </AdminShell>
  );
}
