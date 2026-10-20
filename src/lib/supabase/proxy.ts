import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SetAllCookies } from "@supabase/ssr";

const LAST_SEEN_COOKIE="tm_last_seen";

export async function updateSession(request: NextRequest) {
  let response=NextResponse.next({request});
  // /admin only refreshes the session here; the page itself answers 404 to anyone who is not a platform admin.
  const isAdminPath=request.nextUrl.pathname==="/admin"||request.nextUrl.pathname.startsWith("/admin/");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key){if(isAdminPath)return response;const target=new URL("/entrar?erro=config",request.url);return NextResponse.redirect(target)}
  const supabase=createServerClient(url,key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(values:SetAllCookies extends (cookies:infer T)=>unknown?T:never)=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}
  }});
  const {data}=await supabase.auth.getClaims();
  if(isAdminPath)return response;
  if(!data?.claims){const target=new URL("/entrar",request.url);target.searchParams.set("next",request.nextUrl.pathname);return NextResponse.redirect(target)}
  // Last access for the admin panel: the cookie keeps this to one database call per hour per browser,
  // and touch_last_seen() itself skips the write when the stored value is less than an hour old.
  if(!request.cookies.get(LAST_SEEN_COOKIE)){
    const {error}=await supabase.rpc("touch_last_seen");
    if(error)console.error("[last-seen] update failed",{code:error.code});
    response.cookies.set(LAST_SEEN_COOKIE,"1",{maxAge:60*60,httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/app"});
  }
  return response;
}
