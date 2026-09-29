"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock3, History } from "lucide-react";

type Answer = { question_label: string; answer: unknown; price_delta_cents: number; duration_delta_minutes: number };
type Appointment = { id: string; status: string; payment_status: string; signal_amount_cents: number | null; start_at: string; end_at: string; service_name_snapshot: string; price_estimate_cents: number | null; agreed_price_cents: number | null; final_price_cents: number | null; customer_note: string | null; appointment_answers: Answer[] };
type Client = { id: string; name: string; phone: string; created_at: string; appointments: Appointment[] };

const statusLabels: Record<string, string> = { requested: "Aguardando resposta", under_review: "Em análise", proposed: "Proposta enviada", confirmed: "Confirmado", completed: "Concluído", cancelled_by_client: "Cancelado pela cliente", cancelled_by_professional: "Cancelado pela profissional", expired: "Expirado" };
function answerText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(answerText).join(", ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(answerText).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}
const money = (cents: number | null) => cents == null ? "A combinar" : `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

function AppointmentHistory({ appointment, timeZone }: { appointment: Appointment; timeZone: string }) {
  const amount = appointment.final_price_cents ?? appointment.agreed_price_cents ?? appointment.price_estimate_cents;
  return <article className="client-history-card">
    <div className="client-history-top"><div><b>{appointment.service_name_snapshot}</b><small><Clock3 size={13}/> {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(appointment.start_at))}</small></div><span className={`status client-status client-status-${appointment.status}`}>{statusLabels[appointment.status] ?? appointment.status}</span></div>
    <p><b>Valor combinado:</b> {money(amount)}</p>
    {appointment.payment_status === "signal_requested" && <p className="client-payment client-payment-pending">Aguardando pagamento do sinal de {money(appointment.signal_amount_cents)}</p>}
    {appointment.payment_status === "signal_reported" && <p className="client-payment client-payment-pending">A cliente informou o pagamento do sinal; falta conferir.</p>}
    {appointment.payment_status === "partial" && <p className="client-payment">Sinal confirmado: {money(appointment.signal_amount_cents)} · o saldo restante aparece em Financeiro.</p>}
    {appointment.customer_note && <p><b>Observação da cliente:</b> {appointment.customer_note}</p>}
    {!!appointment.appointment_answers?.length && <div className="client-answer-list"><b>Respostas do formulário</b>{appointment.appointment_answers.map((answer, index) => <p key={`${appointment.id}-${index}`}><span>{answer.question_label}</span>{answerText(answer.answer)}{answer.price_delta_cents ? ` · ${money(answer.price_delta_cents)}` : ""}{answer.duration_delta_minutes ? ` · ${Math.floor(answer.duration_delta_minutes / 60)}h ${answer.duration_delta_minutes % 60}min` : ""}</p>)}</div>}
  </article>;
}

export function ClientDetails({ clients, timeZone }: { clients: Client[]; timeZone: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return <section className="panel client-list-panel"><p className="settings-intro">Clientes que solicitaram ou realizaram atendimento com você.</p>{clients.map(client => {
    const expanded = open === client.id;
    const appointments = [...(client.appointments ?? [])].sort((a, b) => b.start_at.localeCompare(a.start_at));
    return <article className="client-list-item" key={client.id}><div className="client-list-summary"><div className="client-name-group"><b>{client.name}</b><a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{client.phone}</a><button type="button" className="client-details-button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : client.id)}>{expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>} {expanded ? "Ocultar detalhes" : "Ver detalhes"}</button></div><span className="client-visit-count"><History size={14}/>{appointments.length} {appointments.length === 1 ? "solicitação" : "solicitações"}</span></div>{expanded && <div className="client-history-list">{appointments.length ? appointments.map(appointment => <AppointmentHistory key={appointment.id} appointment={appointment} timeZone={timeZone}/>) : <p className="calendar-empty">Ainda não há atendimentos registrados.</p>}</div>}</article>;
  })}</section>;
}
