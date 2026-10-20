import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdminAccess, recordAdminAudit } from "@/lib/admin-auth";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";

const schema = z.object({ userId: z.string().uuid() });
const notFound = () => new NextResponse(null, { status: 404 });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return notFound();
  const access = await getPlatformAdminAccess();
  if (access.status !== "ok") return notFound();
  const back = (notice: string, userId?: string) => NextResponse.redirect(siteUrl(`/admin?aviso=${notice}${userId ? `&alvo=${userId}` : ""}`, request.url), 303);
  if (!rateLimitRequest(request, "admin-resend-confirmation", 20, 15 * 60 * 1000).allowed) return back("erro-reenvio");
  const form = await request.formData();
  const parsed = schema.safeParse({ userId: form.get("userId") });
  const admin = createAdminClient();
  if (!parsed.success || !admin) return back("erro-reenvio");
  const { data, error } = await admin.auth.admin.getUserById(parsed.data.userId);
  const user = data?.user;
  if (error || !user?.email) return back("erro-reenvio");
  if (user.email_confirmed_at) return back("ja-confirmado", user.id);
  const { error: resendError } = await admin.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: siteUrl("/auth/callback", request.url).toString() },
  });
  await recordAdminAudit(access.userId, "admin.resend_confirmation", user.id, { ok: !resendError });
  if (resendError) console.error("[admin-resend] resend failed", { code: "code" in resendError ? resendError.code : undefined, status: resendError.status });
  return back(resendError ? "erro-reenvio" : "reenviado", user.id);
}
