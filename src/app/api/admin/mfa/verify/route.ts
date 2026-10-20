import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdminAccess, recordAdminAudit } from "@/lib/admin-auth";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({ code: z.string().regex(/^\d{6}$/), factorId: z.string().uuid().optional() });
const notFound = () => new NextResponse(null, { status: 404 });
const INVALID_CODE = "Código incorreto. Use o código atual do Tá Marcado no app autenticador e confira se o horário do celular está automático.";
const ERROR_MESSAGES: Record<string, string> = {
  mfa_verification_failed: INVALID_CODE,
  mfa_challenge_expired: "O tempo para digitar o código acabou. Tente com o código atual.",
  mfa_factor_not_found: "Esse QR code não vale mais. Recarregue a página e configure o 2FA de novo.",
  mfa_totp_verify_not_enabled: "A verificação por app autenticador (TOTP) está desativada no Supabase. Ative em Authentication → Multi-Factor.",
  mfa_verification_rejected: "O Supabase recusou a verificação. Tente de novo em alguns minutos.",
};

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return notFound();
  const access = await getPlatformAdminAccess();
  if (access.status !== "needs_mfa") return notFound();
  if (!rateLimitRequest(request, "admin-mfa-verify", 5, 15 * 60 * 1000).allowed) return NextResponse.json({ error: "Muitas tentativas. Espere 15 minutos e tente de novo." }, { status: 429 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Código inválido." }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return notFound();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactors = (factors?.all ?? []).filter(factor => factor.factor_type === "totp");
  const factor = parsed.data.factorId ? totpFactors.find(item => item.id === parsed.data.factorId) : totpFactors.find(item => item.status === "verified");
  if (!factor) return NextResponse.json({ error: ERROR_MESSAGES.mfa_factor_not_found }, { status: 400 });
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
  if (error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    console.error("[admin-mfa] verify failed", { code, status: error.status });
    return NextResponse.json({ error: ERROR_MESSAGES[code] ?? `Não foi possível verificar o código${code ? ` (${code})` : ""}.` }, { status: 400 });
  }
  await recordAdminAudit(access.userId, "admin.mfa_verified", null);
  return NextResponse.json({ ok: true });
}
