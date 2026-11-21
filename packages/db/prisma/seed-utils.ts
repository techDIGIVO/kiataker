/**
 * Helpers shared by the seed scripts. They mirror the API's CryptoService exactly, so data
 * written here is readable by the API (same key derivation, cipher, hash and password format).
 */
import { scryptSync, randomBytes, createHash, createCipheriv } from "node:crypto";

/** The published password for the per-centre staff logins (dev seed and seed:centre-logins). */
export const DEV_STAFF_PASSWORD = "kiataker-dev";

/** Read JWT_ACCESS_SECRET and refuse anything the production API would refuse. */
export function productionEncryptionSecret(fail: (message: string) => never): string {
  const secret = process.env.JWT_ACCESS_SECRET ?? "";
  if (secret.startsWith("dev-") || secret.length < 32) {
    fail("JWT_ACCESS_SECRET must be the API's production value (32+ characters).");
  }
  return secret;
}

/** Same as CryptoService.encrypt: iv:tag:ciphertext (hex, AES-256-GCM). */
export function makeEncrypt(jwtAccessSecret: string): (plain: string) => string {
  const key = scryptSync(jwtAccessSecret, "kiataker-enc", 32);
  return (plain: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
  };
}

/** Same as CryptoService.valueHash. */
export const valueHash = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/** Same as CryptoService.hashPassword: scrypt:<saltHex>:<hashHex>. */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
