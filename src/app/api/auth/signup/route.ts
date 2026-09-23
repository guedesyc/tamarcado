import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email().max(254), password: z.string().min(10).max(128) });

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = schema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return NextResponse.redirect(new URL("/cadastro?erro=invalid", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL("/cadastro?erro=config", request.url), 303);
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { full_name: parsed.data.name }, emailRedirectTo: new URL("/auth/callback", request.url).toString() } });
  if (error) return NextResponse.redirect(new URL("/cadastro?erro=signup", request.url), 303);
  return NextResponse.redirect(new URL("/entrar?cadastro=confirme-email", request.url), 303);
}
