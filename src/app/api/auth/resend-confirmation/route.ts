import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) {
    return NextResponse.redirect(siteUrl("/entrar?cadastro=confirme-email&erro=reenvio", request.url), 303);
  }

  const limit = rateLimitRequest(request, "auth-resend-confirmation", 3, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.redirect(siteUrl("/entrar?cadastro=confirme-email&erro=reenvio-limite", request.url), 303);
  }

  const form = await request.formData();
  const parsed = schema.safeParse({ email: form.get("email") });
  if (!parsed.success) {
    return NextResponse.redirect(siteUrl("/entrar?cadastro=confirme-email&erro=reenvio", request.url), 303);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(siteUrl("/entrar?cadastro=confirme-email&erro=config", request.url), 303);
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: siteUrl("/auth/callback", request.url).toString() },
  });

  if (error) {
    return NextResponse.redirect(siteUrl("/entrar?cadastro=confirme-email&erro=reenvio", request.url), 303);
  }

  return NextResponse.redirect(siteUrl("/entrar?cadastro=reenvio-enviado", request.url), 303);
}
