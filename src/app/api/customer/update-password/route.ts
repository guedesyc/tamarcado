import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { hasStrongPassword } from "@/lib/password-policy";

const schema = z.object({ password: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128) });
export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.redirect(siteUrl("/cliente/senha?erro=update", request.url), 303);
  const form = await request.formData(); const parsed = schema.safeParse({ password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (!parsed.success || !hasStrongPassword(parsed.data.password) || parsed.data.password !== parsed.data.confirmPassword) return NextResponse.redirect(siteUrl("/cliente/senha?erro=password", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=config", request.url), 303);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(siteUrl("/cliente/entrar", request.url), 303);
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return NextResponse.redirect(siteUrl("/cliente/senha?erro=update", request.url), 303);
  return NextResponse.redirect(siteUrl("/minha-agenda", request.url), 303);
}
