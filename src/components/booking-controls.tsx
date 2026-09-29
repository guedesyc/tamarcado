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

  async function act(action: Action) {
    setBusy(true);
    setMessage("");
    setSuccess("");
    const popup = action === "report_signal" && professionalPhone ? window.open("about:blank", "_blank") : null;
    try {
      const response = await fetch(`/api/booking/${token}/action`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, date: action === "request_another_time" ? date : undefined, time: action === "request_another_time" ? time : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o atendimento.");
      if (action === "report_signal" && professionalPhone && popup) {
        const digits = professionalPhone.replace(/\D/g, "");
        const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
        const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(requestedAt));
        const text = `Olá! Avisei pelo link que fiz o Pix do sinal do meu atendimento de ${service}, marcado para ${when}. Pode conferir, por favor? Link para acompanhar o pedido: ${window.location.href}`;
        popup.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      } else popup?.close();
      if (action === "accept") setSuccess("Proposta aceita. A profissional ainda precisa solicitar o sinal; o horário não está confirmado neste momento.");
      else if (action === "report_signal") setSuccess("Aviso de pagamento registrado. Aguarde a conferência do Pix pela profissional.");
      router.refresh();
    } catch (reason) {
      popup?.close();
      setMessage(reason instanceof Error ? reason.message : "Não foi possível atualizar o atendimento.");
    } finally { setBusy(false); }
  }

  const canCancel = ["requested", "under_review", "proposed", "confirmed"].includes(status) && paymentStatus !== "signal_reported";
  return <div className="booking-controls">
    {paymentStatus === "signal_requested" && <div className="trial-box">
      <b>O horário está reservado por 1 hora</b>
      <p>Faça o Pix e avise por este link antes do prazo: {signalDeadline ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(signalDeadline)) : "1 hora após a aprovação"}.</p>
      <button className="btn" style={{ width: "100%" }} disabled={busy || !signalDeadline} onClick={() => act("report_signal")}><Check size={15}/> Já fiz o Pix</button>
    </div>}
    {paymentStatus === "signal_reported" && <p className="trial-box">Aviso de pagamento enviado. A profissional ainda precisa conferir o Pix para confirmar o atendimento.</p>}
    {paymentStatus === "signal_expired" && <p className="trial-box">O prazo de pagamento terminou e o horário foi liberado. Entre em contato com a profissional para solicitar outro horário.</p>}
    {paymentStatus === "partial" && <p className="trial-box">Sinal conferido pela profissional. Seu atendimento está confirmado!</p>}
    {status === "proposed" && <>
      <p>A profissional sugeriu este horário. Ao aceitar, ela ainda enviará as instruções do sinal para reservar a vaga.</p>
      <button className="btn" style={{ width: "100%" }} disabled={busy} onClick={() => act("accept")}><Check size={15}/> Aceitar proposta</button>
      <button className="btn secondary" style={{ width: "100%", marginTop: 9 }} disabled={busy} onClick={() => setChoosing(!choosing)}><CalendarClock size={15}/> Escolher outro horário</button>
      {choosing && <div className="trial-box" style={{ marginTop: 12 }}>
        <div className="form-field"><label htmlFor="alternate-date">Outro dia</label><input id="alternate-date" type="date" value={date} onChange={event => loadSlots(event.target.value)}/></div>
        <div className="form-field"><label htmlFor="alternate-time">Horário disponível</label><select id="alternate-time" value={time} onChange={event => setTime(event.target.value)}><option value="">Selecione</option>{slots.map(slot => <option key={slot} value={slot}>{slot}</option>)}</select></div>
        <button className="btn" disabled={busy || !time} onClick={() => act("request_another_time")}>Pedir este horário</button>
      </div>}
    </>}
    {canCancel && <button className="btn secondary" style={{ width: "100%", marginTop: 9 }} disabled={busy} onClick={() => act("cancel")}><X size={15}/> Cancelar solicitação</button>}
    {message && <p className="form-error" role="alert">{message}</p>}
    {success && <p className="trial-box" role="status">{success}</p>}
  </div>;
}
