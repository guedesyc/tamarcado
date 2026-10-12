"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

const errorMessages:Record<string,string>={
  invalid:"Confira seu nome, e-mail e senha. A senha precisa ter pelo menos 10 caracteres.",
  config:"O cadastro está temporariamente indisponível. Tente novamente mais tarde.",
  signup:"Não foi possível criar seu acesso. Verifique se esse e-mail já está cadastrado e tente entrar ou recuperar a senha.",
  limite:"Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
  confirmacao:"As senhas não coincidem. Confira os dois campos e tente novamente."
};

export function SignupForm({error}:{error?:string}) {
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [mismatch,setMismatch]=useState(false);
  function validate(event:FormEvent<HTMLFormElement>){
    if(password!==confirmPassword){event.preventDefault();setMismatch(true)}
  }

  return <form className="form-card" action="/api/auth/signup" method="post" onSubmit={validate}>
    <Link href="/" style={{fontSize:12,color:"var(--muted)"}}><ArrowLeft size={14}/> Voltar</Link>
    <div style={{marginTop:26}}><span className="eyebrow">Acesso profissional</span><h1>Vamos começar?</h1><p>Crie seu acesso e monte sua página aos poucos. Leva só alguns minutos.</p></div>
    <div className="progress-steps"><span className="on"/><span/><span/><span/><span/></div>
    <div className="form-field"><label htmlFor="name">Como podemos chamar você?</label><input id="name" name="name" autoComplete="name" placeholder="Seu nome" required minLength={2}/></div>
    <div className="form-field"><label htmlFor="email">Seu melhor e-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required/></div>
    <div className="form-field"><label htmlFor="password">Crie uma senha</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} placeholder="Pelo menos 10 caracteres" required value={password} onChange={event=>{setPassword(event.target.value);setMismatch(false)}}/><small style={{color:"var(--muted)",fontSize:11}}>Use pelo menos 10 caracteres.</small></div>
    <div className="form-field"><label htmlFor="confirmPassword">Confirme sua senha</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} placeholder="Digite a mesma senha novamente" required value={confirmPassword} onChange={event=>{setConfirmPassword(event.target.value);setMismatch(false)}}/></div>
    <p className="signup-email-hint">Depois do cadastro, confirme seu e-mail pelo link que enviaremos. A configuração profissional começa em seguida.</p>
    {(mismatch||errorMessages[error??""])&&<p className="form-error" role="alert">{mismatch?"As senhas não coincidem. Confira os dois campos.":errorMessages[error??""]}</p>}
    <button className="btn" style={{width:"100%",marginTop:8}}>Criar meu acesso <Check size={16}/></button>
    <p style={{textAlign:"center",fontSize:11,lineHeight:1.6}}>Ao continuar, você concorda com os <Link href="/termos" style={{textDecoration:"underline"}}>Termos de Uso</Link> e a <Link href="/privacidade" style={{textDecoration:"underline"}}>Política de Privacidade</Link>.</p>
    <p style={{textAlign:"center",fontSize:12}}>Já tem acesso? <Link href="/entrar" style={{color:"var(--green)",fontWeight:700}}>Entrar</Link></p>
  </form>;
}
