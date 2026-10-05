import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema = z.object({ status: z.enum(["contacted", "booked", "withdrawn"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Recarregue a página e tente novamente." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Confira a ação e tente novamente." }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { error } = await supabase.rpc("update_waitlist_status", { p_entry_id: id, p_status: parsed.data.status });
  if (error) {
    console.error("[waitlist-status] update rejected", { code: error.code });
    return NextResponse.json({ error: "Não foi possível atualizar este registro. Atualize a página e tente novamente." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Recarregue a página e tente novamente." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { error } = await supabase.rpc("erase_waitlist_entry", { p_entry_id: id });
  if (error) {
    console.error("[waitlist-erasure] request rejected", { code: error.code });
    return NextResponse.json({ error: "Não foi possível apagar este contato. Atualize a página e tente novamente." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
