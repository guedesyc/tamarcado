import test from "node:test";
import assert from "node:assert/strict";
import { rateLimitRequest } from "../src/lib/rate-limit.ts";

test("limits repeated requests from the same client without persisting its address", () => {
  const scope = `test-${crypto.randomUUID()}`;
  const request = () => new Request("https://tamarcado.ygsystems.com.br/api/test", { headers: { "x-real-ip": "203.0.113.24" } });
  assert.equal(rateLimitRequest(request(), scope, 2, 60_000).allowed, true);
  assert.equal(rateLimitRequest(request(), scope, 2, 60_000).allowed, true);
  const blocked = rateLimitRequest(request(), scope, 2, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("uses separate buckets for different clients", () => {
  const scope = `test-${crypto.randomUUID()}`;
  const one = new Request("https://tamarcado.ygsystems.com.br", { headers: { "x-real-ip": "203.0.113.25" } });
  const two = new Request("https://tamarcado.ygsystems.com.br", { headers: { "x-real-ip": "203.0.113.26" } });
  assert.equal(rateLimitRequest(one, scope, 1, 60_000).allowed, true);
  assert.equal(rateLimitRequest(one, scope, 1, 60_000).allowed, false);
  assert.equal(rateLimitRequest(two, scope, 1, 60_000).allowed, true);
});
