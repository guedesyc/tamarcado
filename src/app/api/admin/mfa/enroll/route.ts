import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdminAccess, recordAdminAudit } from "@/lib/admin-auth";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const notFound = () => new NextResponse(null, { status: 404 });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return notFound();
  const access = await getPlatformAdminAccess();
  if (access.status !== "needs_mfa") return notFound();
  if (!rateLimitRequest(request, "admin-mfa-enroll", 5, 15 * 60 * 1000).allowed) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  const supabase = await createClient();
  if (!supabase) return notFound();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) return NextResponse.json({ error: "Não foi possível consultar o 2FA." }, { status: 500 });
  // Once a TOTP factor is verified, a new one can only be added from an aal2 session.
  // Otherwise someone holding only the password could replace the existing 2FA.
  if (factors.totp.length) return NextResponse.json({ error: "2FA já configurado." }, { status: 409 });
  for (const factor of factors.all.filter(item => item.factor_type === "totp" && item.status !== "verified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Tá Marcado admin", issuer: "Tá Marcado" });
  if (error || !data) return NextResponse.json({ error: "Não foi possível iniciar o 2FA." }, { status: 500 });
  await recordAdminAudit(access.userId, "admin.mfa_enroll_started", null);
  return NextResponse.json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
}
