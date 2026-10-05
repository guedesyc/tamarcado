import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CustomerAccess } from "@/components/customer-access";
import { CustomerProfileForm } from "@/components/customer-profile-form";
import { CUSTOMER_CLAIM_COOKIE } from "@/lib/customer-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Appointment = {
  id: string; business_name: string; business_slug: string; business_timezone: string; service_name: string;
  start_at: string; end_at: string; status: string; payment_status: string;
  price_estimate_cents: number | null; agreed_price_cents: number | null;
  signal_amount_cents: number | null; signal_deadline: string | null; customer_note: string | null;
  proposal_reason: string | null; created_at: string; is_past: boolean;
};
const statusLabels: Record<string, string> = {
  requested: "Aguardando resposta", under_review: "Em análise", proposed: "Nova proposta",
  confirmed: "Confirmado", completed: "Concluído", cancelled_by_client: "Cancelado por você",
  cancelled_by_professional: "Cancelado pela profissional", expired: "Expirado", no_show: "Não compareceu"
};
const ended = new Set(["completed", "cancelled_by_client", "cancelled_by_professional", "expired", "no_show"]);
function money(cents: number | null) {
  return cents === null ? "A combinar" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function BookingCards({ rows }: { rows: Appointment[] }) {
  return <div className="customer-booking-list">{rows.map(item => <article className="customer-booking-card" key={item.id}>
    <div>
      <span className="eyebrow">{item.business_name}</span>
      <h3>{item.service_name}</h3>
      <p><CalendarDays size={15}/> {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: item.business_timezone || "America/Sao_Paulo" }).format(new Date(item.start_at))}</p>
      <span className={`customer-status status-${item.status}`}>{item.payment_status === "signal_requested" ? "Aguardando sinal" : item.payment_status === "signal_reported" ? "Pagamento informado" : statusLabels[item.status] ?? "Em atualização"}</span>
    </div>
    <div className="customer-booking-meta"><span>{money(item.agreed_price_cents ?? item.price_estimate_cents)}</span><Link href={`/minha-agenda/${item.id}`}>Ver detalhes <ChevronRight size={16}/></Link></div>
  </article>)}</div>;
}

export default async function CustomerAgenda() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (user && (await cookies()).has(CUSTOMER_CLAIM_COOKIE)) redirect("/api/customer/finish");
  const [{ data: profile }, { data: records, error }] = user && supabase ? await Promise.all([
    supabase.from("customer_profiles").select("name,phone").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("get_my_customer_appointments")
  ]) : [{ data: null }, { data: null, error: null }];
  const appointments = (records ?? []) as Appointment[];
  const upcoming = appointments.filter(item => !ended.has(item.status) && (!item.is_past || ["requested", "under_review", "proposed"].includes(item.status)));
  const history = appointments.filter(item => !upcoming.includes(item));
  const showPhonePrompt = user && !error && !profile?.phone;

  return <main className="customer-agenda">
    <header className="customer-agenda-header"><Link href="/"><BrandLogo/></Link><nav><Link href="/">Início</Link>{user && <><Link href="#meus-dados">Meu perfil</Link><form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={15}/> Sair</button></form></>}</nav></header>
    <div className="customer-agenda-content">
      <span className="eyebrow">Tá Marcado para você</span>
      <h1>Minha agenda</h1>
      <p className="customer-agenda-intro">Seus pedidos e atendimentos com diferentes profissionais, no mesmo lugar.</p>
      {!user ? <><CustomerAccess/><p className="customer-guest-note">Você também pode continuar agendando sem conta. Seu link de acompanhamento continua funcionando.</p></> : <>
        {showPhonePrompt && <section className="customer-agenda-section customer-profile customer-first-login" id="meus-dados"><span className="eyebrow">Só falta uma coisa 👋</span><h2>Qual número você usa no WhatsApp?</h2><p>Salve seus dados para agilizar próximos pedidos. Seu telefone não associa históricos antigos automaticamente.</p><CustomerProfileForm name={profile?.name ?? user.user_metadata?.full_name ?? ""} phone="" requirePhone/></section>}
        {error ? <section className="customer-empty"><h2>Estamos preparando sua agenda</h2><p>O acesso à conta ainda precisa ser ativado. Seus pedidos continuam disponíveis pelos links de acompanhamento.</p></section> : <>
          <section className="customer-agenda-section"><h2>Próximos e em andamento</h2>{upcoming.length ? <BookingCards rows={upcoming}/> : <div className="customer-empty"><CalendarDays size={24}/><p>Nenhum atendimento em andamento por aqui.</p><small>Pedidos feitos antes da conta aparecem quando você abre o link de acompanhamento e escolhe “Adicionar à minha agenda”.</small></div>}</section>
          <section className="customer-agenda-section"><h2>Histórico</h2>{history.length ? <BookingCards rows={history}/> : <div className="customer-empty"><p>Seu histórico aparecerá aqui.</p></div>}</section>
        </>}
        {!showPhonePrompt && !error && <section className="customer-agenda-section customer-profile" id="meus-dados"><h2>Meus dados</h2><p>Seu e-mail de acesso: <strong>{user.email ?? "—"}</strong>. O WhatsApp salvo não vincula atendimentos antigos automaticamente.</p><CustomerProfileForm name={profile?.name ?? ""} phone={profile?.phone ?? ""}/></section>}
      </>}
    </div>
  </main>;
}
