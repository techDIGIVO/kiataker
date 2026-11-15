/** Line icons for the landing page. 24x24, stroke uses currentColor. */
type P = { size?: number };
const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconRecord = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M8 3h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v4h4M9 13h6M9 17h4" />
  </svg>
);
export const IconConfirm = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
    <path d="m9 11.5 2 2 4-4" />
  </svg>
);
export const IconWatch = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const IconDecision = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M10.5 21a2 2 0 0 0 3 0" />
  </svg>
);
export const IconPrepare = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 4h10l6 6v10a0 0 0 0 1 0 0H4Z" />
    <path d="M14 4v6h6M8 15h8M8 18h5" />
  </svg>
);
export const IconSettle = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18" />
    <circle cx="17" cy="14" r="1.4" />
  </svg>
);
export const IconEvidence = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
    <path d="M12 8v4M12 15h.01" />
  </svg>
);
export const IconChat = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
    <path d="M8 10h8M8 13h5" />
  </svg>
);
