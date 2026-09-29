"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock3, CalendarClock } from "lucide-react";
import { durationToMinutes } from "@/lib/duration";

type Props = { id: string; status: string; paymentStatus?: string; clientPhone?: string; clientName?: string; serviceName?: string; requestedAt?: string; endAt?: string; priceEstimateCents?: number | null; answers?: { question_label: string; answer: unknown; price_delta_cents: number; duration_delta_minutes: number }[] };

function whatsappPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function AppointmentActions({ id, status, paymentStatus, clientPhone, clientName, serviceName, requestedAt, endAt, priceEstimateCents, answers = [] }: Props) {
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
      if (typeof result.tracking_token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(result.tracking_token)) {
        throw new Error("O sinal foi atualizado, mas não recebemos um link de acompanhamento válido. Atualize a página antes de avisar a cliente.");
      }
      const trackingUrl = `${window.location.origin}/r/${result.tracking_token}`;
      let message: string;
      if (action === "request") {
        const deadline = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(result.signal_deadline));
        const amount = (Number(result.signal_amount_cents) / 100).toFixed(2).replace(".", ",");
        const when = requestedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(requestedAt)) : "data combinada";
        message = `Olá, ${clientName || "tudo bem"}!\n\nSeu atendimento de ${serviceName ?? "serviço"} está confirmado para ${when}.\n\nPIX DO SINAL\nValor: R$ ${amount}\nChave Pix: ${result.pix_key}\nTitular da chave: ${result.pix_holder}\nPrazo para pagamento: até ${deadline} (a vaga fica reservada por 1 hora).\n\nDepois de pagar, acesse o link abaixo e toque em “Já fiz o Pix” para me avisar. Vou conferir o recebimento no extrato.\n\nAcompanhe seu atendimento: ${trackingUrl}\n\nObrigada pela confiança!\nTá Marcado!`;
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
  const durationMinutes = requestedAt && endAt ? Math.max(0, Math.round((new Date(endAt).getTime() - new Date(requestedAt).getTime()) / 60000)) : 0;
  const answerText = (value: unknown): string => value == null || value === "" ? "—" : Array.isArray(value) ? value.map(answerText).join(", ") : typeof value === "object" ? Object.values(value as Record<string, unknown>).map(answerText).join(", ") : typeof value === "boolean" ? value ? "Sim" : "Não" : String(value);
  return <div className="appointment-actions">
    {(priceEstimateCents != null || answers.length > 0) && <details className="request-estimate-details"><summary>Ver respostas e valor calculado</summary><div><b>Estimativa do serviço com as opções: {priceEstimateCents == null ? "A combinar" : `R$ ${(priceEstimateCents / 100).toFixed(2).replace(".", ",")}`}</b>{durationMinutes > 0 && <small>Duração calculada: {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}min</small>}{answers.map((answer, index) => <p key={`${answer.question_label}-${index}`}><span>{answer.question_label}:</span> {answerText(answer.answer)}{answer.price_delta_cents ? ` · adicional ${answer.price_delta_cents > 0 ? "+" : "−"}R$ ${(Math.abs(answer.price_delta_cents) / 100).toFixed(2).replace(".", ",")}` : ""}{answer.duration_delta_minutes ? ` · ${answer.duration_delta_minutes > 0 ? "+" : "−"}${Math.floor(Math.abs(answer.duration_delta_minutes) / 60)}h ${Math.abs(answer.duration_delta_minutes) % 60}min` : ""}</p>)}</div></details>}
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
