import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.redirect(siteUrl("/entrar?erro=invalid", request.url), 303);
  const limit = rateLimitRequest(request, "auth-login", 10, 15 * 60 * 1000);
  if (!limit.allowed) return NextResponse.redirect(siteUrl("/entrar?erro=limite", request.url), 303);
  const form = await request.formData();
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return NextResponse.redirect(siteUrl("/entrar?erro=invalid", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(siteUrl("/entrar?erro=config", request.url), 303);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return NextResponse.redirect(siteUrl("/entrar?erro=credentials", request.url), 303);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (membership) {
      const { data: business } = await supabase.from("businesses").select("slug,published_at").eq("id", membership.business_id).maybeSingle();
      if (business?.published_at && business.slug) return NextResponse.redirect(siteUrl(`/${business.slug}`, request.url), 303);
    }
    const { data: customer } = await supabase.from("customer_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (customer) {
      await supabase.auth.signOut();
      return NextResponse.redirect(siteUrl("/cliente/entrar?erro=customer", request.url), 303);
    }
  }
  return NextResponse.redirect(siteUrl("/app", request.url), 303);
}
