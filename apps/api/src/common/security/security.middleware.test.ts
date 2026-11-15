import { describe, it, expect } from "vitest";
import { RateLimiter } from "./security.middleware.js";

// Pure-logic unit test with a controllable clock, so the window behaviour is deterministic.
describe("RateLimiter", () => {
  it("allows up to the limit, then blocks within the window", () => {
    let now = 1_000;
    const rl = new RateLimiter(3, 1_000, () => now);
    expect(rl.hit("ip").allowed).toBe(true); // 1
    expect(rl.hit("ip").allowed).toBe(true); // 2
    const third = rl.hit("ip"); // 3
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(rl.hit("ip").allowed).toBe(false); // 4 over the limit
  });

  it("resets after the window elapses", () => {
    let now = 1_000;
    const rl = new RateLimiter(2, 1_000, () => now);
    rl.hit("ip");
    rl.hit("ip");
    expect(rl.hit("ip").allowed).toBe(false);
    now += 1_001; // window passed
    expect(rl.hit("ip").allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    let now = 1_000;
    const rl = new RateLimiter(1, 1_000, () => now);
    expect(rl.hit("a").allowed).toBe(true);
    expect(rl.hit("a").allowed).toBe(false);
    expect(rl.hit("b").allowed).toBe(true); // a different key has its own bucket
  });

  it("sweeps expired entries", () => {
    let now = 1_000;
    const rl = new RateLimiter(1, 1_000, () => now);
    rl.hit("a");
    now += 2_000;
    rl.sweep();
    // After a sweep past the window, the key starts fresh.
    expect(rl.hit("a").allowed).toBe(true);
  });
});
