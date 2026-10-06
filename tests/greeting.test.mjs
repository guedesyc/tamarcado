import test from "node:test";
import assert from "node:assert/strict";
import { greetingForHour } from "../src/lib/greeting.ts";

test("uses night greeting and moon from 18:00 through 04:59", () => {
  for (const hour of [18, 19, 23, 0, 4]) {
    assert.deepEqual(greetingForHour(hour), { text: "Boa noite", emoji: "🌙" });
  }
});

test("uses sun from 05:00 through 17:59 and changes the greeting at noon", () => {
  for (const hour of [5, 6, 11]) {
    assert.deepEqual(greetingForHour(hour), { text: "Bom dia", emoji: "☀️" });
  }
  for (const hour of [12, 13, 17]) {
    assert.deepEqual(greetingForHour(hour), { text: "Boa tarde", emoji: "☀️" });
  }
});
