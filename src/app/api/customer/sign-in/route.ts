import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { safeCustomerNext } from "@/lib/customer-auth";
import { customerAccountCreationEnabled } from "@/lib/customer-account-feature";

const schema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("google"), next: z.string().optional() }),
  z.object({ method: z.literal("email"), email: z.email(), next: z.string().optional() })
]);

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Recarregue a página e tente novamente." }, { status: 403 });
  const limit = rateLimitRequest(request, "customer-sign-in", 5, 15 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Aguarde alguns minutos antes de tentar novamente." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os dados informados." }, { status: 400 });
  const accountsEnabled = customerAccountCreationEnabled();
  if (!accountsEnabled && parsed.data.method === "google") return NextResponse.json({ error: "O acesso de cliente está temporariamente pausado." }, { status: 503 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Acesso indisponível no momento." }, { status: 503 });
  const next = safeCustomerNext(parsed.data.next ?? null);
  const callback = siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`, request.url).toString();
  if (parsed.data.method === "google") {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback } });
    if (error || !data.url) return NextResponse.json({ error: "Não foi possível iniciar o acesso pelo Google." }, { status: 400 });
    return NextResponse.json({ url: data.url }, { headers: { "Cache-Control": "no-store" } });
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callback, shouldCreateUser: accountsEnabled }
  });
  if (error) return NextResponse.json({ error: "Não foi possível enviar o link. Tente novamente em instantes." }, { status: 400 });
  return NextResponse.json({ sent: true }, { headers: { "Cache-Control": "no-store" } });
}
