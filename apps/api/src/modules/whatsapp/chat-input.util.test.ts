import { describe, it, expect } from "vitest";
import { parseNaira, readAmount, normalizePhone, readContact, displayPhone } from "./chat-input.util.js";

describe("parseNaira", () => {
  it("reads amounts the way landlords type them", () => {
    expect(parseNaira("1500000")).toBe(1_500_000);
    expect(parseNaira("1,500,000")).toBe(1_500_000);
    expect(parseNaira("₦1,500,000")).toBe(1_500_000);
    expect(parseNaira("N1.5m")).toBe(1_500_000);
    expect(parseNaira("1.5 million")).toBe(1_500_000);
    expect(parseNaira("800k")).toBe(800_000);
    expect(parseNaira("2m naira")).toBe(2_000_000);
    expect(parseNaira("1.2bn")).toBe(1_200_000_000);
  });

  it("refuses phone numbers, words and zero", () => {
    expect(parseNaira("08031234567")).toBeNull();
    expect(parseNaira("+2348031234567")).toBeNull();
    expect(parseNaira("one million")).toBeNull();
    expect(parseNaira("0")).toBeNull();
    expect(parseNaira("")).toBeNull();
  });
});

describe("readAmount", () => {
  it("explains a pasted phone number instead of recording trillions", () => {
    const r = readAmount("+2348091234567");
    expect("problem" in r && r.problem).toMatch(/phone number/);
    expect("problem" in readAmount("2348091234567")).toBe(true); // too high
    expect("problem" in readAmount("8091234567")).toBe(true); // a mobile without its 0: ₦8bn
  });

  it("bounds the amount", () => {
    expect(readAmount("500")).toEqual({ problem: expect.stringMatching(/too low/) });
    expect(readAmount("6bn")).toEqual({ problem: expect.stringMatching(/too high/) });
    expect(readAmount("1.2m")).toEqual({ naira: 1_200_000 });
    expect(readAmount("50", { min: 1 })).toEqual({ naira: 50 });
  });
});

describe("normalizePhone", () => {
  it("normalises Nigerian mobiles written any common way", () => {
    for (const v of ["08031234567", "0803 123 4567", "803-123-4567", "2348031234567", "+234 803 123 4567", "(0803) 123.4567"]) {
      expect(normalizePhone(v)).toBe("+2348031234567");
    }
    expect(normalizePhone("09121234567")).toBe("+2349121234567");
  });

  it("keeps international numbers given with +, refuses the rest", () => {
    expect(normalizePhone("+447700900123")).toBe("+447700900123");
    expect(normalizePhone("+2341234")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("Chidi")).toBeNull();
  });
});

describe("readContact", () => {
  it("takes a WhatsApp number or an email", () => {
    expect(readContact("0803 123 4567")).toEqual({ whatsapp: "+2348031234567" });
    expect(readContact("Chidi.Eze@Example.com")).toEqual({ email: "chidi.eze@example.com" });
    expect(readContact("next week")).toBeNull();
  });

  it("formats Nigerian numbers for confirmations", () => {
    expect(displayPhone("+2348031234567")).toBe("+234 803 123 4567");
    expect(displayPhone("+447700900123")).toBe("+447700900123");
  });
});
