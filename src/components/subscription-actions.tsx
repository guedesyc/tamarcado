"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Settings2 } from "lucide-react";

async function openBilling(path: "/api/billing/checkout" | "/api/billing/portal") {
  const response = await fetch(path, { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Não foi possível abrir a assinatura.");
  window.location.assign(result.url);
}

export function StartSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setError(""); setLoading(true);
    try { await openBilling("/api/billing/checkout"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a assinatura."); } finally { setLoading(false); }
  }
  return <div><button className="btn" onClick={start} disabled={loading}><CreditCard size={16} />{loading ? "Abrindo checkout…" : "Ativar por R$ 49,99/mês"}<ExternalLink size={14} /></button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}

export function CancelSubscription({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!active) return null;
  async function manage() {
    setError(""); setLoading(true);
    try { await openBilling("/api/billing/portal"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir o gerenciamento da assinatura."); } finally { setLoading(false); }
  }
  return <div style={{ marginTop: 22 }}><button className="btn secondary small" onClick={manage} disabled={loading}><Settings2 size={14} />{loading ? "Abrindo…" : "Gerenciar assinatura"}</button><p style={{ fontSize: 11, color: "var(--muted)" }}>Atualize o cartão, veja faturas ou cancele pelo portal seguro do Stripe.</p>{error && <p className="form-error">{error}</p>}</div>;
}
