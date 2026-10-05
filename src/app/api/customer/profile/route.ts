import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema = z.object({
  name: z.string().trim().min(2).max(120).nullable(),
  phone: z.string().trim().min(10).max(40).refine(value => /^\d{10,13}$/.test(value.replace(/\D/g, ""))).nullable()
});

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira nome e WhatsApp." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Acesso indisponível." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { error } = await supabase.from("customer_profiles").upsert({
    user_id: user.id, name: parsed.data.name, phone: parsed.data.phone,
    updated_at: new Date().toISOString()
  });
  if (error) return NextResponse.json({ error: "Não foi possível salvar. Confira se a migration foi aplicada." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
