import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, stripeId, stripeTimestamp } from "@/lib/stripe";

export const runtime = "nodejs";

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const values = subscription.items.data.map(item => item.current_period_end);
  return stripeTimestamp(values.length ? Math.max(...values) : null);
}

function subscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled") return "cancelled";
  return "incomplete";
}

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !endpointSecret || !admin || !signature) return NextResponse.json({ error: "Webhook indisponível." }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, endpointSecret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  const { error: insertError } = await admin.from("stripe_webhook_events").insert({ event_id: event.id, event_type: event.type, payload: event });
  if (insertError) {
    if (insertError.code !== "23505") return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
    const { data: previous } = await admin.from("stripe_webhook_events").select("processed_at").eq("event_id", event.id).maybeSingle();
    if (previous?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  }

  let customerId: string | null = null;
  let subscriptionId: string | null = null;
  let nextStatus: "active" | "past_due" | "cancelled" | "incomplete" | null = null;
  let periodEnd: string | null = null;
  let checkoutId: string | null = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    customerId = stripeId(session.customer);
    subscriptionId = stripeId(session.subscription);
    checkoutId = session.id;
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    customerId = stripeId(invoice.customer);
    subscriptionId = invoice.parent?.subscription_details ? stripeId(invoice.parent.subscription_details.subscription) : null;
    nextStatus = event.type === "invoice.paid" ? "active" : "past_due";
    periodEnd = stripeTimestamp(invoice.period_end);
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    customerId = stripeId(subscription.customer);
    subscriptionId = subscription.id;
    nextStatus = event.type === "customer.subscription.deleted" ? "cancelled" : subscriptionStatus(subscription.status);
    periodEnd = subscriptionPeriodEnd(subscription);
  }

  if (customerId) {
    const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
    if (subscriptionId) updates.provider_subscription_id = subscriptionId;
    if (checkoutId) updates.provider_checkout_id = checkoutId;
    if (nextStatus) updates.status = nextStatus;
    if (periodEnd) updates.current_period_end = periodEnd;
    const { error } = await admin.from("subscription_records").update(updates).eq("provider", "stripe").eq("provider_customer_id", customerId);
    if (error) return NextResponse.json({ error: "Não foi possível sincronizar a assinatura." }, { status: 500 });
  }

  await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);
  return NextResponse.json({ ok: true });
}
