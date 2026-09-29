import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

const schema=z.object({password:z.string().min(10).max(128)});
export async function POST(request:Request){const form=await request.formData();const parsed=schema.safeParse({password:form.get("password")});if(!parsed.success)return NextResponse.redirect(siteUrl("/senha?erro=password",request.url),303);const supabase=await createClient();if(!supabase)return NextResponse.redirect(siteUrl("/entrar?erro=config",request.url),303);const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(siteUrl("/entrar",request.url),303);const {error}=await supabase.auth.updateUser({password:parsed.data.password});if(error)return NextResponse.redirect(siteUrl("/senha?erro=update",request.url),303);return NextResponse.redirect(siteUrl("/app",request.url),303)}
