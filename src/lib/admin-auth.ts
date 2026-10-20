import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformAdminAccess =
  | { status: "denied" }
  | { status: "needs_mfa"; userId: string }
  | { status: "ok"; userId: string };

/**
 * Server-side gate for /admin. The session JWT is verified by getClaims(); the
 * allowlist lives in public.platform_admins (RLS on, no policies) and is read
 * with the service role. Callers must answer "denied" with a 404.
 */
export async function getPlatformAdminAccess(): Promise<PlatformAdminAccess> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { status: "denied" };
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { status: "denied" };
  const { data: row, error: lookupError } = await admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (lookupError || !row) return { status: "denied" };
  return data.claims.aal === "aal2" ? { status: "ok", userId } : { status: "needs_mfa", userId };
}

export async function recordAdminAudit(actorId: string, action: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  if (!admin) return;
  // business_id stays null so these rows never show up for professionals through tenant RLS.
  const { error } = await admin.from("audit_logs").insert({ actor_id: actorId, action, entity_type: "platform_admin", entity_id: entityId, metadata });
  if (error) console.error("[admin-audit] insert failed", { code: error.code });
}
