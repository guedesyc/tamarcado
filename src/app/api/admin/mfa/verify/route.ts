import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdminAccess, recordAdminAudit } from "@/lib/admin-auth";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({ code: z.string().regex(/^\d{6}$/), factorId: z.string().uuid().optional() });
const notFound = () => new NextResponse(null, { status: 404 });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return notFound();
  const access = await getPlatformAdminAccess();
  if (access.status !== "needs_mfa") return notFound();
  if (!rateLimitRequest(request, "admin-mfa-verify", 5, 15 * 60 * 1000).allowed) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Código inválido." }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return notFound();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactors = (factors?.all ?? []).filter(factor => factor.factor_type === "totp");
  const factor = parsed.data.factorId ? totpFactors.find(item => item.id === parsed.data.factorId) : totpFactors.find(item => item.status === "verified");
  if (!factor) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
  if (error) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  await recordAdminAudit(access.userId, "admin.mfa_verified", null);
  return NextResponse.json({ ok: true });
}
