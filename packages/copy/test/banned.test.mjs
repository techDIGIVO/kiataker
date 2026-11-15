import { test } from "node:test";
import assert from "node:assert/strict";
import { bannedRules } from "../src/banned.mjs";

const rule = (id) => bannedRules.find((r) => r.id === id);

test("em dash is banned", () => {
  assert.ok(rule("em-dash").pattern.test("Collect your rent — handled"));
  assert.ok(!rule("em-dash").pattern.test("Collect your rent, we'll handle the rest."));
});

test("landlord verbs banned, allowed verbs pass", () => {
  assert.ok(rule("landlord-verbs").pattern.test("Send notice"));
  assert.ok(!rule("landlord-verbs").pattern.test("Approve"));
  assert.ok(!rule("landlord-verbs").pattern.test("Instruct"));
});

test("bare Caution Fee is banned, full phrase passes", () => {
  assert.ok(rule("caution-fee-bare").pattern.test("Pay the caution fee now"));
  assert.ok(
    !rule("caution-fee-bare").pattern.test(
      "Caution Fee (security deposit under the Lagos State Tenancy Law)",
    ),
  );
});

test("brand misspellings banned", () => {
  assert.ok(rule("brand-misspelling").pattern.test("Welcome to KIATAKER"));
  assert.ok(!rule("brand-misspelling").pattern.test("Welcome to Kiataker"));
});

test("NDPR banned in favour of NDPA", () => {
  assert.ok(rule("ndpr").pattern.test("Compliant with NDPR"));
  assert.ok(!rule("ndpr").pattern.test("Compliant with NDPA (Nigeria Data Protection Act 2023)"));
});
