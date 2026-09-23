import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SetAllCookies } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  let response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key){const target=new URL("/entrar?erro=config",request.url);return NextResponse.redirect(target)}
  const supabase=createServerClient(url,key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(values:SetAllCookies extends (cookies:infer T)=>unknown?T:never)=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}
  }});
  const {data}=await supabase.auth.getClaims();
  if(!data?.claims){const target=new URL("/entrar",request.url);target.searchParams.set("next",request.nextUrl.pathname);return NextResponse.redirect(target)}
  return response;
}
