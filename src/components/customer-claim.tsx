"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function CustomerClaim({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  async function claim() {
    setState("pending");
    const response = await fetch(signedIn ? "/api/customer/claim" : "/api/customer/pending", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    if (response?.ok && !signedIn) { router.push("/minha-agenda"); return; }
    setState(response?.ok ? "done" : "error");
  }
  return <div className="customer-claim"><p>Quer ver este atendimento junto com os outros na sua agenda? A conta é opcional.</p>{state === "done" ? <Link className="btn secondary" href="/minha-agenda">Ver minha agenda</Link> : <button type="button" className="btn secondary" onClick={() => void claim()} disabled={state === "pending"}>{state === "pending" ? "Adicionando…" : "Adicionar à minha agenda"}</button>}{state === "error" && <p role="alert" className="form-error">Não foi possível adicionar agora. Tente novamente.</p>}</div>;
}
