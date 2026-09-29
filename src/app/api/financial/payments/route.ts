import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema = z.object({ appointmentId: z.string().uuid(), totalCents: z.number().int().min(0).max(100000000), receivedCents: z.number().int().min(1).max(100000000), method: z.enum(["pix", "cash", "card", "transfer", "other"]), note: z.string().trim().max(300).optional() });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Recarregue a página e tente novamente." }, { status: 403 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Confira os valores informados." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira o valor total e o valor recebido." }, { status: 400 });
  const value = parsed.data;
  const { data, error } = await supabase.rpc("record_appointment_payment", { p_appointment_id: value.appointmentId, p_total_cents: value.totalCents, p_received_cents: value.receivedCents, p_method: value.method, p_note: value.note ?? null });
  if (error) {
    const code = error.message.match(/APPOINTMENT_NOT_CONFIRMED|SIGNAL_NOT_VERIFIED|ALREADY_PAID|OVERPAYMENT|INVALID_TOTAL|INVALID_PAYMENT/)?.[0];
    const messages: Record<string, string> = { APPOINTMENT_NOT_CONFIRMED: "Só é possível registrar recebimentos de um atendimento confirmado.", SIGNAL_NOT_VERIFIED: "Confirme primeiro o recebimento do sinal; depois registre o saldo restante.", ALREADY_PAID: "O valor total deste atendimento já foi recebido.", OVERPAYMENT: "O valor recebido ultrapassaria o total combinado.", INVALID_TOTAL: "Confira o valor total do serviço.", INVALID_PAYMENT: "O valor recebido deve ser maior que zero." };
    return NextResponse.json({ error: code ? messages[code] : "Não foi possível registrar o recebimento." }, { status: code === "APPOINTMENT_NOT_CONFIRMED" ? 409 : 400 });
  }
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}
