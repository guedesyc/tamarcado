import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const appointmentId = z.string().uuid();
const rescheduleSchema = z.object({ date: z.string().date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

async function owner() {
  const supabase = await createClient();
  if (!supabase) return { response: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (!member) return { response: NextResponse.json({ error: "Somente a responsável pelo espaço pode reagendar atendimentos." }, { status: 403 }) };
  return { supabase };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!appointmentId.safeParse(id).success) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });
  const date = new URL(request.url).searchParams.get("date");
  const parsedDate = z.string().date().safeParse(date);
  if (!parsedDate.success) return NextResponse.json({ error: "Escolha uma data válida." }, { status: 400 });
  const auth = await owner(); if ("response" in auth) return auth.response;
  const { data, error } = await auth.supabase.rpc("get_agenda_reschedule_slots", { p_appointment_id: id, p_date: parsedDate.data });
  if (error) return NextResponse.json({ error: "Não foi possível carregar os horários. Atualize e tente novamente." }, { status: 400 });
  return NextResponse.json({ slots: (data ?? []).map((row: { slot_time: string }) => String(row.slot_time).slice(0, 5)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível reagendar deste endereço." }, { status: 403 });
  const { id } = await params;
  if (!appointmentId.safeParse(id).success) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Escolha a nova data e o horário." }, { status: 400 }); }
  const parsed = rescheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Escolha uma nova data e um horário válido." }, { status: 400 });
  const auth = await owner(); if ("response" in auth) return auth.response;
  const { data, error } = await auth.supabase.rpc("reschedule_agenda_appointment", { p_appointment_id: id, p_date: parsed.data.date, p_time: parsed.data.time });
  if (error) {
    const slotConflict = error.message.includes("SLOT_UNAVAILABLE") || error.code === "23P01";
    const message = slotConflict
      ? "Esse horário deixou de estar disponível. Escolha outro horário."
      : error.message.includes("APPOINTMENT_NOT_RESCHEDULABLE")
        ? "Esse atendimento já mudou de estado e não pode ser reagendado. Atualize a Agenda."
        : "Não foi possível reagendar o atendimento. Atualize a Agenda e tente novamente.";
    return NextResponse.json({ error: message }, { status: slotConflict ? 409 : 400 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
