"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarOff, Check, Clock3, MessageCircle, Trash2 } from "lucide-react";

type Block = { id: string; starts_at: string; ends_at: string; label: string | null };
type AffectedAppointment = { id: string; client_name: string; client_phone: string | null; service_name: string; starts_at: string; ends_at: string; status: string };
type ApiResult = { error?: string; timeZone?: string; blocks?: Block[]; requires_confirmation?: boolean; already_blocked?: boolean; blocked?: boolean; appointments?: AffectedAppointment[] };

function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function phoneDigits(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function timeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(value));
}

function statusLabel(status: string) {
  return status === "confirmed" ? "Confirmado" : status === "proposed" ? "Aguardando resposta à proposta" : status === "under_review" ? "Em análise" : "Aguardando resposta";
}

export function AgendaBlockSettings() {
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [affected, setAffected] = useState<AffectedAppointment[] | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/business/agenda-blocks", { cache: "no-store" });
    const result = await response.json() as ApiResult;
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os bloqueios.");
    const zone = result.timeZone ?? "America/Sao_Paulo";
    setTimeZone(zone);
    setDate(current => current || localDate(zone));
    setBlocks(result.blocks ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/business/agenda-blocks", { cache: "no-store" }).then(async response => {
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os bloqueios.");
      if (!active) return;
      const zone = result.timeZone ?? "America/Sao_Paulo";
      setTimeZone(zone); setDate(localDate(zone)); setBlocks(result.blocks ?? []);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar os bloqueios."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(acknowledgeConflicts = false) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/business/agenda-blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, start, end, acknowledgeConflicts }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar o bloqueio.");
      if (result.requires_confirmation) { setAffected(result.appointments ?? []); return; }
      setAffected(null); setMessage("Horário bloqueado. Novas solicitações não poderão escolher esse período.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar o bloqueio."); }
    finally { setPending(false); }
  }

  async function remove(id: string) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/business/agenda-blocks", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível remover o bloqueio.");
      setBlocks(current => current.filter(block => block.id !== id)); setMessage("Bloqueio removido.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível remover o bloqueio."); }
    finally { setPending(false); }
  }

  return <section className="panel agenda-block-settings">
    <div className="panel-title"><span>Bloqueio de agenda</span><CalendarOff size={18}/></div>
    <p className="settings-intro">Feche um período específico para não receber novos pedidos nesse horário. Se já houver atendimentos afetados, você poderá conferir os detalhes e conversar com cada cliente antes de concluir.</p>
    <form className="agenda-block-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(); }}>
      <div className="form-field"><label htmlFor="agenda-block-date">Data</label><input id="agenda-block-date" type="date" min={localDate(timeZone)} value={date} onChange={event => { setDate(event.target.value); setAffected(null); }} required/></div>
      <div className="form-field"><label htmlFor="agenda-block-start">Horário inicial</label><input id="agenda-block-start" type="time" value={start} onChange={event => { setStart(event.target.value); setAffected(null); }} required/></div>
      <div className="form-field"><label htmlFor="agenda-block-end">Horário final</label><input id="agenda-block-end" type="time" value={end} onChange={event => { setEnd(event.target.value); setAffected(null); }} required/></div>
      <button className="btn" type="submit" disabled={pending || loading}>{pending ? "Aguarde…" : <><CalendarOff size={15}/> Conferir e bloquear</>}</button>
    </form>
    {affected && <div className="agenda-block-review" role="region" aria-labelledby="agenda-block-review-title">
      <h3 id="agenda-block-review-title">Este período afeta {affected.length} {affected.length === 1 ? "atendimento" : "atendimentos"}</h3>
      <p>Confira os dados e, se necessário, combine outro horário com cada cliente pelo WhatsApp. O bloqueio não cancela nem altera esses atendimentos.</p>
      <div className="agenda-block-affected-list">{affected.map(item => {
        const digits = phoneDigits(item.client_phone);
        const text = `Olá, ${item.client_name}! Preciso conversar sobre seu atendimento de ${item.service_name}, marcado para ${timeLabel(item.starts_at, timeZone)}. Preciso bloquear minha agenda nesse período. Podemos combinar uma alternativa?`;
        return <article className="agenda-block-affected" key={item.id}>
          <div><b>{item.client_name}</b><small>{item.service_name} · {timeLabel(item.starts_at, timeZone)}–{new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(item.ends_at))}</small><span>{statusLabel(item.status)}</span></div>
          {digits.length >= 12 ? <a className="pill" href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle size={14}/> Conversar no WhatsApp</a> : <small className="muted">Este cadastro não tem um WhatsApp válido.</small>}
        </article>;
      })}</div>
      <div className="agenda-block-review-actions"><button type="button" className="btn secondary" onClick={() => setAffected(null)} disabled={pending}>Voltar</button><button type="button" className="btn" onClick={() => void submit(true)} disabled={pending}>{pending ? "Salvando…" : <><Check size={15}/> Bloquear mesmo assim</>}</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="settings-success" role="status"><Check size={15}/>{message}</p>}
    <div className="agenda-block-list"><h3>Bloqueios futuros</h3>{loading ? <p className="settings-help">Carregando bloqueios…</p> : blocks.length ? blocks.map(block => <article className="agenda-block-item" key={block.id}><div><b>{timeLabel(block.starts_at, timeZone)}</b><small><Clock3 size={13}/> até {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(block.ends_at))}</small></div><button className="pill" type="button" onClick={() => void remove(block.id)} disabled={pending} aria-label={`Remover bloqueio de ${timeLabel(block.starts_at, timeZone)}`}><Trash2 size={14}/> Remover</button></article>) : <p className="settings-help">Você ainda não tem horários bloqueados.</p>}</div>
  </section>;
}
