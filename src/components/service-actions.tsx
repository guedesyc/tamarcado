"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Trash2 } from "lucide-react";

export function ServiceActions({ serviceId, active }: { serviceId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setActive(next: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/services/${serviceId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o serviço.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o serviço.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm("Excluir este serviço? Atendimentos anteriores permanecem no histórico.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/services/${serviceId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir o serviço.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o serviço.");
    } finally { setBusy(false); }
  }

  return <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 7 }}>
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
      <input type="checkbox" checked={!active} disabled={busy} onChange={event => setActive(!event.target.checked)}/>
      Inativar serviço
    </label>
    <button type="button" className="pill" disabled={busy} onClick={remove} aria-label="Excluir serviço"><Trash2 size={13}/> Excluir</button>
    {busy && <Clock3 size={13} aria-label="Salvando"/>}
    {error && <small role="alert" className="form-error" style={{ width: "100%" }}>{error}</small>}
  </div>;
}
