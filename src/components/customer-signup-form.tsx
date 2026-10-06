"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PASSWORD_HINT, hasStrongPassword } from "@/lib/password-policy";

const messages: Record<string, string> = {
  invalid: "Confira seus dados. " + PASSWORD_HINT,
  confirmation: "As senhas não coincidem.",
  signup: "Não foi possível criar a conta. Se este e-mail já existe, entre na sua conta.",
  config: "O cadastro está indisponível no momento.",
  limit: "Muitas tentativas. Aguarde alguns minutos para tentar novamente."
};

export function CustomerSignupForm({ error }: { error?: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const localError = useMemo(() => {
    if (confirmation && password !== confirmation) return "As senhas não coincidem.";
    if (password && !hasStrongPassword(password)) return PASSWORD_HINT;
    return "";
  }, [password, confirmation]);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (password !== confirmation || !hasStrongPassword(password)) event.preventDefault();
  }

  return <form className="form-card customer-auth-card" action="/api/customer/signup" method="post" onSubmit={submit}>
    <Link href="/" className="customer-back-link"><ArrowLeft size={14}/> Voltar ao início</Link>
    <div className="customer-auth-heading"><span className="eyebrow">Conta de cliente</span><h1>Crie sua agenda pessoal.</h1><p>Guarde seus atendimentos e preencha seus próximos pedidos com mais rapidez.</p></div>
    <div className="form-field"><label htmlFor="customer-name">Nome completo</label><input id="customer-name" name="name" autoComplete="name" placeholder="Seu nome completo" minLength={2} maxLength={120} required/></div>
    <div className="form-field"><label htmlFor="customer-phone">WhatsApp com DDD</label><input id="customer-phone" name="phone" type="tel" autoComplete="tel" placeholder="(71) 99999-9999" minLength={10} maxLength={40} required/></div>
    <div className="form-field"><label htmlFor="customer-email">E-mail</label><input id="customer-email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" maxLength={254} required/><small>Usamos para confirmar e recuperar sua conta.</small></div>
    <div className="form-field"><label htmlFor="customer-password">Crie uma senha</label><input id="customer-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required/><small>{PASSWORD_HINT}</small></div>
    <div className="form-field"><label htmlFor="customer-password-confirmation">Confirme sua senha</label><input id="customer-password-confirmation" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} required/></div>
    {(localError || messages[error ?? ""]) && <p className="form-error" role="alert">{localError || messages[error ?? ""]}</p>}
    <button className="btn" style={{ width: "100%", marginTop: 8 }}>Criar minha conta <Check size={16}/></button>
    <p className="customer-auth-footnote">Ao continuar, você concorda com os <Link href="/termos">Termos de Uso</Link> e a <Link href="/privacidade">Política de Privacidade</Link>.</p>
    <p className="customer-auth-switch">Já tem uma conta? <Link href="/cliente/entrar">Entrar como cliente</Link></p>
    <p className="customer-auth-professional">Você é profissional? <Link href="/entrar">Acesse seu espaço profissional</Link></p>
  </form>;
}
