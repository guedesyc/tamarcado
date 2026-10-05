import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_CLAIM_COOKIE } from "@/lib/customer-auth";
import { siteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { cookies } = await import("next/headers");
  const proof = (await cookies()).get(CUSTOMER_CLAIM_COOKIE)?.value;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const destination = siteUrl("/minha-agenda", request.url);
  if (proof && user && /^[a-f0-9]{64}$/.test(proof)) {
    const { data, error } = await supabase!.rpc("claim_customer_appointment", { p_token_hash: proof });
    if (error || !data) destination.searchParams.set("aviso", "vinculo");
  }
  const response = NextResponse.redirect(destination);
  response.cookies.delete(CUSTOMER_CLAIM_COOKIE);
  return response;
}
