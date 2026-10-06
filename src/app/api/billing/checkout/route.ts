import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";
import { isSameSiteOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível iniciar a assinatura deste endereço." }, { status: 403 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Adicione um e-mail à sua conta antes de assinar." }, { status: 400 });
  const { data: member } = await supabase.from("business_members").select("business_id,role").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (!member) return NextResponse.json({ error: "Somente a pessoa responsável pelo espaço pode contratar o plano." }, { status: 403 });

  const stripe = createStripeClient();
  const admin = createAdminClient();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !admin || !priceId) return NextResponse.json({ error: "A assinatura ainda não foi configurada para este ambiente." }, { status: 503 });

  const { data: business } = await supabase.from("businesses").select("id,name,contact_phone").eq("id", member.business_id).single();
  if (!business) return NextResponse.json({ error: "Seu espaço não foi encontrado." }, { status: 404 });
  const { data: existing } = await admin.from("subscription_records").select("provider,provider_customer_id").eq("business_id", business.id).maybeSingle();

  try {
    let customerId = existing?.provider === "stripe" ? existing.provider_customer_id : null;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: business.name, email: user.email, phone: business.contact_phone || undefined });
      customerId = customer.id;
      const { error } = await admin.from("subscription_records").upsert({ business_id: business.id, provider: "stripe", provider_customer_id: customerId, provider_price_id: priceId, status: "incomplete", price_cents: 4999, updated_at: new Date().toISOString() }, { onConflict: "business_id" });
      if (error) throw new Error("Não foi possível preparar sua assinatura.");
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/app/assinatura?checkout=sucesso&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/app/assinatura?checkout=cancelado`,
      locale: "pt-BR",
      subscription_data: { billing_mode: { type: "flexible" } },
      integration_identifier: `tamarcado-${randomBytes(4).toString("hex")}`,
    });
    if (!session.url) throw new Error("Não foi possível abrir o checkout.");
    const { error } = await admin.from("subscription_records").upsert({ business_id: business.id, provider: "stripe", provider_customer_id: customerId, provider_checkout_id: session.id, provider_price_id: priceId, status: "incomplete", price_cents: 4999, updated_at: new Date().toISOString() }, { onConflict: "business_id" });
    if (error) throw new Error("O checkout foi criado, mas não conseguimos registrar sua tentativa.");
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[stripe-checkout] Could not create session", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Não foi possível iniciar sua assinatura. Tente novamente." }, { status: 502 });
  }
}
