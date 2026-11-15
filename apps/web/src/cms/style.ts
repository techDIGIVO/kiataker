import type { BlockStyle } from "./types";

const BG: Record<string, string> = {
  canvas: "var(--k-canvas)",
  muted: "var(--k-surface-muted)",
  ivory: "var(--k-ivory)",
  mint: "#EAF7F0",
  sky: "#EAF1F7",
  peach: "#FBF0EC",
  green: "linear-gradient(170deg, var(--k-green-deep), var(--k-green-primary))",
  greenDeep: "var(--k-green-deep)",
  char: "#0c231a",
};

export function backgroundCss(bg?: string): string {
  if (!bg || bg === "canvas") return "var(--k-canvas)";
  return BG[bg] ?? bg;
}

export function isDark(bg?: string): boolean {
  return bg === "green" || bg === "greenDeep" || bg === "char";
}

export function sectionStyle(style?: BlockStyle): React.CSSProperties {
  const dark = isDark(style?.background);
  return {
    background: backgroundCss(style?.background),
    color: style?.textColor ?? (dark ? "#fff" : "var(--k-text-primary)"),
    paddingTop: style?.paddingTop ?? 96,
    paddingBottom: style?.paddingBottom ?? 96,
    textAlign: style?.align ?? "left",
  };
}

export const BACKGROUND_OPTIONS = [
  { value: "canvas", label: "White" },
  { value: "muted", label: "Light grey" },
  { value: "ivory", label: "Ivory" },
  { value: "green", label: "Green gradient" },
  { value: "greenDeep", label: "Deep green" },
];
