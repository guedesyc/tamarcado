import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientDetails } from "@/components/client-details";

export default async function ClientsPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/app/onboarding");
  const [{ data: clients }, { data: business }] = await Promise.all([
    supabase.from("clients").select("id,name,phone,created_at,appointments(id,status,payment_status,signal_amount_cents,start_at,end_at,service_name_snapshot,price_estimate_cents,agreed_price_cents,final_price_cents,customer_note,appointment_answers(question_label,answer,price_delta_cents,duration_delta_minutes))").eq("business_id", member.business_id).order("name").limit(100),
    supabase.from("businesses").select("timezone").eq("id", member.business_id).maybeSingle(),
  ]);
  return <main className="wrap app-page-wrap"><span className="eyebrow">Relacionamento</span><h1 className="serif app-page-title">Clientes</h1><p className="app-page-description">Nome, contato e histórico do que cada pessoa solicitou ou realizou.</p>
    {clients?.length ? <ClientDetails clients={clients as never} timeZone={business?.timezone ?? "America/Sao_Paulo"}/> : <section className="panel service-empty"><h2>Sua lista começa com o primeiro atendimento</h2><p>Assim que alguém fizer uma solicitação, o contato e o histórico aparecerão aqui.</p></section>}
  </main>;
}
