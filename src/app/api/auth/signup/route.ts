import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email().max(254), password: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128) });

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = schema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (!parsed.success) return NextResponse.redirect(siteUrl("/cadastro?erro=invalid", request.url), 303);
  if (parsed.data.password !== parsed.data.confirmPassword) return NextResponse.redirect(siteUrl("/cadastro?erro=confirmacao", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(siteUrl("/cadastro?erro=config", request.url), 303);
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { full_name: parsed.data.name }, emailRedirectTo: siteUrl("/auth/callback", request.url).toString() } });
  if (error) return NextResponse.redirect(siteUrl("/cadastro?erro=signup", request.url), 303);
  return NextResponse.redirect(siteUrl("/entrar?cadastro=confirme-email", request.url), 303);
}
