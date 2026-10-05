import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Appointment = { id: string; business_name: string; business_slug: string; business_timezone: string; service_name: string; start_at: string; end_at: string; status: string; payment_status: string; price_estimate_cents: number | null; agreed_price_cents: number | null; signal_amount_cents: number | null; signal_deadline: string | null; customer_note: string | null; proposal_reason: string | null };
const statusLabels: Record<string, string> = { requested: "Aguardando resposta", under_review: "Em análise", proposed: "Nova proposta da profissional", confirmed: "Confirmado", completed: "Concluído", cancelled_by_client: "Cancelado por você", cancelled_by_professional: "Cancelado pela profissional", expired: "Expirado", no_show: "Não compareceu" };

const paymentLabels: Record<string, string> = { unpaid: "Ainda não pago", signal_requested: "Sinal solicitado", signal_reported: "Pagamento informado", signal_expired: "Prazo do sinal encerrado", partial: "Sinal confirmado", paid: "Pago", refunded: "Reembolsado", not_applicable: "Não aplicável" };

export default async function CustomerAppointment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user || !supabase) redirect("/minha-agenda");
  const { data, error } = await supabase.rpc("get_my_customer_appointments");
  if (error) notFound();
  const item = (data as Appointment[] | null)?.find(row => row.id === id);
  if (!item) notFound();
  const formatMoney = (cents: number | null) => cents === null ? "A combinar" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  return <main className="customer-agenda"><div className="customer-detail"><Link className="customer-back" href="/minha-agenda">← Minha agenda</Link><span className="eyebrow">{item.business_name}</span><h1>{item.service_name}</h1><div className="customer-detail-grid"><section><h2>Atendimento</h2><dl><dt>Situação</dt><dd>{statusLabels[item.status] ?? "Em atualização"}</dd><dt>Data e horário</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: item.business_timezone || "America/Sao_Paulo" }).format(new Date(item.start_at))}</dd><dt>Duração</dt><dd>{Math.max(0,Math.round((new Date(item.end_at).getTime()-new Date(item.start_at).getTime())/60000))} min</dd><dt>Valor</dt><dd>{formatMoney(item.agreed_price_cents ?? item.price_estimate_cents)}</dd>{item.signal_amount_cents !== null && <><dt>Sinal</dt><dd>{formatMoney(item.signal_amount_cents)}</dd><dt>Pagamento</dt><dd>{paymentLabels[item.payment_status] ?? "Em atualização"}</dd>{item.signal_deadline && <><dt>Prazo do sinal</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: item.business_timezone || "America/Sao_Paulo" }).format(new Date(item.signal_deadline))}</dd></>}</>}</dl></section>{(item.customer_note || item.proposal_reason) && <section><h2>Mensagens</h2>{item.customer_note && <p><strong>Sua observação:</strong> {item.customer_note}</p>}{item.proposal_reason && <p><strong>Proposta da profissional:</strong> {item.proposal_reason}</p>}</section>}</div><p>Para responder a uma proposta, informar o sinal ou cancelar, use o link de acompanhamento recebido ao solicitar o atendimento.</p><Link className="btn secondary" href={`/${item.business_slug}`}>Ver página da profissional</Link></div></main>;
}
