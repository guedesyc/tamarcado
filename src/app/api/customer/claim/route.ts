import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { rateLimitRequest } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) });

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const limit = rateLimitRequest(request, "customer-claim", 10, 15 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Aguarde antes de tentar novamente." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Acesso indisponível." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  const { data, error } = await supabase.rpc("claim_customer_appointment", { p_token_hash: hash });
  if (error || !data) return NextResponse.json({ error: "Este atendimento não pôde ser associado. Confira o link de acompanhamento." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
