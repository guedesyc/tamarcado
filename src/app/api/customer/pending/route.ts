import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CUSTOMER_CLAIM_COOKIE } from "@/lib/customer-auth";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const limit = rateLimitRequest(request, "customer-pending", 10, 15 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Aguarde antes de tentar novamente." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(CUSTOMER_CLAIM_COOKIE, hash, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24
  });
  return response;
}
