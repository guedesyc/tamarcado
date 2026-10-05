import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { isSameSiteOrigin } from "@/lib/request-origin";

export async function POST(request:Request){if(!isSameSiteOrigin(request))return NextResponse.redirect(siteUrl("/app",request.url),303);const supabase=await createClient();if(supabase)await supabase.auth.signOut();return NextResponse.redirect(siteUrl("/",request.url),303)}
