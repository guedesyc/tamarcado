"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, X } from "lucide-react";

function digits(phone: string) {
  const value = phone.replace(/\D/g, "");
  return value.length === 10 || value.length === 11 ? `55${value}` : value;
}

export function WaitlistActions({ id, status, name, phone, service, businessName, preferredDate, preferredTime }: {
  id: string; status: string; name: string; phone: string; service: string; businessName: string; preferredDate?: string | null; preferredTime?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = status === "waiting" || status === "contacted";
  const dateText = preferredDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${preferredDate}T12:00:00Z`)) : "sem data específica";
  const message = `Olá, ${name}! Aqui é ${businessName}. Surgiu uma possibilidade para o serviço ${service}${preferredDate ? ` na data de preferência ${dateText}` : ""}${preferredTime ? ` às ${preferredTime.slice(0,5)}` : ""}. Quer conversar para combinarmos?`;
  const whatsapp = `https://wa.me/${digits(phone)}?text=${encodeURIComponent(message)}`;

  async function update(next: "contacted" | "booked" | "withdrawn") {
    if (next === "withdrawn" && !window.confirm("Encerrar este registro da lista de espera? Ele continuará no histórico.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/waitlist/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o registro.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o registro.");
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    if (!window.confirm(`Apagar permanentemente os dados de ${name} da lista de espera? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível apagar o contato.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível apagar o contato.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="waitlist-admin-actions">
    <span className={`status waitlist-status-${status}`}>{status === "waiting" ? "Aguardando" : status === "contacted" ? "Contatada" : status === "booked" ? "Agendou" : "Encerrada"}</span>
    {active && <>
      <a className="pill" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={14}/> Abrir WhatsApp</a>
      {status === "waiting" && <button type="button" className="pill" disabled={busy} onClick={() => update("contacted")}><Check size={14}/> Marcar contatada</button>}
      <button type="button" className="pill" disabled={busy} onClick={() => update("booked")}><Check size={14}/> Agendou</button>
      <button type="button" className="pill" disabled={busy} onClick={() => update("withdrawn")}><X size={14}/> Encerrar</button>
    </>}
    <button type="button" className="pill" disabled={busy} onClick={erase}>Apagar dados</button>
    {error && <small className="form-error" role="alert">{error}</small>}
  </div>;
}
