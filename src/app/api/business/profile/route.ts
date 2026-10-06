import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS } from "@/lib/domain";
import { isSameSiteOrigin } from "@/lib/request-origin";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const billingEmail = z.string().trim().max(255).refine(value => value === "" || z.string().email().safeParse(value).success);
const schema = z.object({
  name: z.string().trim().min(2).max(120), display_name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(40),
  contact_phone: z.string().trim().min(10).max(40), neighborhood: z.string().trim().max(100),
  billing_email: billingEmail,
  city: z.string().trim().max(100), state: z.string().trim().max(60), bio: z.string().max(1000),
  cancellation_refund_policy: z.enum(["none", "before_hours"]), cancellation_refund_hours: z.number().int().min(1).max(720),
  category_ids: z.array(z.string().uuid()).max(8),
  rules: z.array(z.object({ id: z.string().uuid().optional(), weekday: z.number().int().min(0).max(6), start_time: time, end_time: time })).max(28),
}).superRefine((value, context) => {
  if (new Set(value.rules.map(rule => rule.id).filter(Boolean)).size !== value.rules.filter(rule => rule.id).length) context.addIssue({ code: "custom", path: ["rules"], message: "Horário duplicado." });
  if (value.rules.some(rule => rule.start_time >= rule.end_time)) context.addIssue({ code: "custom", path: ["rules"], message: "O fim de cada expediente deve ser depois do início." });
});

async function owner() {
  const supabase = await createClient();
  if (!supabase) return { response: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (!member) return { response: NextResponse.json({ error: "Somente a pessoa responsável pode alterar os dados do espaço." }, { status: 403 }) };
  return { supabase, businessId: member.business_id, user };
}

export async function GET() {
  const auth = await owner(); if ("response" in auth) return auth.response;
  const [businessResult, profileResult, categoriesResult, selectedResult, rulesResult] = await Promise.all([
    auth.supabase.from("businesses").select("name,slug,contact_phone,billing_email,public_neighborhood,public_city,public_state,description,cancellation_refund_policy,cancellation_refund_hours").eq("id", auth.businessId).single(),
    auth.supabase.from("professional_profiles").select("display_name,bio").eq("business_id", auth.businessId).maybeSingle(),
    auth.supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
    auth.supabase.from("business_categories").select("category_id").eq("business_id", auth.businessId),
    auth.supabase.from("availability_rules").select("id,weekday,start_time,end_time").eq("business_id", auth.businessId).order("weekday").order("start_time"),
  ]);
  if (businessResult.error || rulesResult.error) return NextResponse.json({ error: "Não foi possível carregar as configurações do espaço." }, { status: 500 });
  return NextResponse.json({ ...businessResult.data, display_name: profileResult.data?.display_name ?? "", bio: profileResult.data?.bio ?? businessResult.data.description ?? "", email: auth.user.email ?? "", categories: categoriesResult.data ?? [], category_ids: (selectedResult.data ?? []).map(row => row.category_id), rules: rulesResult.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível salvar desta página." }, { status: 403 });
  const auth = await owner(); if ("response" in auth) return auth.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Confira as informações e tente novamente." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira nome, endereço público, categorias e horários." }, { status: 400 });
  const value = parsed.data;
  if (RESERVED_SLUGS.has(value.slug)) return NextResponse.json({ error: "Esse endereço está reservado. Escolha outro link." }, { status: 400 });

  const [{ data: duplicate }, { data: categories }, { data: existingRules }, { data: existingCategories }] = await Promise.all([
    auth.supabase.from("businesses").select("id").eq("slug", value.slug).neq("id", auth.businessId).maybeSingle(),
    auth.supabase.from("categories").select("id").in("id", value.category_ids),
    auth.supabase.from("availability_rules").select("id,weekday").eq("business_id", auth.businessId),
    auth.supabase.from("business_categories").select("category_id").eq("business_id", auth.businessId),
  ]);
  if (duplicate) return NextResponse.json({ error: "Esse link já está sendo usado por outro negócio." }, { status: 409 });
  if ((categories ?? []).length !== value.category_ids.length) return NextResponse.json({ error: "Uma das categorias selecionadas não está disponível." }, { status: 400 });
  const { error: businessError } = await auth.supabase.from("businesses").update({ name: value.name, slug: value.slug, contact_phone: value.contact_phone, billing_email: value.billing_email || null, public_neighborhood: value.neighborhood || null, public_city: value.city || null, public_state: value.state || null, description: value.bio, cancellation_refund_policy: value.cancellation_refund_policy, cancellation_refund_hours: value.cancellation_refund_hours }).eq("id", auth.businessId);
  if (businessError) return NextResponse.json({ error: "Não foi possível salvar os dados do negócio. Verifique se o link está disponível." }, { status: 400 });
  const { error: profileError } = await auth.supabase.from("professional_profiles").upsert({ business_id: auth.businessId, display_name: value.display_name, bio: value.bio }, { onConflict: "business_id" });
  if (profileError) return NextResponse.json({ error: "O negócio foi atualizado, mas não foi possível salvar o nome profissional." }, { status: 500 });

  const wantedCategories = new Set(value.category_ids);
  const removedCategories = (existingCategories ?? []).map(row => row.category_id).filter(id => !wantedCategories.has(id));
  if (removedCategories.length) {
    const { error } = await auth.supabase.from("business_categories").delete().eq("business_id", auth.businessId).in("category_id", removedCategories);
    if (error) return NextResponse.json({ error: "Dados básicos salvos, mas não foi possível atualizar as categorias." }, { status: 500 });
  }
  const currentCategories = new Set((existingCategories ?? []).map(row => row.category_id));
  const addedCategories = value.category_ids.filter(id => !currentCategories.has(id));
  if (addedCategories.length) {
    const { error } = await auth.supabase.from("business_categories").insert(addedCategories.map(category_id => ({ business_id: auth.businessId, category_id })));
    if (error) return NextResponse.json({ error: "Dados básicos salvos, mas não foi possível atualizar as categorias." }, { status: 500 });
  }

  const knownRules = new Set((existingRules ?? []).map(rule => rule.id));
  const unknownId = value.rules.some(rule => rule.id && !knownRules.has(rule.id));
  if (unknownId) return NextResponse.json({ error: "Um horário foi alterado fora deste espaço. Atualize a página e tente novamente." }, { status: 409 });
  for (const rule of value.rules) {
    const row = { business_id: auth.businessId, weekday: rule.weekday, start_time: rule.start_time, end_time: rule.end_time };
    const result = rule.id
      ? await auth.supabase.from("availability_rules").update(row).eq("id", rule.id).eq("business_id", auth.businessId)
      : await auth.supabase.from("availability_rules").insert(row);
    if (result.error) return NextResponse.json({ error: "Dados salvos, mas houve um problema ao atualizar um horário de atendimento." }, { status: 500 });
  }
  const submittedIds = new Set(value.rules.map(rule => rule.id).filter(Boolean));
  const removedRules = (existingRules ?? []).map(rule => rule.id).filter(id => !submittedIds.has(id));
  if (removedRules.length) {
    const { error } = await auth.supabase.from("availability_rules").delete().eq("business_id", auth.businessId).in("id", removedRules);
    if (error) return NextResponse.json({ error: "Dados salvos, mas não foi possível remover os horários desativados." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
