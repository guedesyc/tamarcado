import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  serviceId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(30),
  preferredDate: z.union([z.string().date(), z.literal("")]).optional(),
  preferredTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Recarregue a página e tente novamente." }, { status: 403 });
  const limit = rateLimitRequest(request, "public-waitlist", 5, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Confira os dados e tente novamente." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.phone.replace(/\D/g, "").length < 10 || parsed.data.phone.replace(/\D/g, "").length > 15) {
    return NextResponse.json({ error: "Informe seu nome e um WhatsApp válido com DDD." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "A lista de espera está temporariamente indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const { error } = await supabase.rpc("join_public_waitlist", {
    p_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_preferred_date: parsed.data.preferredDate || null,
    p_note: parsed.data.note || null,
    p_preferred_time: parsed.data.preferredTime || null,
  });
  if (error) {
    console.error("[public-waitlist] submission rejected", { code: error.code });
    const message = error.message.includes("INVALID_WAITLIST_DATE") ? "Escolha uma data entre hoje e os próximos 12 meses."
      : error.message.includes("INVALID_WAITLIST_REQUEST") ? "Confira seu nome, WhatsApp e observação."
      : error.message.includes("WAITLIST_SERVICE_UNAVAILABLE") ? "Este serviço não está aceitando solicitações agora."
      : "A lista de espera não está disponível para este espaço no momento.";
    return NextResponse.json({ error: message }, { status: error.message.includes("INVALID_WAITLIST") ? 400 : 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, message: "Pedido recebido. Se surgir uma possibilidade, a profissional falará com você pelo WhatsApp." }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
