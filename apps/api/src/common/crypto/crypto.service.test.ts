import { describe, it, expect } from "vitest";
import { CryptoService } from "./crypto.service.js";

// Pure-logic unit test: the service is constructed directly, no Nest container needed.
describe("CryptoService", () => {
  const crypto = new CryptoService();

  it("hashes and verifies a password", () => {
    const hash = crypto.hashPassword("kiataker-dev");
    expect(crypto.verifyPassword("kiataker-dev", hash)).toBe(true);
    expect(crypto.verifyPassword("wrong", hash)).toBe(false);
  });

  it("encrypts and decrypts a value round-trip", () => {
    const blob = crypto.encrypt("+2348030000001");
    expect(blob).not.toContain("+234");
    expect(crypto.decrypt(blob)).toBe("+2348030000001");
  });

  it("produces a stable lookup hash", () => {
    expect(crypto.valueHash(" Test@Example.com ")).toBe(crypto.valueHash("test@example.com"));
  });
});
