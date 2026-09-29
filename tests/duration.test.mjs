import test from "node:test";
import assert from "node:assert/strict";
import { durationDeltaToMinutes, durationToMinutes, formatDurationDelta, minutesToDuration } from "../src/lib/duration.ts";

test("converts HH:MM to minutes without losing hours", () => {
  assert.equal(durationToMinutes("01:30"), 90);
  assert.equal(durationToMinutes("03:00"), 180);
  assert.equal(durationToMinutes("23:59"), 1439);
});

test("rejects malformed or out-of-range duration", () => {
  for (const value of ["0130", "1:30", "00:00", "00:60", "24:01", "99:00", "abc"])
    assert.equal(durationToMinutes(value), null, value);
});

test("formats stored minutes consistently", () => {
  assert.equal(minutesToDuration(90), "01:30");
  assert.equal(minutesToDuration(0), "00:00");
  assert.equal(minutesToDuration(1440), "24:00");
  assert.throws(() => minutesToDuration(-1), RangeError);
});

test("parses and formats signed duration modifiers as HH:MM", () => {
  assert.equal(durationDeltaToMinutes("+01:30"), 90);
  assert.equal(durationDeltaToMinutes("-00:15"), -15);
  assert.equal(durationDeltaToMinutes("+00:00"), 0);
  assert.equal(durationDeltaToMinutes("00:60"), null);
  assert.equal(formatDurationDelta(90), "+01:30");
  assert.equal(formatDurationDelta(-15), "−00:15");
});
