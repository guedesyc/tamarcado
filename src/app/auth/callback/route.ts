import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { safeAuthCallbackNext } from "@/lib/customer-auth";

export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get("code");const requestedNext=safeAuthCallbackNext(url.searchParams.get("next"));
 if(code){const supabase=await createClient();if(supabase){const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error){const destination=safeAuthCallbackNext(url.searchParams.get("next"));if(destination==="/minha-agenda"||destination.startsWith("/minha-agenda/")){const {data:{user}}=await supabase.auth.getUser();if(user){const {data:professional}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).limit(1).maybeSingle();if(professional)return NextResponse.redirect(siteUrl("/cliente/entrar?erro=customer",request.url));const metadata=user.user_metadata??{};const name=typeof metadata.full_name==="string"?metadata.full_name:typeof metadata.name==="string"?metadata.name:null;const phone=typeof metadata.phone==="string"?metadata.phone:null;const {error:profileError}=await supabase.from("customer_profiles").upsert({user_id:user.id,name,phone},{onConflict:"user_id",ignoreDuplicates:true});if(profileError)console.error("[customer-auth-callback] profile initialization failed",{code:profileError.code});}}return NextResponse.redirect(siteUrl(destination, request.url))}}}
 const errorPath=requestedNext==="/senha"?"/esqueci-senha?erro=link":requestedNext==="/minha-agenda"||requestedNext==="/cliente/senha"?"/cliente/entrar?erro=callback":"/entrar?erro=callback";
 return NextResponse.redirect(siteUrl(errorPath, request.url));
}
