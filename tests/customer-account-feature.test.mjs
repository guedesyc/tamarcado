import test from "node:test";
import assert from "node:assert/strict";
import { customerAccountCreationEnabled } from "../src/lib/customer-account-feature.ts";

test("customer account creation remains disabled unless explicitly enabled", () => {
  const previous = process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED;
    assert.equal(customerAccountCreationEnabled(), false);
    process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED = "false";
    assert.equal(customerAccountCreationEnabled(), false);
    process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED = "true";
    assert.equal(customerAccountCreationEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED;
    else process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED = previous;
  }
});
