import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export async function POST(request:Request){const supabase=await createClient();if(supabase)await supabase.auth.signOut();return NextResponse.redirect(siteUrl("/",request.url),303)}
