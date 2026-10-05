import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível gerar o link deste endereço." }, { status: 403 });
  const limit = rateLimitRequest(request, "appointment-tracking-link", 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Muitas solicitações em sequência. Aguarde um instante." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

  const trackingToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(trackingToken).digest("hex");
  const { error } = await supabase.rpc("issue_appointment_tracking_link", { p_appointment_id: id, p_token_hash: tokenHash });
  if (error) {
    console.error("[appointment-tracking-link] RPC failed", { code: error.code, appointmentId: id });
    const notFound = error.message.includes("Appointment not found");
    return NextResponse.json({ error: notFound ? "Atendimento não encontrado ou indisponível." : "Não foi possível gerar o link. Confira se a migration de links de acompanhamento está aplicada." }, { status: notFound ? 404 : 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, tracking_token: trackingToken }, { headers: { "Cache-Control": "no-store" } });
}
