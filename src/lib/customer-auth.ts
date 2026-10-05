export function safeCustomerNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return "/minha-agenda";
  const path = value.split("?")[0];
  return path === "/minha-agenda" || path.startsWith("/minha-agenda/") ? value : "/minha-agenda";
}

export const CUSTOMER_CLAIM_COOKIE = "tm_pending_customer_claim";

export function safeAuthCallbackNext(value: string | null): string {
  if (value === "/senha") return value;
  return value ? safeCustomerNext(value) : "/app/onboarding";
}
