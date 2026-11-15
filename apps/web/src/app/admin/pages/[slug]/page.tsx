"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getToken, apiGet, apiSend } from "@/lib/admin-api";
import { BlockView } from "@/cms/render";
import { DEFAULT_HOME } from "@/cms/default-home";
import { BACKGROUND_OPTIONS } from "@/cms/style";
import { FIELD_SCHEMA, BLOCK_LABELS, ADDABLE, newBlock } from "@/cms/field-schema";
import type { FieldDef } from "@/cms/field-schema";
import type { Block, BlockType } from "@/cms/types";
import { Field, type MediaItem } from "@/cms/builder/fields";

function getPath(obj: any, path: string) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj: any, path: string, val: any) {
  const keys = path.split(".");
  const next = { ...obj };
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]!] = { ...(cur[keys[i]!] ?? {}) };
    cur = cur[keys[i]!];
  }
  cur[keys[keys.length - 1]!] = val;
  return next;
}

const STYLE_FIELDS: FieldDef[] = [
  { key: "background", label: "Background", type: "select", options: BACKGROUND_OPTIONS },
  { key: "paddingTop", label: "Space above (px)", type: "number" },
  { key: "paddingBottom", label: "Space below (px)", type: "number" },
  { key: "align", label: "Align", type: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
];

export default function PageBuilder() {
  const slug = (useParams().slug as string) ?? "home";
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"layers" | "add">("layers");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/admin/login";
      return;
    }
    (async () => {
      try {
        const page = await apiGet<{ draft?: { blocks: Block[] } } | null>(`/internal/pages/${slug}`);
        setBlocks(page?.draft?.blocks?.length ? page.draft.blocks : DEFAULT_HOME.blocks);
        const m = await apiGet<MediaItem[]>("/internal/media");
        setMedia(m);
      } catch (e) {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((e as Error).message)) window.location.href = "/admin/login";
        else setBlocks(DEFAULT_HOME.blocks);
      }
      setLoading(false);
    })();
  }, [slug]);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const mark = () => setDirty(true);

  function updateProps(id: string, key: string, value: any) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, props: setPath(b.props, key, value) } : b)));
    mark();
  }
  function updateStyle(id: string, key: string, value: any) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, style: { ...(b.style ?? {}), [key]: value } } : b)));
    mark();
  }
  function move(id: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      const a = next[i];
      const b = next[j];
      if (a && b) {
        next[i] = b;
        next[j] = a;
      }
      return next;
    });
    mark();
  }
  function duplicate(id: string) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const copy = JSON.parse(JSON.stringify(bs[i])) as Block;
      copy.id = "b_" + Math.random().toString(36).slice(2, 10);
      const next = [...bs];
      next.splice(i + 1, 0, copy);
      return next;
    });
    mark();
  }
  function remove(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    mark();
  }
  function add(type: BlockType) {
    const b = newBlock(type);
    setBlocks((bs) => [...bs, b]);
    setSelectedId(b.id);
    setTab("layers");
    mark();
  }
  function reorder(from: number, to: number) {
    setBlocks((bs) => {
      const next = [...bs];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m!);
      return next;
    });
    mark();
  }

  async function onUpload(file: File): Promise<string | null> {
    const dataUrl: string = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1] ?? "";
    try {
      const out = await apiSend<{ url: string; id: string; filename: string }>("POST", "/internal/uploads", {
        filename: file.name,
        mimeType: file.type,
        dataBase64: base64,
      });
      setMedia((m) => [{ id: out.id, url: out.url, filename: out.filename }, ...m]);
      return out.url;
    } catch (e) {
      setStatus("Upload failed: " + (e as Error).message);
      return null;
    }
  }

  async function save(publish = false) {
    setStatus(publish ? "Publishing..." : "Saving...");
    try {
      await apiSend("PUT", `/internal/pages/${slug}`, { title: "Home", draft: { blocks } });
      if (publish) await apiSend("POST", `/internal/pages/${slug}/publish`, {});
      setDirty(false);
      setStatus(publish ? "Published ✔ live on the site" : "Draft saved ✔");
    } catch (e) {
      setStatus("Error: " + (e as Error).message);
    }
  }

  const ctx = { media, onUpload };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--k-surface-muted)" }}>
      {/* Top bar */}
      <div style={{ height: 60, flex: "none", background: "#fff", borderBottom: "1px solid var(--k-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/admin" style={{ fontSize: 14, color: "var(--k-text-secondary)" }}>← Admin</a>
          <strong style={{ fontSize: 15 }}>Page builder</strong>
          <span style={{ fontSize: 12.5, color: "var(--k-text-muted)", fontFamily: "var(--k-font-mono)" }}>/{slug}</span>
          {dirty && <span style={{ fontSize: 12, color: "var(--k-warning-fg)" }}>unsaved changes</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {status && <span style={{ fontSize: 13, color: "var(--k-text-secondary)" }}>{status}</span>}
          <a className="btn btn-outline" style={{ height: 40, fontSize: 14, padding: "0 14px" }} href="/" target="_blank" rel="noreferrer">Preview site</a>
          <button className="btn btn-outline" style={{ height: 40, fontSize: 14, padding: "0 16px" }} onClick={() => save(false)}>Save draft</button>
          <button className="btn btn-primary" style={{ height: 40, fontSize: 14, padding: "0 18px" }} onClick={() => save(true)}>Publish</button>
        </div>
      </div>

      <div className="bld-shell">
        {/* Sidebar */}
        <aside className="bld-side">
          {selected ? (
            <SettingsPanel block={selected} ctx={ctx} onProp={(k, v) => updateProps(selected.id, k, v)} onStyle={(k, v) => updateStyle(selected.id, k, v)} onClose={() => setSelectedId(null)} onDelete={() => remove(selected.id)} />
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "var(--k-surface-muted)", padding: 4, borderRadius: 10 }}>
                {(["layers", "add"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 36, border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 13.5, background: tab === t ? "#fff" : "transparent", color: tab === t ? "var(--k-green-primary)" : "var(--k-text-secondary)", boxShadow: tab === t ? "var(--k-shadow-card)" : "none" }}>
                    {t === "layers" ? "Layers" : "Add block"}
                  </button>
                ))}
              </div>
              {tab === "layers" ? (
                <div>
                  {blocks.map((b, i) => (
                    <div
                      key={b.id}
                      className="bld-layer"
                      data-selected={selectedId === b.id}
                      draggable
                      onDragStart={() => (dragIndex.current = i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragIndex.current != null && dragIndex.current !== i) reorder(dragIndex.current, i); dragIndex.current = null; }}
                      onClick={() => setSelectedId(b.id)}
                    >
                      <span className="bld-layer-handle">⋮⋮</span>
                      <span style={{ flex: 1 }}>{BLOCK_LABELS[b.type]}</span>
                      <MiniIcon onClick={(e) => { e.stopPropagation(); move(b.id, -1); }}>↑</MiniIcon>
                      <MiniIcon onClick={(e) => { e.stopPropagation(); move(b.id, 1); }}>↓</MiniIcon>
                      <MiniIcon onClick={(e) => { e.stopPropagation(); duplicate(b.id); }}>⧉</MiniIcon>
                      <MiniIcon onClick={(e) => { e.stopPropagation(); remove(b.id); }}>×</MiniIcon>
                    </div>
                  ))}
                  {blocks.length === 0 && <p style={{ fontSize: 13, color: "var(--k-text-muted)" }}>No blocks yet. Use Add block.</p>}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {ADDABLE.map((t) => (
                    <button key={t} onClick={() => add(t)} style={{ padding: "14px 10px", border: "1px solid var(--k-border)", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left" }}>
                      + {BLOCK_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Preview */}
        <main style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {loading ? (
            <div style={{ padding: 40, color: "var(--k-text-muted)" }}>Loading the builder...</div>
          ) : (
            blocks.map((b) => (
              <div key={b.id} className="bld-block" data-selected={selectedId === b.id}>
                <div className="bld-overlay" onClick={() => setSelectedId(b.id)} />
                <div className="bld-toolbar">
                  <span className="bld-tb-label">{BLOCK_LABELS[b.type]}</span>
                  <button className="bld-tb-btn" onClick={() => move(b.id, -1)}>↑</button>
                  <button className="bld-tb-btn" onClick={() => move(b.id, 1)}>↓</button>
                  <button className="bld-tb-btn" onClick={() => duplicate(b.id)}>⧉</button>
                  <button className="bld-tb-btn" onClick={() => setSelectedId(b.id)}>✎</button>
                  <button className="bld-tb-btn" onClick={() => remove(b.id)}>🗑</button>
                </div>
                <BlockView block={b} />
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsPanel({ block, ctx, onProp, onStyle, onClose, onDelete }: {
  block: Block;
  ctx: { media: MediaItem[]; onUpload: (f: File) => Promise<string | null> };
  onProp: (k: string, v: any) => void;
  onStyle: (k: string, v: any) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const fields = FIELD_SCHEMA[block.type] ?? [];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, color: "var(--k-text-secondary)", fontWeight: 600 }}>← All blocks</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--k-green-primary)", background: "var(--k-green-soft)", padding: "4px 10px", borderRadius: 999 }}>{BLOCK_LABELS[block.type]}</span>
      </div>
      {fields.map((f) => (
        <Field key={f.key} field={f} value={getPath(block.props, f.key)} onChange={(v) => onProp(f.key, v)} ctx={ctx} />
      ))}
      <div style={{ borderTop: "1px solid var(--k-border)", margin: "8px 0 16px", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--k-text-muted)", marginBottom: 12 }}>Section style</div>
        {STYLE_FIELDS.map((f) => (
          <Field key={f.key} field={f} value={(block.style as any)?.[f.key]} onChange={(v) => onStyle(f.key, v)} ctx={ctx} />
        ))}
      </div>
      <button className="btn btn-outline" style={{ width: "100%", color: "var(--k-danger-fg)", borderColor: "var(--k-danger-bg)" }} onClick={onDelete}>Delete block</button>
    </div>
  );
}

function MiniIcon({ onClick, children }: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ width: 24, height: 24, border: "1px solid var(--k-border)", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{children}</button>;
}
