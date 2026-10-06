"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CalendarClock } from "lucide-react";

type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded" | "not_applicable" | "signal_requested" | "signal_reported" | "signal_expired";
type Action = "accept" | "cancel" | "request_another_time" | "report_signal";
type Props = {
  token: string; status: string; paymentStatus: PaymentStatus; service: string;
  professionalPhone: string; requestedAt: string; signalDeadline: string | null; timeZone: string;
};

export function BookingControls({ token, status, paymentStatus, service, professionalPhone, requestedAt, signalDeadline, timeZone }: Props) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function loadSlots(value: string) {
    setDate(value);
    setTime("");
    setMessage("");
    setSlots([]);
    if (!value) return;
    try {
      const response = await fetch(`/api/booking/${token}/availability?date=${encodeURIComponent(value)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error("Não foi possível consultar horários.");
      setSlots(result.slots ?? []);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível consultar horários.");
    }
  }

  async function act(action: Action, reason?: string) {
    setBusy(true);
    setMessage("");
    setSuccess("");
    const popup = (action === "report_signal" || action === "cancel") && professionalPhone ? window.open("about:blank", "_blank") : null;
    try {
      const response = await fetch(`/api/booking/${token}/action`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, date: action === "request_another_time" ? date : undefined, time: action === "request_another_time" ? time : undefined, reason: action === "cancel" ? reason : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o atendimento.");
      if (action === "report_signal" && professionalPhone && popup) {
        const digits = professionalPhone.replace(/\D/g, "");
        const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
        const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(requestedAt));
        const text = `Olá! Avisei pelo link que fiz o Pix do sinal do meu atendimento de ${service}, marcado para ${when}. Pode conferir, por favor? Link para acompanhar o pedido: ${window.location.href}`;
        popup.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      } else if (action === "cancel") {
        const cancellation = result.cancellation as { professional_phone?: string; business_name?: string; client_name?: string; service_name?: string; requested_at?: string; signal_amount_cents?: number | null; refund_eligible?: boolean; refund_policy?: string; refund_hours?: number } | undefined;
        const phoneDigits = (cancellation?.professional_phone || professionalPhone).replace(/\D/g, "");
        const phone = phoneDigits.length === 10 || phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits;
        const when = cancellation?.requested_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(cancellation.requested_at)) : "data combinada";
        const signal = cancellation?.signal_amount_cents ? `R$ ${(cancellation.signal_amount_cents / 100).toFixed(2).replace(".", ",")}` : "não houve sinal pago";
        const policy = cancellation?.refund_policy === "before_hours" ? `A regra cadastrada permite conversar sobre devolução se o cancelamento ocorrer com pelo menos ${cancellation.refund_hours} horas de antecedência.` : "A regra cadastrada informa que não há reembolso do sinal, independentemente do prazo.";
        const decision = cancellation?.refund_eligible ? "Pelo prazo, o pedido está dentro dos critérios cadastrados para avaliar a devolução." : "Pelo prazo/regra cadastrada, o pedido não atende ao critério de devolução automática.";
        const text = `Olá! Sou ${cancellation?.client_name || "sua cliente"} e preciso cancelar meu atendimento.\n\nServiço: ${cancellation?.service_name || service}\nData e horário: ${when}\nMotivo: ${reason?.trim() || "Não informado"}\nSinal informado: ${signal}\n\nPolítica do espaço (${cancellation?.business_name || "negócio"}): ${policy}\n${decision}\n\nQuero conversar com você para combinarmos a questão do sinal. A devolução não é feita automaticamente pelo sistema.\n\nLink do pedido: ${window.location.href}`;
        if (phone && popup) popup.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        else popup?.close();
        setCanceling(false);
        setSuccess("Cancelamento registrado. Converse com a profissional pelo WhatsApp para tratar do sinal.");
      } else popup?.close();
      if (action === "accept") setSuccess("Proposta aceita. A profissional ainda precisa solicitar o sinal; o horário não está confirmado neste momento.");
      else if (action === "report_signal") setSuccess("Aviso de pagamento registrado. Aguarde a conferência do Pix pela profissional.");
      router.refresh();
    } catch (reason) {
      popup?.close();
      setMessage(reason instanceof Error ? reason.message : "Não foi possível atualizar o atendimento.");
    } finally { setBusy(false); }
  }

  const canCancel = ["requested", "under_review", "proposed", "confirmed"].includes(status);
  return <div className="booking-controls">
    {paymentStatus === "signal_requested" && <div className="trial-box booking-signal-action">
      <b>O horário está reservado por 1 hora</b>
      <p>Faça o Pix e avise por este link antes do prazo: {signalDeadline ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(signalDeadline)) : "1 hora após a aprovação"}.</p>
      <button className="btn" style={{ width: "100%" }} disabled={busy || !signalDeadline} onClick={() => act("report_signal")}><Check size={15}/> Já fiz o Pix</button>
    </div>}
    {paymentStatus === "signal_reported" && <p className="trial-box">Aviso de pagamento enviado. A profissional ainda precisa conferir o Pix para confirmar o atendimento.</p>}
    {paymentStatus === "signal_expired" && <p className="trial-box">O prazo de pagamento terminou e o horário foi liberado. Entre em contato com a profissional para solicitar outro horário.</p>}
    {paymentStatus === "partial" && <p className="trial-box">Sinal conferido pela profissional. Seu atendimento está confirmado!</p>}
    {status === "proposed" && <section className="booking-proposal-actions">
      <div className="booking-action-stack"><button className="btn" disabled={busy} onClick={() => act("accept")}><Check size={15}/> Aceitar proposta</button>
      <button className="btn secondary" disabled={busy} onClick={() => setChoosing(!choosing)}><CalendarClock size={15}/> {choosing ? "Fechar opções" : "Escolher outro horário"}</button></div>
      {choosing && <div className="trial-box booking-alternate-time">
        <div className="form-field"><label htmlFor="alternate-date">Outro dia</label><input id="alternate-date" type="date" value={date} onChange={event => loadSlots(event.target.value)}/></div>
        <div className="form-field"><label htmlFor="alternate-time">Horário disponível</label><select id="alternate-time" value={time} onChange={event => setTime(event.target.value)}><option value="">Selecione</option>{slots.map(slot => <option key={slot} value={slot}>{slot}</option>)}</select></div>
        <button className="btn" disabled={busy || !time} onClick={() => act("request_another_time")}>Pedir este horário</button>
      </div>}
    </section>}
    {canCancel && !canceling && <button className="booking-cancel-trigger" type="button" disabled={busy} onClick={() => { setCancelReason(""); setCanceling(true); }}><X size={15}/> Cancelar solicitação</button>}
    {canceling && <section className="trial-box booking-cancel-card"><div className="form-field"><label htmlFor="booking-cancel-reason">Por que você precisa cancelar?</label><textarea id="booking-cancel-reason" rows={4} maxLength={500} minLength={3} required value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Conte brevemente o motivo. Essa informação será enviada à profissional pelo WhatsApp."/></div><div className="booking-action-stack"><button className="btn" disabled={busy || cancelReason.trim().length < 3} onClick={() => act("cancel", cancelReason)}>{busy ? "Cancelando…" : "Confirmar cancelamento"}</button><button type="button" className="btn secondary" disabled={busy} onClick={() => setCanceling(false)}>Voltar</button></div></section>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {success && <p className="trial-box" role="status">{success}</p>}
  </div>;
}
