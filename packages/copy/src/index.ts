import { copyByKey, copyEntries, type CopyEntry, type Surface } from "./registry.js";

export { copyEntries, copyByKey };
export type { CopyEntry, Surface };

/** Resolve a copy key to its text. Throws on an unknown key so nothing ships unregistered. */
export function t(key: string): string {
  const entry = copyByKey[key];
  if (!entry) throw new Error(`Unknown copy key: ${key}`);
  return entry.text;
}

export function entry(key: string): CopyEntry | undefined {
  return copyByKey[key];
}
