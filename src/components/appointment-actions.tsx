"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock3, CalendarClock } from "lucide-react";
import { durationToMinutes } from "@/lib/duration";

type Props = {
  id: string;
  status: string;
  paymentStatus?: string;
  signalEnabled?: boolean;
  clientPhone?: string;
  clientName?: string;
  serviceName?: string;
  requestedAt?: string;
  endAt?: string;
  timeZone?: string;
  priceEstimateCents?: number | null;
  answers?: { question_label: string; answer: unknown; price_delta_cents: number; duration_delta_minutes: number }[];
};

function whatsappPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function AppointmentActions({ id, status, paymentStatus, signalEnabled = true, clientPhone, clientName, serviceName, requestedAt, endAt, timeZone = "America/Sao_Paulo", priceEstimateCents, answers = [] }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const initial = window.setTimeout(() => setClock(Date.now()), 0);
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);

  async function update(next: string, changes: Record<string, unknown> = {}, popup?: Window | null, whatsappMessage?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/appointments/${id}/transition`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, changes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o atendimento.");
      if (popup && clientPhone && whatsappMessage) popup.location.href = `https://wa.me/${whatsappPhone(clientPhone)}?text=${encodeURIComponent(whatsappMessage)}`;
      setProposing(false);
      setRejecting(false);
      router.refresh();
    } catch (reason) {
      popup?.close();
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar.");
    } finally { setBusy(false); }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!clientPhone || whatsappPhone(clientPhone).length < 12) { setError("Esta solicitação não tem um WhatsApp válido para avisar a cliente."); return; }
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    const popup = window.open("about:blank", "_blank");
    if (!popup) { setError("O navegador bloqueou a janela do WhatsApp. Permita pop-ups e tente novamente."); return; }
    const when = requestedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(requestedAt)) : "a data solicitada";
    const message = [`Olá, ${clientName || "tudo bem"}.`, `Sobre sua solicitação de ${serviceName ?? "atendimento"} para ${when}: não será possível confirmar esse horário.`, ...(reason ? ["", `Justificativa: ${reason}`] : []), "", "Por favor, me chame por aqui para conversarmos sobre outra possibilidade."].join("\n");
    await update("cancelled_by_professional", { rejection_reason: reason }, popup, message);
  }

  async function signal(action: "request" | "verify" | "confirm" | "not_received") {
    setBusy(true);
    setError("");
    if (action === "not_received" && (!clientPhone || whatsappPhone(clientPhone).length < 12)) { setError("Esta solicitação não tem um WhatsApp válido para avisar a cliente."); setBusy(false); return; }
    const popup = clientPhone ? window.open("about:blank", "_blank") : null;
    if (action === "not_received" && !popup) { setError("O navegador bloqueou a janela do WhatsApp. Permita pop-ups e tente novamente."); setBusy(false); return; }
    try {
      const response = await fetch(`/api/appointments/${id}/signal`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o atendimento.");
      if (typeof result.tracking_token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(result.tracking_token)) {
        throw new Error("O atendimento foi atualizado, mas não recebemos um link de acompanhamento válido. Atualize a página antes de avisar a cliente.");
      }
      const trackingUrl = `${window.location.origin}/r/${result.tracking_token}`;
      const when = requestedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(requestedAt)) : "data combinada";
      let message: string;
      if (action === "request") {
        const deadline = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(result.signal_deadline));
        const amount = (Number(result.signal_amount_cents) / 100).toFixed(2).replace(".", ",");
        message = `Olá, ${clientName || "tudo bem"}!\n\nSeu atendimento de ${serviceName ?? "serviço"} está confirmado para ${when}.\n\nPIX DO SINAL\nValor: R$ ${amount}\nChave Pix: ${result.pix_key}\nTitular da chave: ${result.pix_holder}\nPrazo para pagamento: até ${deadline} (a vaga fica reservada por 1 hora).\n\nDepois de pagar, acesse o link abaixo e toque em “Já fiz o Pix” para me avisar. Vou conferir o recebimento no extrato.\n\nAcompanhe seu atendimento: ${trackingUrl}\n\nObrigada pela confiança!\nTá Marcado!`;
      } else if (action === "confirm") {
        message = `Olá, ${clientName || "tudo bem"}!\n\nSeu atendimento de ${serviceName ?? "serviço"} está confirmado para ${when}.\n\nObrigada pela confiança.\nTá Marcado!\n\nAcompanhe seu atendimento: ${trackingUrl}`;
      } else if (action === "not_received") {
        const deadline = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(String(result.signal_deadline)));
        const amount = (Number(result.signal_amount_cents) / 100).toFixed(2).replace(".", ",");
        message = `Olá, ${clientName || "tudo bem"}!\n\nA profissional ainda não identificou o recebimento do sinal do seu atendimento de ${serviceName ?? "serviço"}, marcado para ${when}. Se você já pagou, confira o comprovante e converse com ela por este WhatsApp.\n\nPIX DO SINAL\nValor: R$ ${amount}\nChave Pix: ${result.pix_key}\nTitular: ${result.pix_holder}\nPrazo renovado para pagamento/regularização: ${deadline}.\n\nAcesse o acompanhamento para conferir o status e avisar novamente após resolver: ${trackingUrl}`;
      } else {
        message = `Olá! Conferi seu Pix e confirmei seu atendimento de ${serviceName ?? "serviço"} para ${when}. Obrigada pela confiança. Tá Marcado! Acompanhe seu pedido por aqui: ${trackingUrl}`;
      }
      if (popup && clientPhone) popup.location.href = `https://wa.me/${whatsappPhone(clientPhone)}?text=${encodeURIComponent(message)}`;
      else popup?.close();
      router.refresh();
    } catch (reason) {
      popup?.close();
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o atendimento.");
    } finally { setBusy(false); }
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    const date = String(values.get("date") ?? "");
    const time = String(values.get("time") ?? "");
    const durationValue = String(values.get("duration") ?? "");
    const duration = durationValue ? durationToMinutes(durationValue) : null;
    if (durationValue && duration === null) { setError("Informe a duração entre 00:01 e 23:59."); return; }
    const price = String(values.get("price") ?? "").trim();
    const reason = String(values.get("reason") ?? "").trim();
    if (!clientPhone || whatsappPhone(clientPhone).length < 12) { setError("Esta solicitação não tem um WhatsApp válido para receber a proposta."); return; }
    if (!date && !time && duration === null && !price) {
      setError("Preencha pelo menos uma informação que deseja alterar.");
      return;
    }
    const original = requestedAt ? new Date(requestedAt) : new Date();
    const originalDate = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(original);
    const originalTime = requestedAt ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(original) : "";
    const dateChanged = Boolean(date && date !== originalDate);
    const timeChanged = Boolean(time && time !== originalTime);
    const proposedPriceCents = price ? Math.round(Number(price) * 100) : null;
    const priceChanged = proposedPriceCents !== null && (priceEstimateCents == null || proposedPriceCents !== priceEstimateCents);
    const durationChanged = duration !== null && duration !== durationMinutes;
    if (!dateChanged && !timeChanged && !priceChanged && !durationChanged) {
      setError("Nenhuma alteração foi identificada. Informe um valor diferente do atendimento atual.");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    if (!popup) { setError("O navegador bloqueou a janela do WhatsApp. Permita pop-ups e tente novamente."); return; }
    const proposedDate = dateChanged ? date : originalDate;
    const [year, month, day] = proposedDate.split("-").map(Number);
    const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
    const durationLabel = duration === null ? "" : `${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`;
    const priceLabel = price ? `R$ ${Number(price).toFixed(2).replace(".", ",")}` : "";
    const requestedDateLabel = requestedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(original) : "uma data combinada";
    const requestedTimeLabel = requestedAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(original) : "";
    const proposalItems = [
      ...(dateChanged ? [`• Novo dia: ${dateLabel}`] : []),
      ...(timeChanged ? [`• Horário: ${time}`] : []),
      ...(priceChanged ? [`• Valor: ${priceLabel}`] : []),
      ...(durationChanged ? [`• Duração: ${durationLabel}`] : []),
    ];
    const whatsappMessage = [
      `Olá, ${clientName || "tudo bem"}!`,
      `Você solicitou ${serviceName ?? "este serviço"} para ${requestedDateLabel}${requestedTimeLabel ? ` às ${requestedTimeLabel}` : ""}. Precisamos ajustar alguns detalhes.`,
      "",
      "NOVA PROPOSTA:",
      ...proposalItems,
      ...(reason ? ["", `Justificativa da profissional: ${reason}`] : []),
      ...(answers.length ? ["", "Informações do pedido:", ...answers.map(answer => `• ${answer.question_label}: ${answerText(answer.answer)}`)] : []),
      "",
      "Confira a proposta e responda pelo link de acompanhamento enviado anteriormente.",
    ].join("\n");
    await update("proposed", {
      ...(dateChanged ? { requested_date: date } : {}),
      ...(timeChanged ? { requested_time: time } : {}),
      ...(durationChanged && duration !== null ? { duration_minutes: duration } : {}),
      ...(priceChanged && proposedPriceCents !== null ? { price_cents: proposedPriceCents } : {}),
      ...(reason ? { proposal_reason: reason } : {}),
    }, popup, whatsappMessage);
  }

  const pending = ["requested", "under_review", "proposed"].includes(status);
  const durationMinutes = requestedAt && endAt ? Math.max(0, Math.round((new Date(endAt).getTime() - new Date(requestedAt).getTime()) / 60000)) : 0;
  const hasValidPhone = Boolean(clientPhone && whatsappPhone(clientPhone).length >= 12);
  const appointmentHasEnded = Boolean(endAt && clock && new Date(endAt).getTime() <= clock);
  const reminderWhen = requestedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(requestedAt)) : "";
  const reminderText = `Olá, ${clientName || "tudo bem"}! Passando para lembrar do seu atendimento de ${serviceName ?? "serviço"}, marcado para ${reminderWhen}. Se precisar falar comigo sobre o horário, pode responder por aqui.`;
  const reminderUrl = hasValidPhone ? `https://wa.me/${whatsappPhone(clientPhone!)}?text=${encodeURIComponent(reminderText)}` : "";
  const answerText = (value: unknown): string => value == null || value === "" ? "—" : Array.isArray(value) ? value.map(answerText).join(", ") : typeof value === "object" ? Object.values(value as Record<string, unknown>).map(answerText).join(", ") : typeof value === "boolean" ? value ? "Sim" : "Não" : String(value);
  return <div className="appointment-actions">
    {(priceEstimateCents != null || answers.length > 0) && <details className="request-estimate-details"><summary>Ver respostas e valor calculado</summary><div><b>Estimativa do serviço com as opções: {priceEstimateCents == null ? "A combinar" : `R$ ${(priceEstimateCents / 100).toFixed(2).replace(".", ",")}`}</b>{durationMinutes > 0 && <small>Duração calculada: {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}min</small>}{answers.map((answer, index) => <p key={`${answer.question_label}-${index}`}><span>{answer.question_label}:</span> {answerText(answer.answer)}{answer.price_delta_cents ? ` · adicional ${answer.price_delta_cents > 0 ? "+" : "−"}R$ ${(Math.abs(answer.price_delta_cents) / 100).toFixed(2).replace(".", ",")}` : ""}{answer.duration_delta_minutes ? ` · ${answer.duration_delta_minutes > 0 ? "+" : "−"}${Math.floor(Math.abs(answer.duration_delta_minutes) / 60)}h ${Math.abs(answer.duration_delta_minutes) % 60}min` : ""}</p>)}</div></details>}
    {pending && <>
      {signalEnabled
        ? <button className="pill" disabled={busy} onClick={() => signal("request")}><Check size={14}/> Confirmar e pedir sinal</button>
        : <button className="pill" disabled={busy} onClick={() => signal("confirm")}><Check size={14}/> Confirmar atendimento</button>}
      <button className="pill" disabled={busy} onClick={() => { setRejecting(value => !value); setProposing(false); setError(""); }}><X size={14}/> Recusar</button>
      <button className="pill" disabled={busy} onClick={() => { setProposing(value => !value); setRejecting(false); setError(""); }}><CalendarClock size={14}/> Sugerir horário</button>
      {status === "requested" && <button className="pill" disabled={busy} onClick={() => update("under_review")}><Clock3 size={14}/> {busy ? "Analisando…" : "Analisar"}</button>}
    </>}
    {status === "under_review" && <span className="pill" role="status"><Clock3 size={14}/> Em análise</span>}
    {status === "confirmed" && paymentStatus === "signal_requested" && <>
      <span className="pill">Aguardando sinal · 1h</span>
      <button className="pill" disabled={busy} onClick={() => { setRejecting(value => !value); setError(""); }}><X size={14}/> Cancelar horário</button>
    </>}
    {status === "confirmed" && paymentStatus === "signal_reported" && <>
      <button className="pill" disabled={busy} onClick={() => signal("verify")}><Check size={14}/> Conferir sinal recebido</button>
      <button className="pill" disabled={busy} onClick={() => signal("not_received")}><X size={14}/> Não recebi o sinal do Pix</button>
    </>}
    {status === "confirmed" && (paymentStatus === "partial" || !paymentStatus) && <button className="pill" disabled={busy} onClick={() => update("completed")}>Concluir</button>}
    {status === "confirmed" && <>
      {reminderUrl && requestedAt && clock > 0 && new Date(requestedAt).getTime() > clock && <a className="pill" href={reminderUrl} target="_blank" rel="noreferrer">Preparar lembrete no WhatsApp</a>}
      <button className="pill" disabled={busy || !appointmentHasEnded} title={!appointmentHasEnded ? "Disponível após o término do horário marcado" : undefined} onClick={() => { if (window.confirm("Confirmar que a cliente não compareceu? O atendimento ficará registrado como falta.")) void update("no_show"); }}><X size={14}/> {busy ? "Atualizando…" : "Marcar falta"}</button>
    </>}
    {status === "completed" && <span className="pill"><Check size={14}/> Concluído</span>}
    {status === "no_show" && <span className="pill" role="status"><X size={14}/> Não compareceu</span>}
    {proposing && <form onSubmit={propose} className="panel appointment-proposal">
      <p className="proposal-guidance">Preencha somente o que precisa mudar. Se mudar apenas o dia, deixe o horário em branco para manter o horário atual. Se mudar apenas o horário, deixe o dia em branco para manter a data atual.</p>
      <div className="form-field"><label htmlFor={`proposal-date-${id}`}>Novo dia (opcional)</label><input id={`proposal-date-${id}`} name="date" type="date"/></div>
      <div className="form-field"><label htmlFor={`proposal-time-${id}`}>Novo horário (opcional)</label><input id={`proposal-time-${id}`} name="time" type="time"/></div>
      <div className="form-field"><label htmlFor={`proposal-duration-${id}`}>Nova duração (opcional, horas:minutos)</label><input id={`proposal-duration-${id}`} name="duration" type="time" step="60"/></div>
      <div className="form-field"><label htmlFor={`proposal-price-${id}`}>Novo valor (opcional, R$)</label><input id={`proposal-price-${id}`} name="price" type="number" min="0" step="0.01"/></div>
      <div className="form-field proposal-reason-field"><label htmlFor={`proposal-reason-${id}`}>Justificativa da mudança (opcional)</label><textarea id={`proposal-reason-${id}`} name="reason" rows={3} maxLength={500} placeholder="Explique brevemente para a cliente por que está sugerindo a mudança."/></div>
      <button className="btn" disabled={busy}>{busy ? "Enviando…" : "Enviar proposta"}</button>
    </form>}
    {rejecting && <form onSubmit={reject} className="panel appointment-proposal">
      <p className="proposal-guidance">Antes de recusar, você pode explicar à cliente o motivo e conversar com ela pelo WhatsApp.</p>
      <div className="form-field"><label htmlFor={`rejection-reason-${id}`}>Justificativa (opcional)</label><textarea id={`rejection-reason-${id}`} name="reason" rows={3} maxLength={500} placeholder="Ex.: não estarei disponível nesse dia. Podemos combinar outra data pelo WhatsApp."/></div>
      <button className="btn" disabled={busy}>{busy ? "Preparando aviso…" : "Recusar e avisar pelo WhatsApp"}</button>
      <button type="button" className="btn secondary" disabled={busy} onClick={() => setRejecting(false)}>Voltar</button>
    </form>}
    {error && <span className="form-error" role="alert">{error}</span>}
  </div>;
}
