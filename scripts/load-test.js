/**
 * Kiataker load test (Phase 5, P0-12). Runs with k6 (https://k6.io) against a target API. It is
 * meant for a staging environment, not the dev box: point it at staging and watch the thresholds.
 *
 *   BASE_URL=https://staging-api.kiataker.ng k6 run scripts/load-test.js
 *
 * It signs in once as staff, then ramps virtual users hitting read paths that scale with data
 * (the admin boards, now batched) plus the health and metrics endpoints. The thresholds fail the
 * run if p95 latency or the error rate crosses the budget, so this doubles as a perf regression gate.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const V1 = `${BASE}/v1`;
const STAFF_EMAIL = __ENV.STAFF_EMAIL || "operations@kiataker.ng";
const STAFF_PASSWORD = __ENV.STAFF_PASSWORD || "kiataker-dev";

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // ramp up
    { duration: "1m", target: 20 }, // steady
    { duration: "30s", target: 50 }, // peak
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // under 1% errors
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    "http_req_duration{group:::board}": ["p(95)<800"], // boards do more work
  },
};

// Sign in once; every virtual user reuses the staff token.
export function setup() {
  const res = http.post(`${V1}/auth/login`, JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }), {
    headers: { "content-type": "application/json" },
  });
  check(res, { "login ok": (r) => r.status === 200 });
  return { token: res.json("accessToken") };
}

const BOARDS = [
  "/internal/overview",
  "/internal/landlords",
  "/internal/board/issues",
  "/internal/board/arrears",
  "/internal/board/payments",
  "/internal/board/buildings",
  "/internal/board/data-requests",
  "/internal/control-changes",
];

export default function (data) {
  // Public, unauthenticated, rate-limit-exempt endpoints.
  check(http.get(`${V1}/health`), { "health ok": (r) => r.status === 200 });
  check(http.get(`${V1}/metrics`), { "metrics ok": (r) => r.status === 200 });

  // A staff board (the paths whose cost used to grow per row; now batched).
  const path = BOARDS[Math.floor(Math.random() * BOARDS.length)];
  const res = http.get(`${V1}${path}`, { headers: { authorization: `Bearer ${data.token}` }, tags: { group: "board" } });
  check(res, { "board ok": (r) => r.status === 200 });

  sleep(1);
}
