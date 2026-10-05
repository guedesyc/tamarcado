"use client";

import { useState } from "react";
import { Copy, ExternalLink, Link2 } from "lucide-react";

export function AppointmentTrackingLink({ appointmentId }: { appointmentId: string }) {
  const [trackingUrl, setTrackingUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function issueLink() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/tracking-link`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível gerar o link.");
      setTrackingUrl(new URL(`/r/${result.tracking_token}`, window.location.origin).toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setMessage("Link copiado.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione e copie o link acima.");
    }
  }

  return <div className="appointment-tracking-link">
    {trackingUrl ? <>
      <a href={trackingUrl} target="_blank" rel="noreferrer" aria-label="Abrir acompanhamento do atendimento"><Link2 size={15} />{trackingUrl}<ExternalLink size={14} /></a>
      <button type="button" className="pill" onClick={copyLink}><Copy size={14} /> Copiar link</button>
    </> : <button type="button" className="pill" onClick={issueLink} disabled={busy}><Link2 size={14} />{busy ? "Gerando link…" : "Ver link de acompanhamento"}</button>}
    {message && <small role="status">{message}</small>}
  </div>;
}
