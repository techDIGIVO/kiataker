"use client";

import { useState } from "react";
import { apiLogin, setToken } from "@/lib/admin-api";
import { Logo } from "@/components/brand";

export default function AdminLogin() {
  const [email, setEmail] = useState("operations@kiataker.ng");
  const [password, setPassword] = useState("kiataker-dev");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const token = await apiLogin(email, password);
      setToken(token);
      window.location.href = "/admin";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--k-surface-muted)", padding: 24 }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 400, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <Logo />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Command Centre sign in</h1>
        <p style={{ fontSize: 14, marginBottom: 24 }}>Staff access to the Kiataker admin.</p>

        <label htmlFor="admin-email" style={labelStyle}>Email</label>
        <input id="admin-email" style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />

        <label htmlFor="admin-password" style={labelStyle}>Password</label>
        <input id="admin-password" style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        {error && (
          <div style={{ color: "var(--k-danger-fg)", background: "var(--k-danger-bg)", padding: "10px 12px", borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
            {error === "FORBIDDEN" ? "That account is not staff." : error}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 16 }}>
          Dev accounts: ceo / operations / product / legal / accounts @kiataker.ng, password kiataker-dev
        </p>
      </form>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--k-text-secondary)",
  marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  border: "1px solid var(--k-border)",
  borderRadius: 9,
  padding: "0 14px",
  fontSize: 15,
  marginBottom: 18,
  fontFamily: "var(--k-font-body)",
  outlineColor: "var(--k-green-primary)",
};
