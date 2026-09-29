import test from "node:test";
import assert from "node:assert/strict";
import { calculateServiceBalance } from "../src/lib/finance.ts";

test("treats the deposit as a receipt within the agreed service total", () => {
  assert.deepEqual(calculateServiceBalance(25000, 5000), { totalCents: 25000, receivedCents: 5000, balanceCents: 20000 });
});

test("does not create a balance once the total has been received", () => {
  assert.deepEqual(calculateServiceBalance(25000, 25000), { totalCents: 25000, receivedCents: 25000, balanceCents: 0 });
});

test("clamps invalid negative totals and receipts safely", () => {
  assert.deepEqual(calculateServiceBalance(-1, -1), { totalCents: 0, receivedCents: 0, balanceCents: 0 });
});
