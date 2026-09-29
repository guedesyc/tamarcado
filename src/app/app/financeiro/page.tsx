import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinanceDashboard } from "@/components/finance-dashboard";

export default async function FinancePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/app/onboarding");
  const [{ data: appointments }, { data: entries }, { data: business }] = await Promise.all([
    supabase.from("appointments").select("id,status,payment_status,signal_amount_cents,start_at,service_name_snapshot,price_estimate_cents,agreed_price_cents,final_price_cents,clients(name,phone)").eq("business_id", member.business_id).in("status", ["confirmed", "completed"]).order("start_at", { ascending: false }).limit(100),
    supabase.from("financial_entries").select("id,appointment_id,kind,status,amount_cents,note,method,occurred_at,appointments(service_name_snapshot,clients(name))").eq("business_id", member.business_id).order("occurred_at", { ascending: false }).limit(150),
    supabase.from("businesses").select("timezone").eq("id", member.business_id).maybeSingle(),
  ]);
  return <main className="wrap app-page-wrap"><span className="eyebrow">Controle do espaço</span><h1 className="serif app-page-title">Financeiro</h1><p className="app-page-description">Sinais, complementos e valores recebidos por atendimento.</p><FinanceDashboard appointments={(appointments ?? []) as never} entries={(entries ?? []) as never} timeZone={business?.timezone ?? "America/Sao_Paulo"}/></main>;
}
