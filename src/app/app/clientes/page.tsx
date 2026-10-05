import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientDetails } from "@/components/client-details";
import { BackButton } from "@/components/workspace-navigation";

export default async function ClientsPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/app/onboarding");
  const [{ data: clients, error: clientsError }, { data: appointments, error: appointmentsError }, { data: business }] = await Promise.all([
    supabase.from("clients").select("id,name,phone,created_at").eq("business_id", member.business_id).order("name").limit(500),
    supabase.from("appointments").select("id,client_id,status,payment_status,signal_amount_cents,start_at,end_at,service_name_snapshot,client_name_snapshot,price_estimate_cents,agreed_price_cents,final_price_cents,customer_note").eq("business_id", member.business_id).order("start_at", { ascending: false }).limit(1000),
    supabase.from("businesses").select("timezone").eq("id", member.business_id).maybeSingle(),
  ]);
  if (clientsError || appointmentsError) {
    console.error("[clients-page] Failed to load client history", { clientsError, appointmentsError, businessId: member.business_id });
  }
  const appointmentIds = (appointments ?? []).map(appointment => appointment.id);
  const { data: answers, error: answersError } = appointmentIds.length
    ? await supabase.from("appointment_answers").select("appointment_id,question_label,answer,price_delta_cents,duration_delta_minutes").eq("business_id", member.business_id).in("appointment_id", appointmentIds)
    : { data: [], error: null };
  if (answersError) console.error("[clients-page] Failed to load appointment answers", { answersError, businessId: member.business_id });
  const answersByAppointment = new Map<string, typeof answers>();
  for (const answer of answers ?? []) answersByAppointment.set(answer.appointment_id, [...(answersByAppointment.get(answer.appointment_id) ?? []), answer]);
  const appointmentsByClient = new Map<string, Array<NonNullable<typeof appointments>[number] & { appointment_answers: NonNullable<typeof answers> }>>();
  for (const appointment of appointments ?? []) {
    const history = appointmentsByClient.get(appointment.client_id) ?? [];
    history.push({ ...appointment, appointment_answers: answersByAppointment.get(appointment.id) ?? [] });
    appointmentsByClient.set(appointment.client_id, history);
  }
  const clientsWithHistory = (clients ?? []).map(client => ({ ...client, appointments: appointmentsByClient.get(client.id) ?? [] }));
  return <main className="wrap app-page-wrap"><div className="app-page-back"><BackButton/></div><span className="eyebrow">Relacionamento</span><h1 className="serif app-page-title">Clientes</h1><p className="app-page-description">Nome, contato e histórico do que cada pessoa solicitou ou realizou.</p>
    {clientsError || appointmentsError ? <section className="panel service-empty"><h2>Não foi possível carregar seus clientes</h2><p>Atualize a página. Se o problema continuar, verifique se sua conta ainda tem acesso ao espaço profissional.</p></section> : clientsWithHistory.length ? <ClientDetails clients={clientsWithHistory as never} timeZone={business?.timezone ?? "America/Sao_Paulo"}/> : <section className="panel service-empty"><h2>Sua lista começa com o primeiro atendimento</h2><p>Assim que alguém fizer uma solicitação, o contato e o histórico aparecerão aqui.</p></section>}
  </main>;
}
