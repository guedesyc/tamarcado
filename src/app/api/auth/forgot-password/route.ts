import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema=z.object({email:z.string().email().max(254)});
export async function POST(request:Request){if(!isSameSiteOrigin(request))return NextResponse.redirect(siteUrl("/esqueci-senha?erro=email",request.url),303);const limit=rateLimitRequest(request,"auth-password-reset",5,60*60*1000);if(!limit.allowed)return NextResponse.redirect(siteUrl("/esqueci-senha?erro=limite",request.url),303);const form=await request.formData();const parsed=schema.safeParse({email:form.get("email")});if(!parsed.success)return NextResponse.redirect(siteUrl("/esqueci-senha?erro=email",request.url),303);const supabase=await createClient();if(!supabase)return NextResponse.redirect(siteUrl("/esqueci-senha?erro=config",request.url),303);await supabase.auth.resetPasswordForEmail(parsed.data.email,{redirectTo:siteUrl("/auth/callback?next=%2Fsenha",request.url).toString()});return NextResponse.redirect(siteUrl("/esqueci-senha?enviado=1",request.url),303)}
