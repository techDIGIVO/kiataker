"use client";

import { useRef, useState } from "react";
import type { FieldDef } from "../field-schema";

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
}

interface Ctx {
  media: MediaItem[];
  onUpload: (file: File) => Promise<string | null>;
}

const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--k-text-secondary)", margin: "0 0 6px" };
const input: React.CSSProperties = { width: "100%", border: "1px solid var(--k-border)", borderRadius: 8, padding: "9px 11px", fontSize: 14, fontFamily: "var(--k-font-body)", background: "#fff" };

export function Field({ field, value, onChange, ctx }: { field: FieldDef; value: any; onChange: (v: any) => void; ctx: Ctx }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {field.type !== "boolean" && <label style={label}>{field.label}</label>}
      <FieldInner field={field} value={value} onChange={onChange} ctx={ctx} />
    </div>
  );
}

function FieldInner({ field, value, onChange, ctx }: { field: FieldDef; value: any; onChange: (v: any) => void; ctx: Ctx }) {
  switch (field.type) {
    case "text":
      return <input style={input} value={value ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <textarea style={{ ...input, minHeight: 72, resize: "vertical" }} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input style={input} type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />;
    case "boolean":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
          <span
            onClick={() => onChange(!value)}
            style={{ width: 40, height: 23, borderRadius: 999, background: value ? "var(--k-green-primary)" : "var(--k-border)", position: "relative", transition: "background .15s", flex: "none" }}
          >
            <span style={{ position: "absolute", top: 2, left: value ? 19 : 2, width: 19, height: 19, borderRadius: 999, background: "#fff", transition: "left .15s" }} />
          </span>
          {field.label}
        </label>
      );
    case "select":
      return (
        <select style={input} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "image":
      return <ImagePicker value={value} onChange={onChange} ctx={ctx} />;
    case "richtext":
      return <RichText value={value} onChange={onChange} />;
    case "stringlist":
      return <StringList value={value ?? []} onChange={onChange} />;
    case "repeater":
      return <Repeater field={field} value={value ?? []} onChange={onChange} ctx={ctx} />;
    default:
      return null;
  }
}

function ImagePicker({ value, onChange, ctx }: { value: string; onChange: (v: string) => void; ctx: Ctx }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lib, setLib] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await ctx.onUpload(file);
    setBusy(false);
    if (url) onChange(url);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 80, height: 60, borderRadius: 8, border: "1px solid var(--k-border)", background: "var(--k-surface-muted)", overflow: "hidden", flex: "none", display: "grid", placeItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 11, color: "var(--k-text-muted)" }}>No image</span>}
        </div>
        <div style={{ flex: 1, display: "grid", gap: 6 }}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <button type="button" className="btn btn-outline" style={{ height: 34, fontSize: 13, padding: "0 12px" }} onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Uploading..." : "Upload"}
          </button>
          <button type="button" className="btn btn-outline" style={{ height: 34, fontSize: 13, padding: "0 12px" }} onClick={() => setLib((v) => !v)}>
            {lib ? "Hide library" : "Library"}
          </button>
        </div>
      </div>
      <input style={{ ...input, marginTop: 8, fontSize: 12 }} value={value ?? ""} placeholder="or paste an image URL" onChange={(e) => onChange(e.target.value)} />
      {lib && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 8, maxHeight: 180, overflow: "auto" }}>
          {ctx.media.length === 0 && <span style={{ fontSize: 12, color: "var(--k-text-muted)" }}>No uploads yet.</span>}
          {ctx.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt={m.filename} onClick={() => { onChange(m.url); setLib(false); }} style={{ width: "100%", height: 54, objectFit: "cover", borderRadius: 6, cursor: "pointer", border: value === m.url ? "2px solid var(--k-green-primary)" : "1px solid var(--k-border)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function RichText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cmd = (c: string, arg?: string) => {
    document.execCommand(c, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };
  return (
    <div style={{ border: "1px solid var(--k-border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 2, padding: 6, borderBottom: "1px solid var(--k-border)", background: "var(--k-surface-muted)" }}>
        <TbBtn onClick={() => cmd("bold")} label="B" bold />
        <TbBtn onClick={() => cmd("italic")} label="i" italic />
        <TbBtn onClick={() => cmd("insertUnorderedList")} label="• List" />
        <TbBtn onClick={() => { const url = prompt("Link URL"); if (url) cmd("createLink", url); }} label="Link" />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        dangerouslySetInnerHTML={{ __html: value ?? "" }}
        style={{ minHeight: 90, padding: "10px 12px", fontSize: 14, outline: "none" }}
      />
    </div>
  );
}
function TbBtn({ onClick, label, bold, italic }: { onClick: () => void; label: string; bold?: boolean; italic?: boolean }) {
  return (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }} style={{ border: "none", background: "transparent", padding: "4px 9px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: bold ? 700 : 500, fontStyle: italic ? "italic" : "normal" }}>
      {label}
    </button>
  );
}

function StringList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {value.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input style={input} value={s} onChange={(e) => { const next = [...value]; next[i] = e.target.value; onChange(next); }} />
          <button type="button" className="btn btn-outline" style={{ height: 38, width: 38, padding: 0, fontSize: 16, flex: "none" }} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-outline" style={{ height: 34, fontSize: 13 }} onClick={() => onChange([...value, ""])}>+ Add</button>
    </div>
  );
}

function Repeater({ field, value, onChange, ctx }: { field: FieldDef; value: any[]; onChange: (v: any[]) => void; ctx: Ctx }) {
  const update = (i: number, key: string, v: any) => { const next = value.map((it, j) => (j === i ? { ...it, [key]: v } : it)); onChange(next); };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= value.length) return; const next = [...value]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  const add = () => { const blank: any = {}; field.itemFields?.forEach((f) => (blank[f.key] = f.type === "boolean" ? false : "")); onChange([...value, blank]); };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {value.map((item, i) => (
        <div key={i} style={{ border: "1px solid var(--k-border)", borderRadius: 10, padding: 12, background: "var(--k-surface-muted)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--k-text-muted)" }}>{field.itemLabel ?? "Item"} {i + 1}</span>
            <span style={{ display: "flex", gap: 4 }}>
              <MiniBtn onClick={() => move(i, -1)}>↑</MiniBtn>
              <MiniBtn onClick={() => move(i, 1)}>↓</MiniBtn>
              <MiniBtn onClick={() => onChange(value.filter((_, j) => j !== i))}>×</MiniBtn>
            </span>
          </div>
          {field.itemFields?.map((f) => (
            <Field key={f.key} field={f} value={item[f.key]} onChange={(v) => update(i, f.key, v)} ctx={ctx} />
          ))}
        </div>
      ))}
      <button type="button" className="btn btn-outline" style={{ height: 36, fontSize: 13 }} onClick={add}>+ Add {field.itemLabel ?? "item"}</button>
    </div>
  );
}
function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ width: 26, height: 26, border: "1px solid var(--k-border)", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>{children}</button>;
}
