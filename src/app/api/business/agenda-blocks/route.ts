import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const createSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: time, end: time, acknowledgeConflicts: z.boolean().default(false), resolution: z.enum(["keep", "cancel", "reschedule"]).default("keep") });
const deleteSchema = z.object({ id: z.string().uuid() });

async function owner() {
  const supabase = await createClient();
  if (!supabase) return { response: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (!member) return { response: NextResponse.json({ error: "Somente a responsável pelo espaço pode bloquear a agenda." }, { status: 403 }) };
  return { supabase, businessId: member.business_id };
}

export async function GET() {
  const auth = await owner(); if ("response" in auth) return auth.response;
  const [business, blocks] = await Promise.all([
    auth.supabase.from("businesses").select("timezone").eq("id", auth.businessId).single(),
    auth.supabase.from("availability_exceptions").select("id,starts_at,ends_at,label").eq("business_id", auth.businessId).eq("kind", "blocked").gt("ends_at", new Date().toISOString()).order("starts_at").limit(100),
  ]);
  if (business.error || blocks.error) return NextResponse.json({ error: "Não foi possível carregar os bloqueios da agenda." }, { status: 500 });
  return NextResponse.json({ timeZone: business.data.timezone || "America/Sao_Paulo", blocks: blocks.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível salvar desta página." }, { status: 403 });
  const auth = await owner(); if ("response" in auth) return auth.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Confira a data e os horários." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success || parsed.data.end <= parsed.data.start) return NextResponse.json({ error: "Informe uma data e um intervalo válido. O fim deve ser depois do início." }, { status: 400 });

  const { data, error } = await auth.supabase.rpc("create_agenda_block", {
    p_date: parsed.data.date,
    p_start: parsed.data.start,
    p_end: parsed.data.end,
    p_acknowledge_conflicts: parsed.data.acknowledgeConflicts,
    p_label: "Bloqueio de agenda",
    p_resolution: parsed.data.resolution,
  });
  if (error) {
    const messages: Record<string, string> = {
      BLOCK_MUST_BE_FUTURE: "O bloqueio precisa começar em um horário futuro.",
      INVALID_BLOCK_RANGE: "O horário final precisa ser depois do horário inicial.",
      AUTH_REQUIRED: "Entre na sua conta para continuar.",
      BUSINESS_NOT_FOUND: "Não encontramos seu espaço profissional.",
      RESOLUTION_REQUIRED: "Escolha se deseja cancelar ou reagendar os atendimentos afetados.",
      NO_APPOINTMENTS_TO_RESOLVE: "Não há atendimentos afetados para tratar neste horário.",
    };
    const code = error.message.match(/(?:^|[^A-Z_])([A-Z_]{5,})(?:$|[^A-Z_])/g)?.map(value => value.trim().replace(/^[^A-Z_]+|[^A-Z_]+$/g, "")).find(value => messages[value]);
    return NextResponse.json({ error: code ? messages[code] : "Não foi possível criar o bloqueio. Atualize a página e tente novamente." }, { status: 400 });
  }
  const result = data as { requires_confirmation?: boolean; already_blocked?: boolean; blocked?: boolean; appointments?: unknown[] };
  if (result.already_blocked) return NextResponse.json({ error: "Já existe um bloqueio que cruza esse intervalo. Confira a Agenda." }, { status: 409 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível alterar os bloqueios desta página." }, { status: 403 });
  const auth = await owner(); if ("response" in auth) return auth.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Atualize a página e tente novamente." }, { status: 400 }); }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Bloqueio inválido." }, { status: 400 });
  const { data, error } = await auth.supabase.from("availability_exceptions").delete().eq("id", parsed.data.id).eq("business_id", auth.businessId).eq("kind", "blocked").select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível remover esse bloqueio. Atualize a página e tente novamente." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
