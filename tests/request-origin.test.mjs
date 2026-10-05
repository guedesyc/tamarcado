import test from "node:test";
import assert from "node:assert/strict";
import { isSameSiteOrigin } from "../src/lib/request-origin.ts";

test("allows the configured production origin behind the hosting proxy", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const request = new Request("https://internal-host/api/action", {
      method: "POST",
      headers: { origin: "https://tamarcado.ygsystems.com.br", "x-forwarded-host": "tamarcado.ygsystems.com.br", "x-forwarded-proto": "https" },
    });
    assert.equal(isSameSiteOrigin(request), true);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("does not trust a caller-controlled forwarded host as an allowed origin", () => {
  const previous = process.env.NODE_ENV;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NODE_ENV = "production";
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const request = new Request("https://internal-host/api/action", {
      method: "POST",
      headers: { origin: "https://attacker.example", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" },
    });
    assert.equal(isSameSiteOrigin(request), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    if (siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
  }
});
