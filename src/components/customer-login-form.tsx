"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const messages: Record<string, string> = {
  invalid: "Confira o e-mail e a senha.", credentials: "E-mail ou senha inválidos.",
  callback: "Não foi possível concluir o acesso pelo Google. Tente novamente.",
  google: "O acesso pelo Google ainda não está configurado.", customer: "Este acesso é de profissional. Use o espaço profissional.",
  config: "O acesso está indisponível no momento.", limit: "Muitas tentativas. Aguarde alguns minutos."
};

export function CustomerLoginForm({ error }: { error?: string }) {
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState("");
  async function google() {
    setGooglePending(true); setGoogleError("");
    try {
      const response = await fetch("/api/customer/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "google", next: "/minha-agenda" }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "Não foi possível iniciar o acesso pelo Google.");
      window.location.assign(data.url);
    } catch (reason) { setGoogleError(reason instanceof Error ? reason.message : "Tente novamente."); }
    finally { setGooglePending(false); }
  }
  function preventGoogle(event: FormEvent<HTMLFormElement>) { if (googlePending) event.preventDefault(); }
  return <form className="form-card customer-auth-card" action="/api/customer/login" method="post" onSubmit={preventGoogle}>
    <Link href="/" className="customer-back-link"><ArrowLeft size={14}/> Voltar ao início</Link>
    <div className="customer-auth-heading"><span className="eyebrow">Conta de cliente</span><h1>Entre na sua agenda.</h1><p>Consulte seus pedidos, o histórico e os seus dados.</p></div>
    <button type="button" className="btn secondary customer-google-login" onClick={() => void google()} disabled={googlePending}><span aria-hidden="true">G</span>{googlePending ? "Abrindo Google…" : "Continuar com Google"}</button>
    <div className="customer-login-divider"><span>ou entre com e-mail</span></div>
    <div className="form-field"><label htmlFor="customer-login-email">E-mail</label><input id="customer-login-email" name="email" type="email" autoComplete="email" required/></div>
    <div className="form-field"><label htmlFor="customer-login-password">Senha</label><input id="customer-login-password" name="password" type="password" autoComplete="current-password" required/><Link href="/cliente/esqueci-senha">Esqueci minha senha</Link></div>
    {(googleError || messages[error ?? ""]) && <p className="form-error" role="alert">{googleError || messages[error ?? ""]}</p>}
    <button className="btn" style={{ width: "100%", marginTop: 8 }}>Entrar na minha agenda</button>
    <p className="customer-auth-switch">Ainda não tem uma conta? <Link href="/cliente/cadastro">Criar conta de cliente</Link></p>
    <p className="customer-auth-professional">Você é profissional? <Link href="/entrar">Acesse seu espaço profissional</Link></p>
  </form>;
}
