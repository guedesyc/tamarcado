import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS, bookingSchema } from "@/lib/domain";
import { isSameSiteOrigin } from "@/lib/request-origin";

const answerSchema=z.object({question_id:z.string().uuid(),option_ids:z.array(z.string().uuid()).max(20).default([]),value:z.union([z.string().max(1000),z.number(),z.boolean()]).optional()});
const requestSchema = bookingSchema.extend({ slug: z.string().regex(/^[a-z0-9-]{3,40}$/), answers: z.array(answerSchema).max(20).default([]) });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível enviar sua solicitação deste endereço. Recarregue a página e tente novamente." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Confira os dados e tente de novo." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success || RESERVED_SLUGS.has(parsed.data?.slug ?? "")) return NextResponse.json({ error: "Confira os dados e tente de novo." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Agendamentos ainda não estão disponíveis. Tente novamente mais tarde." }, { status: 503 });
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.rpc("request_public_booking", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_service_id: parsed.data.serviceId,
    p_requested_date: parsed.data.date,
    p_requested_time: parsed.data.time,
    p_answers: parsed.data.answers,
    p_note: parsed.data.note ?? null,
    p_token_hash: tokenHash
  });
  if (error) {
    console.error("[public-booking] request_public_booking failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    const message = error.message.includes("TM_TRIAL_PAUSED") ? "Os agendamentos online estão pausados no momento."
      : error.message.includes("SLOT_UNAVAILABLE") ? "Esse horário acabou de ficar indisponível. Volte ao calendário e escolha outro."
      : error.message.includes("SERVICE_NEEDS_REVIEW") ? "A profissional ainda precisa configurar a duração deste serviço. Escolha outro serviço ou fale com ela."
      : error.message.includes("SERVICE_NOT_FOUND") || error.message.includes("PROFILE_NOT_FOUND") ? "Esta página ou serviço não está disponível para agendamentos agora."
      : error.message.includes("INVALID_BOOKING") ? "Confira seu nome e WhatsApp e tente novamente."
      : "Não foi possível registrar sua solicitação agora. Recarregue a página e tente novamente.";
    const status = error.message.includes("TM_TRIAL_PAUSED") ? 402 : error.message.includes("SLOT_UNAVAILABLE") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true, trackingUrl: `/r/${token}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
