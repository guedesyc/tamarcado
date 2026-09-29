"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock3, CalendarClock } from "lucide-react";
import { durationToMinutes } from "@/lib/duration";

type Props = { id: string; status: string; paymentStatus?: string; clientPhone?: string; serviceName?: string; requestedAt?: string };

function whatsappPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function AppointmentActions({ id, status, paymentStatus, clientPhone, serviceName, requestedAt }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState(false);

  async function update(next: string, changes: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/appointments/${id}/transition`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, changes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o atendimento.");
      setProposing(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar.");
    } finally { setBusy(false); }
  }

  async function signal(action: "request" | "verify") {
    setBusy(true);
    setError("");
    // Open synchronously to avoid a popup blocker after the network request.
    const popup = clientPhone ? window.open("about:blank", "_blank") : null;
    try {
      const response = await fetch(`/api/appointments/${id}/signal`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o sinal.");
      const trackingUrl = `${window.location.origin}/r/${result.tracking_token}`;
      let message: string;
      if (action === "request") {
        const deadline = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(result.signal_deadline));
        const amount = (Number(result.signal_amount_cents) / 100).toFixed(2).replace(".", ",");
        message = `Olá! Confirmei seu horário para ${serviceName ?? "seu atendimento"}. Para reservar, pague o sinal de R$ ${amount} via Pix (${result.pix_holder}): ${result.pix_key}. A vaga fica reservada por 1 hora, até ${deadline}. Acompanhe e avise sobre o pagamento neste link: ${trackingUrl}`;
      } else {
        const when = requestedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(requestedAt)) : "a data combinada";
        message = `Olá! Conferi seu Pix e confirmei seu atendimento de ${serviceName ?? "serviço"} para ${when}. Obrigada pela confiança. Tá Marcado! Acompanhe seu pedido por aqui: ${trackingUrl}`;
      }
      if (popup && clientPhone) popup.location.href = `https://wa.me/${whatsappPhone(clientPhone)}?text=${encodeURIComponent(message)}`;
      else popup?.close();
      router.refresh();
    } catch (reason) {
      popup?.close();
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o sinal.");
    } finally { setBusy(false); }
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const durationValue = String(values.get("duration") ?? "");
    const duration = durationValue ? durationToMinutes(durationValue) : null;
    if (durationValue && duration === null) { setError("Informe a duração entre 00:01 e 23:59."); return; }
    const price = String(values.get("price") ?? "");
    await update("proposed", {
      requested_date: values.get("date"), requested_time: values.get("time"),
      ...(duration !== null ? { duration_minutes: duration } : {}),
      ...(price ? { price_cents: Math.round(Number(price) * 100) } : {}),
    });
  }

  const pending = ["requested", "under_review", "proposed"].includes(status);
  return <div className="appointment-actions">
    {pending && <>
      <button className="pill" disabled={busy} onClick={() => signal("request")}><Check size={14}/> Confirmar e pedir sinal</button>
      <button className="pill" disabled={busy} onClick={() => update("cancelled_by_professional")}><X size={14}/> Recusar</button>
      <button className="pill" disabled={busy} onClick={() => setProposing(!proposing)}><CalendarClock size={14}/> Sugerir horário</button>
      {status === "requested" && <button className="pill" disabled={busy} onClick={() => update("under_review")}><Clock3 size={14}/> Analisar</button>}
    </>}
    {status === "confirmed" && paymentStatus === "signal_requested" && <>
      <span className="pill">Aguardando sinal · 1h</span>
      <button className="pill" disabled={busy} onClick={() => update("cancelled_by_professional")}><X size={14}/> Cancelar horário</button>
    </>}
    {status === "confirmed" && paymentStatus === "signal_reported" && <button className="pill" disabled={busy} onClick={() => signal("verify")}><Check size={14}/> Conferir sinal recebido</button>}
    {status === "confirmed" && (paymentStatus === "partial" || !paymentStatus) && <button className="pill" disabled={busy} onClick={() => update("completed")}>Concluir</button>}
    {proposing && <form onSubmit={propose} className="panel appointment-proposal">
      <div className="form-field"><label htmlFor={`proposal-date-${id}`}>Outro dia</label><input id={`proposal-date-${id}`} name="date" type="date" required/></div>
      <div className="form-field"><label htmlFor={`proposal-time-${id}`}>Horário</label><input id={`proposal-time-${id}`} name="time" type="time" required/></div>
      <div className="form-field"><label htmlFor={`proposal-duration-${id}`}>Duração (horas:minutos)</label><input id={`proposal-duration-${id}`} name="duration" type="time" step="60"/></div>
      <div className="form-field"><label htmlFor={`proposal-price-${id}`}>Valor (R$)</label><input id={`proposal-price-${id}`} name="price" type="number" min="0" step="0.01"/></div>
      <button className="btn" disabled={busy}>Enviar proposta</button>
    </form>}
    {error && <span className="form-error" role="alert">{error}</span>}
  </div>;
}
