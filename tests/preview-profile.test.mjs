import test from "node:test";
import assert from "node:assert/strict";
import { buildPreviewProfile, parseDurationMinutes, parsePriceCents, slugify } from "../src/lib/preview-profile.ts";

test("slug follows the onboarding rules", () => {
  assert.equal(slugify("Ana Tranças & Cia"), "ana-trancas-cia");
  assert.equal(slugify("  --Bia--  "), "bia");
  assert.ok(slugify("x".repeat(60)).length <= 40);
});

test("prices accept Brazilian formats", () => {
  assert.equal(parsePriceCents("120"), 12000);
  assert.equal(parsePriceCents("120,50"), 12050);
  assert.equal(parsePriceCents("R$ 1.200,00"), 120000);
  assert.equal(parsePriceCents("1.200"), 120000);
  assert.equal(parsePriceCents("89.90"), 8990);
  assert.equal(parsePriceCents(""), null);
});

test("duration must be a positive number of minutes", () => {
  assert.equal(parseDurationMinutes("90"), 90);
  assert.equal(parseDurationMinutes("0"), null);
  assert.equal(parseDurationMinutes(""), null);
});

test("preview profile keeps at most 4 named services and uses local photos as full URLs", () => {
  const service = (id, name, photo = null) => ({ id, name, price: "100", duration: "60", photo });
  const profile = buildPreviewProfile({
    name: "Ana Tranças", specialty: "Trancista · Salvador", slug: "", description: "", logo: "data:image/jpeg;base64,AAA", cover: "data:image/jpeg;base64,CCC",
    services: [service("1", "Box braids", "data:image/jpeg;base64,BBB"), service("2", ""), service("3", "Nagô"), service("4", "Fulani"), service("5", "Extra")],
  });
  assert.equal(profile.slug, "ana-trancas");
  assert.deepEqual(profile.categories, ["Trancista · Salvador"]);
  assert.deepEqual(profile.services.map(item => item.name), ["Box braids", "Nagô", "Fulani"]);
  assert.equal(profile.services[0].portfolio[0].path, "data:image/jpeg;base64,BBB");
  assert.equal(profile.avatar_path, "data:image/jpeg;base64,AAA");
  assert.equal(profile.cover_path, "data:image/jpeg;base64,CCC");
});
