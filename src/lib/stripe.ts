import Stripe from "stripe";

export function createStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return null;
  return new Stripe(apiKey, { apiVersion: "2026-08-26.dahlia" });
}

export function stripeIsLiveMode() {
  return process.env.STRIPE_SECRET_KEY?.includes("_live_") ?? false;
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export function stripeTimestamp(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}
