"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Mail } from "lucide-react";
import Link from "next/link";
import { customerAccountCreationEnabled } from "@/lib/customer-account-feature";

export function CustomerAccess({ next = "/minha-agenda", compact = false }: { next?: string; compact?: boolean }) {
  const accountsEnabled = customerAccountCreationEnabled();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function signIn(method: "google" | "email") {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/customer/sign-in", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, email, next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tente novamente.");
      if (method === "google" && data.url) window.location.assign(data.url);
      else if (method === "email") setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tente novamente."); }
    finally { setPending(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void signIn("email"); }
  return <section className={compact ? "customer-access is-compact" : "customer-access"}>
    {!compact && <span className="customer-access-icon"><CalendarDays size={22}/></span>}
    <h2>{compact ? "Seus próximos agendamentos podem ser ainda mais rápidos" : "Sua agenda, em um só lugar"}</h2>
    <p>Acompanhe pedidos em diferentes profissionais e preencha seus dados mais rápido na próxima vez. A conta é opcional.</p>
    <div className="customer-account-links">{accountsEnabled && <Link className="btn" href="/cliente/cadastro">Criar conta de cliente</Link>}<Link className="btn secondary" href="/cliente/entrar">Já tenho conta</Link></div>
    {accountsEnabled && <><p className="customer-access-alternative">Prefere entrar sem senha?</p><button type="button" className="btn customer-google" onClick={() => void signIn("google")} disabled={pending}><span aria-hidden="true">G</span> Continuar com Google</button></>}
    <form onSubmit={submit} className="customer-email-form"><label htmlFor={compact ? "customer-email-booking" : "customer-email"}>Ou receba um link por e-mail</label><div><input id={compact ? "customer-email-booking" : "customer-email"} type="email" required autoComplete="email" placeholder="seu@email.com" value={email} onChange={event => setEmail(event.target.value)}/><button className="btn secondary" type="submit" disabled={pending}><Mail size={16}/> Enviar link</button></div></form>
    {sent && <p className="customer-access-success" role="status">Enviamos um link para o seu e-mail. Abra-o para acessar sua agenda.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
