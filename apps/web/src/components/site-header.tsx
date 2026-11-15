"use client";

import { useState } from "react";
import { Logo } from "./brand";

const WHATSAPP_LINK = "https://wa.me/2349065009370?text=" + encodeURIComponent("Hello Kiataker");

const links = [
  { href: "#how", label: "How it works" },
  { href: "#handles", label: "What we handle" },
  { href: "/konnect", label: "For providers" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a href="/" aria-label="Kiataker home">
          <Logo />
        </a>

        <nav className="nav-desktop">
          {links.map((l) => (
            <a key={l.href} className="nav-link" href={l.href}>
              {l.label}
            </a>
          ))}
          <a className="btn btn-primary" style={{ height: 44, padding: "0 18px", fontSize: 15 }} href={WHATSAPP_LINK}>
            Chat with Kiataker
          </a>
        </nav>

        <button
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      <div className={`mobile-menu${open ? " open" : ""}`}>
        {links.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <a
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          href={WHATSAPP_LINK}
          onClick={() => setOpen(false)}
        >
          Chat with Kiataker
        </a>
      </div>
    </header>
  );
}
