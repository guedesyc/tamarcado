import test from "node:test";
import assert from "node:assert/strict";
import { safeAuthCallbackNext, safeCustomerNext } from "../src/lib/customer-auth.ts";

test("customer sign in only returns to the customer area", () => {
  assert.equal(safeCustomerNext("/minha-agenda"), "/minha-agenda");
  assert.equal(safeCustomerNext("/minha-agenda/123"), "/minha-agenda/123");
  assert.equal(safeCustomerNext("/app"), "/minha-agenda");
  assert.equal(safeCustomerNext("//evil.example"), "/minha-agenda");
  assert.equal(safeCustomerNext("/\\evil.example"), "/minha-agenda");
  assert.equal(safeCustomerNext("https://evil.example"), "/minha-agenda");
});

test("auth callback preserves professional signup and password reset", () => {
  assert.equal(safeAuthCallbackNext(null), "/app/onboarding");
  assert.equal(safeAuthCallbackNext("/senha"), "/senha");
  assert.equal(safeAuthCallbackNext("/minha-agenda"), "/minha-agenda");
  assert.equal(safeAuthCallbackNext("//evil.example"), "/minha-agenda");
});
