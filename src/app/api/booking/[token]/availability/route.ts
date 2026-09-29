import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ date: z.string().date() });
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return NextResponse.json({ slots: [] }, { status: 404, headers: noStore });
  }
  const parsed = querySchema.safeParse({ date: new URL(request.url).searchParams.get("date") });
  if (!parsed.success) return NextResponse.json({ slots: [] }, { status: 400, headers: noStore });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ slots: [] }, { status: 503, headers: noStore });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.rpc("get_public_booking_slots", {
    p_token_hash: tokenHash,
    p_date: parsed.data.date,
  });
  if (error) return NextResponse.json({ slots: [] }, { status: 400, headers: noStore });
  const slots = ((data ?? []) as { slot_time: string }[]).map(({ slot_time }) => String(slot_time).slice(0, 5));
  return NextResponse.json({ slots }, { headers: noStore });
}
