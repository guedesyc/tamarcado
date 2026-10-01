import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível atualizar este endereço." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

  const { error } = await supabase.rpc("mark_client_cancellation_seen", { p_appointment_id: id });
  if (error) {
    console.error("[mark-cancellation-seen] RPC failed", { code: error.code, appointmentId: id });
    return NextResponse.json({ error: "Não foi possível marcar o cancelamento como visto. Atualize a página e tente novamente." }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
