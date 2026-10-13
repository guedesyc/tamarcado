"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CircleHelp, MessageCircle, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";

const WHATSAPP_NUMBER = "5571999583586";

export function SupportChat() {
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith("/app");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sentText, setSentText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;

    const whatsappMessage = `Olá! Vim pelo site Tá Marcado e preciso de ajuda:\n\n${text}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSentText(text);
    setMessage("");
  }

  const fallbackUrl = sentText
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá! Vim pelo site Tá Marcado e preciso de ajuda:\n\n${sentText}`)}`
    : "";

  return <>
    {open && <section className={`support-chat-panel${isWorkspace ? " is-workspace" : ""}`} id="support-chat-panel" role="dialog" aria-modal="false" aria-labelledby="support-chat-title">
      <header className="support-chat-header">
        <span className="support-chat-icon"><MessageCircle size={18} /></span>
        <div><b id="support-chat-title">Atendimento Tá Marcado</b><small>Como podemos ajudar?</small></div>
        <button type="button" className="support-chat-close" aria-label="Fechar atendimento" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>
      <div className="support-chat-body">
        <p className="support-chat-greeting">Oi! Escreva sua dúvida ou conte como podemos ajudar.</p>
        {sentText && <p className="support-chat-confirmation" role="status">O WhatsApp abriu com sua mensagem pronta. Toque em <b>Enviar</b> por lá para falar com a gente.<a href={fallbackUrl} target="_blank" rel="noopener noreferrer">Se não abriu, toque aqui para continuar.</a></p>}
        <form onSubmit={send}>
          <label className="support-chat-label" htmlFor="support-chat-message">Sua mensagem</label>
          <textarea ref={inputRef} id="support-chat-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={1200} rows={4} placeholder="Digite aqui…" required />
          <div className="support-chat-form-footer"><small>{message.length}/1200</small><button className="support-chat-send" type="submit" disabled={!message.trim()}><Send size={15} /> Abrir WhatsApp</button></div>
        </form>
        <small className="support-chat-note">Você poderá revisar e enviar a mensagem no WhatsApp.</small>
      </div>
    </section>}
    <button type="button" className={`support-chat-launcher${isWorkspace ? " is-workspace" : ""}`} aria-label={open ? "Fechar atendimento" : "Abrir atendimento"} aria-expanded={open} aria-controls="support-chat-panel" onClick={() => setOpen(current => !current)}>
      {open ? <X size={24} /> : <CircleHelp size={25} />}
    </button>
  </>;
}
