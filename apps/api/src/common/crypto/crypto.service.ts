import { Injectable } from "@nestjs/common";
import { scryptSync, randomBytes, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Crypto helpers (§34, §28). Phone numbers and emails are stored encrypted with a
 * separate deterministic hash for lookup. No raw identity in logs.
 */
@Injectable()
export class CryptoService {
  private readonly key = scryptSync(process.env.JWT_ACCESS_SECRET ?? "dev", "kiataker-enc", 32);

  /** Password hashing, format scrypt:<saltHex>:<hashHex> (matches the seed). */
  hashPassword(pw: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(pw, salt, 64);
    return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
  }
  verifyPassword(pw: string, stored: string): boolean {
    const [scheme, saltHex, hashHex] = stored.split(":");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(pw, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** Deterministic hash for lookup (e.g. a contact value). Not reversible. */
  valueHash(value: string): string {
    return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
  }

  /** Reversible encryption at rest for personal data. */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
  }
  decrypt(blob: string): string {
    const [ivHex, tagHex, dataHex] = blob.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  }

  randomCode(digits = 6): string {
    const n = Math.floor(Math.random() * 10 ** digits);
    return n.toString().padStart(digits, "0");
  }
}
