"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, MessageCircle } from "lucide-react";

type Appointment = { id: string; status: string; start_at: string; end_at: string; service_name_snapshot: string; client_name_snapshot: string | null; client_phone: string | null };
type ApiResult = { error?: string; slots?: string[]; start_at?: string; end_at?: string; status?: string };

function phoneDigits(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}
function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(value));
}

function RescheduleItem({ appointment, initialDate, timeZone, onComplete }: { appointment: Appointment; initialDate: string; timeZone: string; onComplete: (id: string) => void }) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newStart, setNewStart] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setSlots([]); setTime("");
    fetch(`/api/appointments/${appointment.id}/reschedule?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json() as ApiResult;
        if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar os horários.");
        const available = result.slots ?? [];
        setSlots(available); setTime(available[0] ?? "");
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível consultar os horários."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [appointment.id, date]);

  async function save() {
    if (!date || !time) { setError("Escolha uma data e um horário disponível."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/reschedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, time }) });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.start_at) throw new Error(result.error ?? "Não foi possível salvar o novo horário.");
      setNewStart(result.start_at); onComplete(appointment.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o novo horário."); }
    finally { setSaving(false); }
  }

  const client = appointment.client_name_snapshot || "Cliente";
  const phone = phoneDigits(appointment.client_phone);
  const when = newStart ? formatDateTime(newStart, timeZone) : "";
  const message = `Olá, ${client}! Seu atendimento de ${appointment.service_name_snapshot} foi reagendado para ${when}. Se precisar conversar sobre esse horário, estou à disposição.`;
  const status = appointment.status === "confirmed" ? "Confirmado" : appointment.status === "completed" ? "Concluído" : appointment.status === "no_show" ? "Não compareceu" : appointment.status === "proposed" ? "Aguardando resposta à proposta" : appointment.status === "under_review" ? "Em análise" : "Aguardando resposta";

  return <article className="agenda-reschedule-item">
    <div className="agenda-reschedule-summary"><b>{client} · {appointment.service_name_snapshot}</b><small>Horário atual: {formatDateTime(appointment.start_at, timeZone)} · {status}</small></div>
    {newStart ? <div className="agenda-reschedule-success" role="status"><Check size={16}/><span>Reagendado para {when}.</span>{phone.length >= 12 && <a className="pill" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={14}/> Avisar no WhatsApp</a>}</div> : <div className="agenda-reschedule-fields">
      <div className="form-field"><label htmlFor={`reschedule-date-${appointment.id}`}>Nova data</label><input id={`reschedule-date-${appointment.id}`} type="date" min={initialDate} value={date} onChange={event => setDate(event.target.value)}/></div>
      <div className="form-field"><label htmlFor={`reschedule-time-${appointment.id}`}>Horário disponível</label><select id={`reschedule-time-${appointment.id}`} value={time} onChange={event => setTime(event.target.value)} disabled={loading || slots.length === 0}><option value="">{loading ? "Buscando horários…" : slots.length ? "Selecione" : "Sem horários disponíveis"}</option>{slots.map(slot => <option value={slot} key={slot}>{slot}</option>)}</select></div>
      <button type="button" className="btn agenda-block-reschedule" disabled={saving || loading || !time} onClick={() => void save()}>{saving ? "Salvando…" : <><Check size={15}/> Salvar novo horário</>}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!error && !loading && slots.length === 0 && <small className="muted">Não há horários nesse dia. Tente outra data.</small>}
    </div>}
  </article>;
}

export function AgendaRescheduleQueue({ appointments, initialDate, timeZone }: { appointments: Appointment[]; initialDate: string; timeZone: string }) {
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  if (!appointments.length) return <section className="panel agenda-reschedule-queue" role="alert"><h2 className="serif">Não encontramos os atendimentos para reagendar</h2><p>Atualize a Agenda. Se o aviso continuar, abra novamente o bloqueio e escolha “Bloquear e Reagendar”.</p></section>;
  const remaining = appointments.filter(appointment => !completedIds.includes(appointment.id));
  return <section className="panel agenda-reschedule-queue" aria-labelledby="agenda-reschedule-title">
    <div className="panel-title"><span id="agenda-reschedule-title">Reagendar atendimentos afetados</span><CalendarClock size={18}/></div>
    <p className="settings-intro">Escolha uma nova data e horário para cada cliente. Serviço, respostas e demais informações do atendimento serão preservados. O status será mantido; registros futuros marcados como concluídos ou falta voltarão para confirmado.</p>
    {appointments.map(appointment => <RescheduleItem key={appointment.id} appointment={appointment} initialDate={initialDate} timeZone={timeZone} onComplete={id => setCompletedIds(current => current.includes(id) ? current : [...current, id])}/ >)}
    {remaining.length === 0 && <div className="agenda-reschedule-finish"><p>Todos os atendimentos foram reagendados.</p><button type="button" className="btn secondary" onClick={() => { router.replace(`/app/agenda?mes=${initialDate.slice(0, 7)}&dia=${initialDate}`); router.refresh(); }}>Voltar à Agenda</button></div>}
  </section>;
}
