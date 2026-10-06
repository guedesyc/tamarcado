import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { hasStrongPassword } from "@/lib/password-policy";
import { customerAccountCreationEnabled } from "@/lib/customer-account-feature";

const schema = z.object({
  name: z.string().trim().min(2).max(120), phone: z.string().trim().min(10).max(40),
  email: z.string().email().max(254), password: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128)
});

export async function POST(request: Request) {
  if (!customerAccountCreationEnabled()) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=signup-paused", request.url), 303);
  if (!isSameSiteOrigin(request)) return NextResponse.redirect(siteUrl("/cliente/cadastro?erro=invalid", request.url), 303);
  const limit = rateLimitRequest(request, "customer-signup", 5, 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.redirect(siteUrl("/cliente/cadastro?erro=limit", request.url), 303);
  const form = await request.formData();
  const parsed = schema.safeParse({ name: form.get("name"), phone: form.get("phone"), email: form.get("email"), password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (!parsed.success || !hasStrongPassword(parsed.data.password)) return NextResponse.redirect(siteUrl("/cliente/cadastro?erro=invalid", request.url), 303);
  if (parsed.data.password !== parsed.data.confirmPassword) return NextResponse.redirect(siteUrl("/cliente/cadastro?erro=confirmation", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(siteUrl("/cliente/cadastro?erro=config", request.url), 303);
  const callback = siteUrl("/auth/callback?next=%2Fminha-agenda", request.url).toString();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { account_type: "customer", full_name: parsed.data.name, phone: parsed.data.phone }, emailRedirectTo: callback }
  });
  if (error) return NextResponse.redirect(siteUrl("/cliente/cadastro?erro=signup", request.url), 303);
  return NextResponse.redirect(siteUrl("/cliente/entrar?cadastro=confirme-email", request.url), 303);
}
