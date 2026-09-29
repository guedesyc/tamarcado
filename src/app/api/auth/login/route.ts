import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return NextResponse.redirect(siteUrl("/entrar?erro=invalid", request.url), 303);
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(siteUrl("/entrar?erro=config", request.url), 303);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return NextResponse.redirect(siteUrl("/entrar?erro=credentials", request.url), 303);
  return NextResponse.redirect(siteUrl("/app", request.url), 303);
}
