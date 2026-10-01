"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";

export function CancellationSeenAction({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markAsSeen() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/mark-cancellation-seen`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível marcar como visto.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível marcar como visto.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="cancellation-seen-action">
    <button className="btn secondary small" type="button" onClick={markAsSeen} disabled={busy}>
      {busy ? <LoaderCircle size={14} className="spin"/> : <Check size={14}/>} {busy ? "Salvando…" : "Marcar como visto"}
    </button>
    {error && <span className="form-error" role="alert">{error}</span>}
  </div>;
}
