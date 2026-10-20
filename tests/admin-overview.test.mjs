import test from "node:test";
import assert from "node:assert/strict";
import { filterProfessionals, funnel, lastAccess, onboardingStage, parsePendingFilter, pendingItems } from "../src/lib/admin-overview.ts";

const now = new Date("2026-10-19T12:00:00Z");
const hoursAgo = hours => new Date(now.getTime() - hours * 3600 * 1000).toISOString();

function row(overrides = {}) {
  return {
    user_id: "u1", email: "ana@example.com", full_name: "Ana Tranças", signed_up_at: hoursAgo(100),
    email_confirmed_at: hoursAgo(99), last_sign_in_at: hoursAgo(5), last_seen_at: null,
    business_id: "b1", business_name: "Ana Tranças", slug: "ana-trancas", published_at: hoursAgo(98),
    active_services_count: 2, availability_rules_count: 5, public_requests_count: 3, last_request_at: hoursAgo(10),
    free_quota_used: 2, subscription_provider: null, subscription_status: null, subscription_livemode: null,
    ...overrides,
  };
}

test("a fully set up professional has no pending items", () => {
  assert.deepEqual(pendingItems(row(), now, true), []);
});

test("unconfirmed e-mail only counts after 24 hours", () => {
  assert.ok(!pendingItems(row({ email_confirmed_at: null, signed_up_at: hoursAgo(2) }), now, true).includes("email_unconfirmed"));
  assert.ok(pendingItems(row({ email_confirmed_at: null, signed_up_at: hoursAgo(30) }), now, true).includes("email_unconfirmed"));
});

test("setup gaps are reported", () => {
  const items = pendingItems(row({ active_services_count: 0, availability_rules_count: 0, public_requests_count: 0 }), now, true);
  assert.deepEqual(items, ["no_services", "no_hours", "no_requests"]);
});

test("trial exhausted is cleared by an active subscription in the current Stripe mode", () => {
  assert.ok(pendingItems(row({ free_quota_used: 5 }), now, true).includes("trial_exhausted"));
  const paid = row({ free_quota_used: 5, subscription_provider: "stripe", subscription_status: "active", subscription_livemode: true });
  assert.ok(!pendingItems(paid, now, true).includes("trial_exhausted"));
  assert.ok(pendingItems(paid, now, false).includes("trial_exhausted"));
});

test("failed payments are reported", () => {
  assert.ok(pendingItems(row({ subscription_status: "past_due" }), now, true).includes("payment_failed"));
});

test("last access prefers the most recent of last_seen_at and last_sign_in_at", () => {
  assert.equal(lastAccess(row({ last_seen_at: hoursAgo(1) })), hoursAgo(1));
  assert.equal(lastAccess(row({ last_seen_at: hoursAgo(50) })), hoursAgo(5));
  assert.equal(lastAccess(row({ last_seen_at: null, last_sign_in_at: null })), null);
  assert.ok(pendingItems(row({ last_seen_at: null, last_sign_in_at: hoursAgo(15 * 24) }), now, true).includes("inactive"));
});

test("onboarding stage follows the business state", () => {
  assert.equal(onboardingStage(row({ business_id: null })), "account");
  assert.equal(onboardingStage(row({ published_at: null })), "draft");
  assert.equal(onboardingStage(row()), "published");
});

test("funnel counts each step", () => {
  const rows = [row(), row({ user_id: "u2", email_confirmed_at: null, active_services_count: 0, availability_rules_count: 0, public_requests_count: 0, free_quota_used: 0 })];
  assert.deepEqual(funnel(rows, true).map(step => step.count), [2, 1, 1, 1, 1, 0, 0]);
});

test("search ignores accents and case; pending filter is validated", () => {
  const rows = [row(), row({ user_id: "u2", full_name: "Bia", email: "bia@example.com", business_name: "Bia Unhas", slug: "bia-unhas", active_services_count: 0 })];
  assert.equal(filterProfessionals(rows, { query: "TRANCAS", now, liveMode: true }).length, 1);
  assert.equal(filterProfessionals(rows, { pending: "no_services", now, liveMode: true })[0].user_id, "u2");
  assert.equal(parsePendingFilter("no_services"), "no_services");
  assert.equal(parsePendingFilter("drop table"), null);
});
