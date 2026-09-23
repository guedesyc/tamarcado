import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SetAllCookies } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values: SetAllCookies extends (cookies:infer T)=>unknown?T:never) => {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot write cookies. */ }
      }
    }
  });
}
