/** Customer account creation remains implemented, but is disabled by default. */
export function customerAccountCreationEnabled() {
  return process.env.NEXT_PUBLIC_CUSTOMER_ACCOUNTS_ENABLED === "true";
}
