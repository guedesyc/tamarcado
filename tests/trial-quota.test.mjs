import test from "node:test";
import assert from "node:assert/strict";
import { publicBookingsPaused, trialMessage } from "../src/lib/domain.ts";

test("confirmed reservations participate in the free quota", () => {
  const completed = 2;
  const confirmed = 3;
  const occupied = completed + confirmed;
  assert.equal(publicBookingsPaused(occupied, false), true);
  assert.match(trialMessage(occupied), /utilizadas ou reservadas/);
});

test("an active subscription never pauses bookings at the free limit", () => {
  assert.equal(publicBookingsPaused(5, true), false);
  assert.equal(publicBookingsPaused(8, true), false);
});

test("the three-slot warning includes reserved appointments", () => {
  assert.match(trialMessage(3), /utilizou ou reservou 3/);
  assert.equal(trialMessage(2), null);
});
