"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerProfileForm({ name, phone, requirePhone = false }: { name: string; phone: string; requirePhone?: boolean }) {
  const router = useRouter();
  const [currentName, setName] = useState(name);
  const [currentPhone, setPhone] = useState(phone);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const response = await fetch("/api/customer/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: currentName.trim() || null, phone: currentPhone.trim() || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setMessage("Dados salvos. Eles poderão preencher seu próximo pedido.");
      router.refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); }
    finally { setPending(false); }
  }
  return <form className="customer-profile-form" onSubmit={save}><div className="form-field"><label htmlFor="customer-name">Nome</label><input id="customer-name" value={currentName} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} autoComplete="name" required={requirePhone}/></div><div className="form-field"><label htmlFor="customer-phone">WhatsApp com DDD</label><input id="customer-phone" type="tel" value={currentPhone} onChange={event => setPhone(event.target.value)} minLength={10} maxLength={40} autoComplete="tel" placeholder="(71) 99999-9999" required={requirePhone}/></div><button className="btn" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar meus dados"}</button>{message && <p role="status">{message}</p>}</form>;
}
