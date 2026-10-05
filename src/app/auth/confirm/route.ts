import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (hash && type === "email") {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: hash, type: "email" });
      if (!error) return NextResponse.redirect(siteUrl("/minha-agenda", request.url));
    }
  }
  return NextResponse.redirect(siteUrl("/minha-agenda?erro=link", request.url));
}
