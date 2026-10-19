"use client";

import { useState } from "react";

export function SignupConfirmationDialog() {
  const [open,setOpen]=useState(true);
  if(!open)return null;

  return <div className="signup-confirmation-backdrop">
    <section className="signup-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="signup-confirmation-title" aria-describedby="signup-confirmation-description">
      <span className="signup-confirmation-icon" aria-hidden="true">✓</span>
      <h2 id="signup-confirmation-title">Cadastro iniciado. Confirme seu e-mail para continuar.</h2>
      <p id="signup-confirmation-description">Enviamos um link para o endereço informado. Abra esse link para entrar e seguir para a configuração do seu espaço profissional. Se não encontrar, confira a pasta de spam.</p>
      <button type="button" className="btn" autoFocus onClick={()=>setOpen(false)}>Irei verificar o spam e a caixa de entrada do meu e-mail!</button>
    </section>
  </div>;
}
