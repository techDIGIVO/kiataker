/** Kiataker logo (PRD §38.4): lowercase wordmark with a house-shaped speech-bubble mark. */
export function LogoMark({ size = 30, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 15.2 16 6l10 9.2V25a2.4 2.4 0 0 1-2.4 2.4H8.4A2.4 2.4 0 0 1 6 25V15.2Z"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M22.2 7.2h4.2a1.6 1.6 0 0 1 1.6 1.6v3.1l-2.3-1.5h-3.5a1.6 1.6 0 0 1-1.6-1.6V8.8a1.6 1.6 0 0 1 1.6-1.6Z" fill={color} />
    </svg>
  );
}

export function Logo({ color = "var(--k-green-primary)" }: { color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark color={color} />
      <span
        style={{
          fontFamily: "var(--k-font-heading)",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "-0.03em",
          color,
        }}
      >
        kiataker
      </span>
    </span>
  );
}
