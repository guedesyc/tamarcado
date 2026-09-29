import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const optionSchema = z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(1).max(120), price_delta_cents: z.number().int().min(-10000000).max(10000000), duration_delta_minutes: z.number().int().min(-1440).max(1440) });
const questionSchema = z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(1).max(200), field_type: z.enum(["single_choice", "multiple_choice", "text", "number", "boolean", "note"]), required: z.boolean(), options: z.array(optionSchema).max(20) }).superRefine((question, context) => {
  if (["single_choice", "multiple_choice"].includes(question.field_type) && question.options.length === 0) context.addIssue({ code: "custom", message: "Inclua pelo menos uma opção para cada pergunta de escolha." });
});
const schema = z.object({ questions: z.array(questionSchema).max(20) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível salvar desta página." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Serviço inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Confira as perguntas e tente novamente." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Confira as perguntas." }, { status: 400 });
  const questions = parsed.data.questions.map(question => ({ ...question, options: question.options.map(option => ({ ...option, price_delta_cents: Math.round(option.price_delta_cents), duration_delta_minutes: Math.trunc(option.duration_delta_minutes) })) }));
  const { data, error } = await supabase.rpc("save_service_questions", { p_service_id: id, p_questions: questions });
  if (error || !data) {
    const message = error?.message.includes("QUESTION_NEEDS_OPTION") ? "Perguntas de escolha precisam ter ao menos uma opção." : "Não foi possível salvar as perguntas deste serviço. Atualize e tente novamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
