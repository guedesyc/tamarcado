"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDollarSign, Clock3 } from "lucide-react";
import { calculateServiceBalance } from "@/lib/finance";

type Appointment = { id: string; status: string; payment_status: string; signal_amount_cents: number | null; start_at: string; service_name_snapshot: string; price_estimate_cents: number | null; agreed_price_cents: number | null; final_price_cents: number | null; clients: { name: string; phone: string } | { name: string; phone: string }[] | null };
type Entry = { id: string; kind: string; status: string; amount_cents: number; note: string | null; method: string | null; occurred_at: string; appointment_id: string | null; appointments: { service_name_snapshot: string; clients: { name: string } | { name: string }[] | null } | null };
const clientName = (value: { name: string } | { name: string }[] | null | undefined) => Array.isArray(value) ? value[0]?.name : value?.name;
const formatMoney = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const centsFromInput = (value: string) => { const normalized = value.trim().includes(",") ? value.trim().replace(/\./g, "").replace(",", ".") : value.trim(); const amount = Number(normalized); return Number.isFinite(amount) ? Math.round(amount * 100) : 0; };
const currencyInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function AppointmentPayment({ appointment, receivedCents, timeZone }: { appointment: Appointment; receivedCents: number; timeZone: string }) {
  const router = useRouter();
  const [totalText, setTotalText] = useState(currencyInput(appointment.final_price_cents ?? appointment.agreed_price_cents ?? appointment.price_estimate_cents ?? 0));
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState("pix");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [receivedOverride, setReceivedOverride] = useState<number | null>(null);
  const effectiveReceived = receivedOverride ?? receivedCents;
  const total = centsFromInput(totalText);
  const due = calculateServiceBalance(total, effectiveReceived).balanceCents;
  const disabled = !["confirmed", "completed"].includes(appointment.status) || ["signal_requested", "signal_reported"].includes(appointment.payment_status) || (total > 0 && due === 0);
  async function record() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/financial/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appointmentId: appointment.id, totalCents: total, receivedCents: centsFromInput(amountText), method }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar o recebimento.");
      setReceivedOverride(Number(result.received_cents));
      setAmountText(""); setMessage(`Recebimento salvo. Saldo restante: ${formatMoney(result.remaining_cents)}.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o recebimento."); }
    finally { setBusy(false); }
  }
  const state = appointment.payment_status === "signal_requested" ? "Aguardando a cliente pagar o sinal" : appointment.payment_status === "signal_reported" ? "A cliente avisou que pagou; confira em Solicitações" : total <= 0 ? "Informe o valor total combinado" : due === 0 ? "Total recebido" : effectiveReceived > 0 ? `Saldo do serviço: ${formatMoney(due)}` : `A receber: ${formatMoney(due)}`;
  return <article className="finance-service-card">
    <div className="finance-service-heading"><div><b>{clientName(appointment.clients) || "Cliente"}</b><small>{appointment.service_name_snapshot} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(appointment.start_at))}</small></div><span className={`finance-payment-state${due === 0 ? " is-paid" : ""}`}>{due === 0 && <Check size={13}/>} {state}</span></div>
    <div className="finance-amounts"><span>Valor do serviço <b>{formatMoney(total)}</b></span><span>Já recebido <b>{formatMoney(effectiveReceived)}</b></span><span>Falta receber <b>{formatMoney(due)}</b></span></div>
    {appointment.payment_status === "partial" && <p className="finance-signal-note">O sinal já está incluído em “Já recebido” e foi descontado do valor do serviço — não é somado ao total.</p>}
    {!disabled && <div className="finance-payment-form"><label>Valor total combinado<input inputMode="decimal" value={totalText} onChange={event => setTotalText(event.target.value)}/></label><label>Recebido agora<input inputMode="decimal" value={amountText} placeholder={currencyInput(due)} onChange={event => setAmountText(event.target.value)}/></label><label>Forma<select value={method} onChange={event => setMethod(event.target.value)}><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="transfer">Transferência</option><option value="other">Outra</option></select></label><button type="button" className="btn small" disabled={busy || !centsFromInput(amountText) || centsFromInput(amountText) > due || total <= 0} onClick={record}>{busy ? "Salvando…" : "Registrar recebimento"}</button></div>}
    {message && <p className={message.startsWith("Recebimento") ? "settings-success" : "form-error"} role="status">{message}</p>}
  </article>;
}

export function FinanceDashboard({ appointments, entries, timeZone }: { appointments: Appointment[]; entries: Entry[]; timeZone: string }) {
  const receivedByAppointment = useMemo(() => {
    const amounts = new Map<string, number>();
    for (const entry of entries) if (entry.kind === "income" && entry.status === "received" && entry.appointment_id) amounts.set(entry.appointment_id, (amounts.get(entry.appointment_id) ?? 0) + entry.amount_cents);
    return amounts;
  }, [entries]);
  const received = entries.filter(entry => entry.kind === "income" && entry.status === "received").reduce((sum, entry) => sum + entry.amount_cents, 0);
  const expenses = entries.filter(entry => entry.kind === "expense" && entry.status === "received").reduce((sum, entry) => sum + entry.amount_cents, 0);
  return <div className="finance-dashboard">
    <div className="finance-summary-grid"><article><span>Recebido</span><b>{formatMoney(received)}</b></article><article><span>Despesas pagas</span><b>{formatMoney(expenses)}</b></article><article><span>Saldo recebido</span><b>{formatMoney(received - expenses)}</b></article></div>
    <section className="panel"><div className="panel-title"><CircleDollarSign size={18}/> Valores dos atendimentos</div><p className="settings-intro">O sinal faz parte do preço total: o saldo é calculado como total do serviço menos todos os recebimentos já confirmados.</p>
      {appointments.length ? <div className="finance-service-list">{appointments.map(appointment => <AppointmentPayment key={`${appointment.id}:${receivedByAppointment.get(appointment.id) ?? 0}`} appointment={appointment} receivedCents={receivedByAppointment.get(appointment.id) ?? 0} timeZone={timeZone}/>)}</div> : <p className="calendar-empty"><Clock3 size={15}/> Nenhum atendimento confirmado para acertar.</p>}
    </section>
    <section className="panel"><div className="panel-title">Movimentações</div>{entries.length ? entries.map(entry => <article className="finance-entry-row" key={entry.id}><div><b>{clientName(entry.appointments?.clients ?? null) || (entry.kind === "expense" ? "Despesa" : "Recebimento")}</b><small>{entry.appointments?.service_name_snapshot ?? entry.note ?? (entry.kind === "expense" ? "Despesa" : "Receita")} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(entry.occurred_at))}</small></div><b className={entry.kind === "expense" ? "finance-negative" : "finance-positive"}>{entry.kind === "expense" ? "−" : "+"}{formatMoney(entry.amount_cents)}</b></article>) : <p className="calendar-empty">As entradas de sinal confirmado e outros recebimentos aparecerão aqui.</p>}</section>
  </div>;
}
