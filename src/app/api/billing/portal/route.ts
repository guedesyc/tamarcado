import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, stripeIsLiveMode } from "@/lib/stripe";
import { isSameSiteOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível abrir a assinatura deste endereço." }, { status: 403 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: member } = await supabase.from("business_members").select("business_id,role").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (!member) return NextResponse.json({ error: "Somente a pessoa responsável pelo espaço pode gerenciar o plano." }, { status: 403 });
  const stripe = createStripeClient();
  const admin = createAdminClient();
  if (!stripe || !admin) return NextResponse.json({ error: "A assinatura ainda não foi configurada para este ambiente." }, { status: 503 });
  const { data: record } = await admin.from("subscription_records").select("provider,provider_customer_id,provider_livemode").eq("business_id", member.business_id).maybeSingle();
  if (record?.provider !== "stripe" || !record.provider_customer_id || record.provider_livemode !== stripeIsLiveMode()) return NextResponse.json({ error: "Não encontramos uma assinatura neste ambiente. Escolha realizar assinatura para criar seu plano atual." }, { status: 404 });
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({ customer: record.provider_customer_id, return_url: `${siteUrl}/app/assinatura`, locale: "pt-BR" });
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[stripe-portal] Could not create portal session", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Não foi possível abrir o gerenciamento da assinatura." }, { status: 502 });
  }
}
