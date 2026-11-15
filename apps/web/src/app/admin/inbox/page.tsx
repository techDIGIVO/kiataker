"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, Section, Banner, Empty } from "@/components/admin-ui";

interface Convo {
  address: string;
  lastBody: string;
  lastDirection: string;
  lastAt: string;
  recentCount: number;
}
interface Message {
  direction: string;
  body: string;
  at: string;
}

export default function InboxBoard() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadInbox = useCallback(() => {
    apiGet<Convo[]>("/internal/whatsapp/inbox")
      .then((r) => { setConvos(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { loadInbox(); }, [loadInbox]);

  const openThread = useCallback((address: string) => {
    setActive(address); setError("");
    apiGet<{ messages: Message[] }>(`/internal/whatsapp/inbox/${encodeURIComponent(address)}`)
      .then((r) => setThread(r.messages))
      .catch((err) => setError((err as Error).message));
  }, []);

  async function send() {
    if (!active || !reply.trim()) return;
    setBusy(true); setError("");
    try {
      await apiSend("POST", `/internal/whatsapp/inbox/${encodeURIComponent(active)}/reply`, { text: reply });
      setReply("");
      openThread(active);
      loadInbox();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <AdminShell active="inbox" title="Support inbox" subtitle="Every WhatsApp conversation (P2). Read a thread and reply as the support team; a reply is logged and sent over the Cloud API when credentials are set.">
      {error && <Banner tone="warn">{error}</Banner>}
      {loading ? (
        <Banner>Loading inbox...</Banner>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) 1fr", gap: 16, alignItems: "start" }}>
          <Section title={`Conversations (${convos.length})`}>
            {convos.length === 0 ? (
              <Empty>No conversations yet.</Empty>
            ) : (
              <div style={{ display: "grid" }}>
                {convos.map((c) => (
                  <button
                    key={c.address}
                    onClick={() => openThread(c.address)}
                    style={{ textAlign: "left", padding: "12px 16px", border: "none", borderTop: "1px solid var(--k-border)", background: active === c.address ? "var(--k-surface-muted)" : "transparent", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 14, fontFamily: "var(--k-font-mono)" }}>{c.address}</strong>
                      <span style={{ fontSize: 12, color: "var(--k-text-muted)" }}>{new Date(c.lastAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--k-text-muted)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.lastDirection === "out" ? "You: " : ""}{c.lastBody}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title={active ? `Thread · ${active}` : "Select a conversation"}>
            {!active ? (
              <Empty>Pick a conversation to read and reply.</Empty>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gap: 8, maxHeight: 440, overflowY: "auto", marginBottom: 14 }}>
                  {thread.map((m, i) => (
                    <div key={i} style={{ justifySelf: m.direction === "out" ? "end" : "start", maxWidth: "78%", background: m.direction === "out" ? "var(--k-green-soft)" : "var(--k-surface-muted)", borderRadius: 12, padding: "9px 13px", fontSize: 14 }}>
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                      <div style={{ fontSize: 11, color: "var(--k-text-muted)", marginTop: 3 }}>{new Date(m.at).toLocaleString()}</div>
                    </div>
                  ))}
                  {thread.length === 0 && <p style={{ fontSize: 13, color: "var(--k-text-muted)" }}>No messages.</p>}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    aria-label="Reply message"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    placeholder="Type a reply..."
                    style={{ flex: 1, border: "1px solid var(--k-border)", borderRadius: 9, padding: "10px 13px", fontSize: 14 }}
                  />
                  <button className="btn btn-primary" style={{ flex: "none" }} disabled={busy || !reply.trim()} onClick={send}>{busy ? "..." : "Send"}</button>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </AdminShell>
  );
}
