"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./brand";

/**
 * Animated iPhone 13 Pro Max showing the Kiataker WhatsApp chat. The conversation plays on
 * a loop: Kiataker greets, the landlord taps a menu option, and a Property File is created,
 * demonstrating the "run it by chat" product without any real screenshots.
 */

type Msg = { side: "in" | "out"; text?: string; list?: { title: string; options: string[] }; time: string };

const SCRIPT: Msg[] = [
  { side: "in", text: "Hello 👋 I'm Kiataker. What would you like to do?", time: "9:41" },
  { side: "in", list: { title: "Choose an option", options: ["Add a property", "Record a tenancy", "What needs my decision"] }, time: "9:41" },
  { side: "out", text: "Add a property", time: "9:41" },
  { side: "in", text: "Great. Send me the property address.", time: "9:41" },
  { side: "out", text: "12 Admiralty Way, Lekki Phase 1", time: "9:42" },
  { side: "in", text: "Is it residential, commercial or mixed use?", time: "9:42" },
  { side: "out", text: "Residential", time: "9:42" },
  { side: "in", text: "✅ Property File created. Management has started. You're all set.", time: "9:42" },
];

export function IphoneMock() {
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (!cancelled) {
        setCount(0);
        setTyping(false);
        await wait(700);
        for (let i = 0; i < SCRIPT.length; i++) {
          if (cancelled) return;
          if (SCRIPT[i]!.side === "in") {
            setTyping(true);
            await wait(850);
            if (cancelled) return;
            setTyping(false);
          }
          setCount(i + 1);
          await wait(SCRIPT[i]!.side === "in" ? 1050 : 750);
        }
        await wait(2800);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [count, typing]);

  return (
    <div className="iphone" aria-label="Kiataker on WhatsApp">
      <div className="iphone-btn iphone-btn-silence" />
      <div className="iphone-btn iphone-btn-vol1" />
      <div className="iphone-btn iphone-btn-vol2" />
      <div className="iphone-btn iphone-btn-power" />
      <div className="iphone-screen">
        <div className="iphone-notch" />
        {/* Status bar */}
        <div className="wa-status">
          <span>9:41</span>
          <span className="wa-status-icons">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1" /><rect x="4" y="4" width="3" height="7" rx="1" /><rect x="8" y="2" width="3" height="9" rx="1" /><rect x="12" y="0" width="3" height="11" rx="1" /></svg>
            <svg width="16" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M8 3c2 0 3.8.8 5 2l1.2-1.3A9 9 0 0 0 8 1 9 9 0 0 0 1.8 3.7L3 5a7 7 0 0 1 5-2Z" /><path d="M8 6.5c1 0 2 .4 2.7 1.1L8 10.5 5.3 7.6A3.8 3.8 0 0 1 8 6.5Z" /></svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="20" height="10" rx="2.5" stroke="currentColor" opacity="0.5" /><rect x="3" y="3" width="14" height="6" rx="1" fill="currentColor" /><rect x="22" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5" /></svg>
          </span>
        </div>
        {/* WhatsApp header */}
        <div className="wa-header">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}><path d="M10 2 2 10l8 8" /></svg>
          <span className="wa-avatar"><LogoMark size={20} color="#075E54" /></span>
          <span className="wa-peer">
            <span className="wa-name">Kiataker</span>
            <span className="wa-online">online</span>
          </span>
          <span className="wa-hicons">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" /></svg>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M20 15.5a12.6 12.6 0 0 1-4-.6 1 1 0 0 0-1 .2l-1.8 1.8a15 15 0 0 1-6.6-6.6l1.8-1.8a1 1 0 0 0 .2-1 12.6 12.6 0 0 1-.6-4 1 1 0 0 0-1-1H4a1 1 0 0 0-1 1A17 17 0 0 0 20 21a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1Z" /></svg>
          </span>
        </div>
        {/* Chat */}
        <div className="wa-chat" ref={chatRef}>
          {SCRIPT.slice(0, count).map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
          {typing && (
            <div className="wa-row wa-row-in">
              <div className="wa-bubble wa-in wa-typing">
                <span className="wa-dot" />
                <span className="wa-dot" />
                <span className="wa-dot" />
              </div>
            </div>
          )}
        </div>
        {/* Input */}
        <div className="wa-input">
          <div className="wa-input-field">Message</div>
          <div className="wa-send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" /><path d="M6 11a6 6 0 0 0 12 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.list) {
    return (
      <div className="wa-row wa-row-in">
        <div className="wa-bubble wa-in wa-list">
          <div className="wa-list-title">{msg.list.title}</div>
          {msg.list.options.map((o) => (
            <div key={o} className="wa-list-opt">
              <span className="wa-list-dot" />
              {o}
            </div>
          ))}
          <div className="wa-time">{msg.time}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`wa-row ${msg.side === "in" ? "wa-row-in" : "wa-row-out"}`}>
      <div className={`wa-bubble ${msg.side === "in" ? "wa-in" : "wa-out"}`}>
        {msg.text}
        <span className="wa-time">{msg.time}</span>
      </div>
    </div>
  );
}
