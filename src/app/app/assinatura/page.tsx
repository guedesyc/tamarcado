import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { stripeIsLiveMode } from "@/lib/stripe";
import { StartSubscription, CancelSubscription } from "@/components/subscription-actions";

const milestones = ["Sua página profissional", "Serviços e horários", "Solicitações e histórico", "Sem comissão sobre seus atendimentos", "Seus dados seguem acessíveis"];
const formatDate = (value: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(value);

export default async function SubscriptionPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/app/onboarding");

  const [{ data: trial }, { data: storedSubscription }] = await Promise.all([
    supabase.from("trial_usage").select("eligible_completed_count").eq("business_id", member.business_id).maybeSingle(),
    supabase.from("subscription_records").select("provider,status,current_period_end,cancel_at,provider_livemode").eq("business_id", member.business_id).maybeSingle(),
  ]);

  const subscription = storedSubscription?.provider === "stripe" && storedSubscription.provider_livemode === stripeIsLiveMode() ? storedSubscription : null;
  const used = trial?.eligible_completed_count ?? 0;
  const active = subscription?.status === "active";
  const cancelAt = subscription?.cancel_at ? new Date(subscription.cancel_at) : null;
  const scheduledCancellation = Boolean(active && cancelAt);
  const cancelled = subscription?.status === "cancelled";
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const planTitle = scheduledCancellation ? "Plano cancelado" : active ? "Plano ativo" : cancelled ? "Plano cancelado" : "Plano gratuito";
  const planCopy = scheduledCancellation
    ? `Seu cancelamento está programado. Você continua usando todos os recursos até ${formatDate(cancelAt!)}.`
    : active
      ? "Sua assinatura está ativa e seus recursos seguem liberados."
      : cancelled && periodEnd
        ? `Seu plano foi cancelado. O período final registrado termina em ${formatDate(periodEnd)}.`
        : cancelled
          ? "Seu plano foi cancelado. Quando quiser, você pode realizar uma nova assinatura."
          : "Use seus 5 atendimentos públicos gratuitos antes de decidir continuar no plano mensal.";

  return <main className="wrap" style={{ maxWidth: 950, paddingTop: 35, paddingBottom: 90 }}>
    <span className="eyebrow">Seu plano</span>
    <h1 className="serif" style={{ fontSize: 46 }}>Continue no seu ritmo.</h1>
    <p className="section-copy">Um plano só, sem comissão e sem perder acesso aos seus dados.</p>
    <section className="price-card" style={{ alignItems: "flex-start", marginTop: 35 }}>
      <div>
        <span className="pill"><Sparkles size={13} /> {planTitle}</span>
        <div className="price-big" style={{ marginTop: 15 }}>R$ 49,99 <small>/ mês</small></div>
        <p>{planCopy}</p>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 25 }}>{milestones.map(item => <li key={item} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center" }}><Check size={16} color="var(--green2)" />{item}</li>)}</ul>
        {active && periodEnd && <p style={{ fontSize: 12 }}>Período atual até {formatDate(periodEnd)}.</p>}
        <CancelSubscription active={active} scheduledCancellation={scheduledCancellation} />
      </div>
      <div style={{ minWidth: 230 }}>
        {active ? <section className="trial-box"><div className="trial-top"><span>Atendimentos</span><span>Ilimitados</span></div><p>Sua assinatura ativa libera atendimentos públicos ilimitados. Registros manuais também seguem disponíveis.</p></section> : <section className="trial-box"><div className="trial-top"><span>Atendimentos gratuitos</span><span>{Math.min(used, 5)} de 5</span></div><div className="progress"><span style={{ width: `${Math.min(100, used * 20)}%` }} /></div><p>Atendimentos públicos concluídos. Registros manuais não entram na contagem.</p></section>}
        <div style={{ marginTop: 20 }}>{scheduledCancellation ? <span className="pill">Acesso até {formatDate(cancelAt!)}</span> : active ? <span className="pill">Assinatura ativa</span> : <StartSubscription />}</div>
      </div>
    </section>
    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 20 }}>O checkout e o gerenciamento de faturas são hospedados com segurança pelo Stripe. Os dados de cartão não passam pelo Tá Marcado.</p>
  </main>;
}
