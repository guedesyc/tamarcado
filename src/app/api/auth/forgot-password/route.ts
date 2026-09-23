import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({email:z.string().email().max(254)});
export async function POST(request:Request){const form=await request.formData();const parsed=schema.safeParse({email:form.get("email")});if(!parsed.success)return NextResponse.redirect(new URL("/esqueci-senha?erro=email",request.url),303);const supabase=await createClient();if(!supabase)return NextResponse.redirect(new URL("/esqueci-senha?erro=config",request.url),303);await supabase.auth.resetPasswordForEmail(parsed.data.email,{redirectTo:new URL("/auth/callback?next=%2Fsenha",request.url).toString()});return NextResponse.redirect(new URL("/esqueci-senha?enviado=1",request.url),303)}
