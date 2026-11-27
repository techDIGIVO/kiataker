"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./brand";

// The demo API when one is set (DEMO_API_BASE_URL, see next.config.mjs), else the main API.
const API_BASE = process.env.DEMO_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000";
const WHATSAPP_LINK = "https://wa.me/2349065009370?text=" + encodeURIComponent("Hello Kiataker");

interface Btn { id: string; title: string }
interface Item { id: string; title: string; description?: string }
interface Msg { side: "in" | "out"; text: string; buttons?: Btn[]; items?: Item[]; time: string }

const now = () => new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
function phoneFor(): string {
  try {
    const k = localStorage.getItem("kt_sim_phone");
    if (k) return k;
    const p = "+23480" + Math.floor(10000000 + Math.random() * 89999999);
    localStorage.setItem("kt_sim_phone", p);
    return p;
  } catch {
    return "+2348000000000";
  }
}

/** Interactive WhatsApp simulator. Talks to the conversation engine's simulator endpoint, which
 *  is a dev tool: where it is switched off (production), the phone offers the real WhatsApp
 *  number instead of failing. */
export function WhatsAppSim({ maxWidth = 340 }: { maxWidth?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [offline, setOffline] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = phoneFor();
    setFrom(p);
    void send({ text: "Hello" }, p, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs, busy]);

  async function send(input: { text?: string; replyId?: string }, phone = from, silent = false) {
    if (busy) return;
    setBusy(true);
    if (!silent) setMsgs((m) => [...m, { side: "out", text: input.text ?? "", time: now() }]);
    try {
      const res = await fetch(`${API_BASE}/v1/whatsapp/inbound`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: phone, text: input.text, replyId: input.replyId }),
      });
      if (res.status === 404) {
        // The simulator endpoint is off on this deployment: point visitors to the real number.
        setOffline(true);
        setMsgs([{ side: "in", text: "Hello 👋 The live demo isn't available here. Chat with Kiataker on WhatsApp to try it for real.", time: now() }]);
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await new Promise((r) => setTimeout(r, 400));
      for (const m of json.messages ?? []) {
        setMsgs((cur) => [...cur, { side: "in", text: m.text, buttons: m.buttons, items: m.items, time: now() }]);
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch {
      setMsgs((m) => [...m, { side: "in", text: "Could not reach Kiataker right now. Please try again.", time: now() }]);
    }
    setBusy(false);
  }
  function reset() {
    try { localStorage.removeItem("kt_sim_phone"); } catch { /* ignore */ }
    const p = phoneFor();
    setFrom(p);
    setMsgs([]);
    void send({ text: "Hello" }, p, true);
  }

  return (
    <div className="iphone" style={{ maxWidth }}>
      <div className="iphone-btn iphone-btn-silence" />
      <div className="iphone-btn iphone-btn-vol1" />
      <div className="iphone-btn iphone-btn-vol2" />
      <div className="iphone-btn iphone-btn-power" />
      <div className="iphone-screen">
        <div className="iphone-notch" />
        <div className="wa-status"><span>9:41</span><span className="wa-status-icons" /></div>
        <div className="wa-header">
          <span className="wa-avatar"><LogoMark size={20} color="#075E54" /></span>
          <span className="wa-peer"><span className="wa-name">Kiataker</span><span className="wa-online">online</span></span>
          {!offline && <span style={{ marginLeft: "auto", cursor: "pointer", fontSize: 11, opacity: 0.85 }} onClick={reset}>Reset</span>}
        </div>
        <div className="wa-chat" ref={chatRef} style={{ justifyContent: "flex-start", overflowY: "auto" }}>
          {msgs.map((m, i) => (
            <div key={i}>
              <div className={`wa-row ${m.side === "in" ? "wa-row-in" : "wa-row-out"}`}>
                <div className={`wa-bubble ${m.side === "in" ? "wa-in" : "wa-out"}`} style={{ whiteSpace: "pre-wrap" }}>
                  {m.text}
                  <span className="wa-time">{m.time}</span>
                </div>
              </div>
              {m.buttons?.map((b) => (
                <div className="wa-row wa-row-in" key={b.id}>
                  <button className="wa-reply" onClick={() => send({ replyId: b.id, text: b.title })}>{b.title}</button>
                </div>
              ))}
              {m.items && (
                <div className="wa-row wa-row-in">
                  <div className="wa-bubble wa-in" style={{ padding: 0, maxWidth: "88%" }}>
                    {m.items.map((it) => (
                      <button key={it.id} className="wa-listopt" onClick={() => send({ replyId: it.id, text: it.title })}>
                        <span>{it.title}</span>
                        {it.description && <small>{it.description}</small>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {offline && (
            <div className="wa-row wa-row-in">
              <a className="wa-reply" href={WHATSAPP_LINK} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Open WhatsApp</a>
            </div>
          )}
          {busy && (
            <div className="wa-row wa-row-in">
              <div className="wa-bubble wa-in wa-typing"><span className="wa-dot" /><span className="wa-dot" /><span className="wa-dot" /></div>
            </div>
          )}
        </div>
        <form className="wa-input" onSubmit={(e) => { e.preventDefault(); if (!offline && text.trim()) { send({ text }); setText(""); } }}>
          <input className="wa-input-live" value={text} onChange={(e) => setText(e.target.value)} placeholder={offline ? "Demo unavailable" : "Message"} disabled={offline} aria-label="Message" />
          <button type="submit" className="wa-send" aria-label="Send" disabled={offline}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4v6l12 2-12 2z" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
