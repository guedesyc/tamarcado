import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=invalid", request.url), 303);
  const limit = rateLimitRequest(request, "customer-password-login", 10, 15 * 60 * 1000);
  if (!limit.allowed) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=limit", request.url), 303);
  const form = await request.formData();
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=invalid", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=config", request.url), 303);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=credentials", request.url), 303);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(siteUrl("/cliente/entrar?erro=credentials", request.url), 303);
  const { data: professional } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (professional) {
    await supabase.auth.signOut();
    return NextResponse.redirect(siteUrl("/cliente/entrar?erro=customer", request.url), 303);
  }
  return NextResponse.redirect(siteUrl("/minha-agenda", request.url), 303);
}
