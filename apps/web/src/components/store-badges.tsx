/** App Store and Google Play badges with the official coloured logos. */

export function AppleLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M16.37 1.43c.06 1.06-.35 2.1-1.02 2.86-.72.82-1.9 1.45-3.03 1.36-.09-1.02.4-2.09 1.03-2.78.72-.81 1.98-1.4 3.02-1.44ZM20 17.1c-.5 1.15-.74 1.66-1.38 2.68-.9 1.43-2.17 3.2-3.74 3.22-1.4.01-1.76-.91-3.65-.9-1.9.01-2.29.92-3.69.9-1.57-.02-2.77-1.63-3.67-3.05C1.4 15.9 1.14 11.3 2.7 8.86c1.1-1.74 2.84-2.76 4.48-2.76 1.67 0 2.72.92 4.1.92 1.34 0 2.15-.92 4.08-.92 1.46 0 3 .8 4.11 2.17-3.61 1.98-3.03 7.14.53 8.83Z" />
    </svg>
  );
}

export function GooglePlayLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.6 2.3c-.2.22-.32.56-.32 1v17.4c0 .44.12.78.33 1l.06.05L13.4 12v-.1L3.66 2.26l-.06.04Z" fill="#00D4FF" />
      <path d="M17 15.33 13.4 12v-.1l3.6-3.33.08.05 4.3 2.44c1.22.7 1.22 1.83 0 2.53l-4.3 2.44-.08.3Z" fill="#FFCE00" />
      <path d="m17.08 15.28-3.68-3.38L3.6 21.7c.4.42 1.07.47 1.82.05l11.66-6.47Z" fill="#FF3D3D" />
      <path d="M17.08 8.62 5.42 2.16c-.75-.43-1.42-.37-1.82.05l9.8 9.69 3.68-3.28Z" fill="#00F076" />
    </svg>
  );
}

export function StoreBadge({ kind, comingSoon }: { kind: "apple" | "google"; comingSoon?: boolean }) {
  const apple = kind === "apple";
  return (
    <span className={`store-badge${comingSoon ? " is-soon" : ""}`} role={comingSoon ? undefined : "button"}>
      <span className="store-badge-icon">{apple ? <AppleLogo /> : <GooglePlayLogo />}</span>
      <span className="store-badge-text">
        <small>{apple ? "Download on the" : "Get it on"}</small>
        <strong>{apple ? "App Store" : "Google Play"}</strong>
      </span>
      {comingSoon && <span className="store-badge-soon">Soon</span>}
    </span>
  );
}
