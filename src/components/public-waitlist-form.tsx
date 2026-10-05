"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";

export function PublicWaitlistForm({ slug, serviceId, selectedDate, selectedTime, initialName, initialPhone, startOpen = false, onClose }: { slug: string; serviceId: string; selectedDate?: string; selectedTime?: string; initialName?: string; initialPhone?: string; startOpen?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState(selectedDate ?? "");
  const [preferredTime, setPreferredTime] = useState(selectedTime ?? "");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!startOpen) return;
    const timer = window.setTimeout(() => {
      setPreferredDate(selectedDate ?? "");
      setPreferredTime(selectedTime ?? "");
      if (initialName) setName(initialName);
      if (initialPhone) setPhone(initialPhone);
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startOpen, selectedDate, selectedTime, initialName, initialPhone]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, serviceId, name, phone, preferredDate, preferredTime, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível entrar na lista agora.");
      setSuccess(result.message ?? "Pedido recebido. A profissional falará com você pelo WhatsApp se surgir uma possibilidade.");
      setOpen(false);
      onClose?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar na lista agora.");
    } finally {
      setBusy(false);
    }
  }

  if (success) return <p className="waitlist-success" role="status">{success}</p>;

  return <section className="public-waitlist" id="public-waitlist-form" aria-label="Lista de espera">
    {!open ? <button type="button" className="btn secondary" onClick={() => { setPreferredDate(selectedDate ?? ""); setPreferredTime(selectedTime ?? ""); if (initialName) setName(initialName); if (initialPhone) setPhone(initialPhone); setOpen(true); }}><BellRing size={15}/> Avise-me se abrir um horário</button> : <>
      <h3>Entrar na lista de espera</h3>
      <p>Se surgir uma possibilidade para este serviço no dia ou horário escolhido, a profissional poderá falar com você pelo WhatsApp. O sistema não envia mensagens automaticamente.</p>
      <div className="form-field"><label htmlFor="waitlist-name">Seu nome</label><input id="waitlist-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={100} required/></div>
      <div className="form-field"><label htmlFor="waitlist-phone">WhatsApp com DDD</label><input id="waitlist-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="(71) 99999-9999" maxLength={30} required/></div>
      <div className="form-field"><label htmlFor="waitlist-date">Data de preferência (opcional)</label><input id="waitlist-date" type="date" value={preferredDate} onChange={event => setPreferredDate(event.target.value)} min={new Date().toLocaleDateString("en-CA")}/></div>
      <div className="form-field"><label htmlFor="waitlist-time">Horário de preferência (opcional)</label><input id="waitlist-time" type="time" value={preferredTime} onChange={event => setPreferredTime(event.target.value)}/></div>
      <div className="form-field"><label htmlFor="waitlist-note">Observação (opcional)</label><textarea id="waitlist-note" value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Ex.: tenho preferência pelo período da tarde"/></div>
      <small>Seus dados serão usados apenas para este contato. Consulte a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.</small>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="waitlist-actions"><button type="button" className="btn" disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, "").length < 10} onClick={submit}>{busy ? "Enviando…" : "Entrar na lista"}</button><button type="button" className="btn secondary" disabled={busy} onClick={() => { setOpen(false); setError(""); onClose?.(); }}>Cancelar</button></div>
    </>}
  </section>;
}
