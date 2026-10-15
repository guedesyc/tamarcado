import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { INTRO_BOOT_SCRIPT, INTRO_SESSION_KEY, claimIntroPlayback } from "../src/lib/intro-session.ts";

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
}

test("plays only on the first claim of a browser session", () => {
  const storage = memoryStorage();
  const env = { storage, reducedMotion: false, saveData: false };
  assert.equal(claimIntroPlayback(env), true);
  assert.equal(storage.getItem(INTRO_SESSION_KEY), "1", "marks the session when playback starts");
  assert.equal(claimIntroPlayback(env), false, "refresh or returning to the Home does not repeat");
  assert.equal(claimIntroPlayback({ ...env, storage: memoryStorage() }), true, "a new session may play again");
});

test("respects reduced motion, data saving and blocked storage", () => {
  const storage = memoryStorage();
  assert.equal(claimIntroPlayback({ storage, reducedMotion: true, saveData: false }), false);
  assert.equal(claimIntroPlayback({ storage, reducedMotion: false, saveData: true }), false);
  assert.equal(storage.data.size, 0, "skipped intros do not consume the session");
  assert.equal(claimIntroPlayback({ storage: null, reducedMotion: false, saveData: false }), false);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(claimIntroPlayback({ storage: throwing, reducedMotion: false, saveData: false }), false);
});

function runBootScript({ pathname = "/", storage = memoryStorage(), reducedMotion = false, connection } = {}) {
  const attributes = new Map();
  const context = {
    location: { pathname },
    navigator: { connection },
    document: { documentElement: { setAttribute: (name, value) => attributes.set(name, value) } },
  };
  context.window = { sessionStorage: storage, matchMedia: () => ({ matches: reducedMotion }) };
  vm.runInNewContext(INTRO_BOOT_SCRIPT, context);
  return { attributes, storage };
}

test("boot script marks the Home before first paint once per session", () => {
  const first = runBootScript();
  assert.equal(first.attributes.get("data-intro"), "play");
  const again = runBootScript({ storage: first.storage });
  assert.equal(again.attributes.size, 0);
});

test("boot script never runs outside the Home or when motion should be avoided", () => {
  for (const pathname of ["/entrar", "/app", "/minha-agenda", "/ana-trancista"]) {
    const run = runBootScript({ pathname });
    assert.equal(run.attributes.size, 0, pathname);
    assert.equal(run.storage.data.size, 0, `${pathname} does not consume the session`);
  }
  assert.equal(runBootScript({ reducedMotion: true }).attributes.size, 0);
  assert.equal(runBootScript({ connection: { saveData: true } }).attributes.size, 0);
  assert.equal(runBootScript({ connection: { effectiveType: "slow-2g" } }).attributes.size, 0);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() {} };
  assert.equal(runBootScript({ storage: blocked }).attributes.size, 0);
});
