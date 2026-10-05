import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { safeAuthCallbackNext } from "@/lib/customer-auth";

export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get("code");
 if(code){const supabase=await createClient();if(supabase){const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error){const destination=safeAuthCallbackNext(url.searchParams.get("next"));return NextResponse.redirect(siteUrl(destination, request.url))}}}
 return NextResponse.redirect(siteUrl("/entrar?erro=callback", request.url));
}
