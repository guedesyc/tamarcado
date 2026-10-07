"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, Menu, Plus, ShieldCheck, MapPin, Scissors, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import type { ReactNode } from "react";

const storyScreens = [
  { label: "SEU ESPAÇO PROFISSIONAL", title: "Ana Martins", subtitle: "Trancista · Salvador, BA", mode: "profile" },
  { label: "SEUS SERVIÇOS", title: "Escolha com carinho", subtitle: "Serviços pensados por você", mode: "services" },
  { label: "ESCOLHA UM HORÁRIO", title: "Um dia que combina", subtitle: "Agenda atualizada", mode: "calendar" },
  { label: "PEDIDO ENVIADO", title: "Está quase", subtitle: "A profissional vai revisar seu pedido", mode: "request" },
  { label: "TUDO ORGANIZADO", title: "Tá Marcado!", subtitle: "Um espaço de beleza e cuidado", mode: "done" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [open]);
  return <header className="mh-header"><div className="mh-wrap mh-header-inner"><Link className="mh-brand" href="/" aria-label="Tá Marcado, início"><BrandLogo/></Link><button className="mh-menu-toggle" type="button" aria-expanded={open} aria-controls="mh-navigation" aria-label={open?"Fechar menu":"Abrir menu"} onClick={()=>setOpen(value=>!value)}>{open?<X size={22}/>:<Menu size={22}/>}</button><nav className={`mh-nav ${open?"is-open":""}`} id="mh-navigation" aria-label="Navegação principal"><a href="#conheca" onClick={()=>setOpen(false)}>Como funciona</a><a href="#especialidades" onClick={()=>setOpen(false)}>Especialidades</a><a href="#preco" onClick={()=>setOpen(false)}>Planos</a><Link className="mh-nav-login" href="/entrar" onClick={()=>setOpen(false)}>Entrar</Link><Link className="mh-nav-cta" href="/cadastro" onClick={()=>setOpen(false)}>Começar grátis <ArrowRight size={15}/></Link></nav></div></header>;
}

export function ScrollReveal({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = [...root.querySelectorAll<HTMLElement>("[data-scroll-reveal]")];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    root.classList.add("mh-reveal-ready");
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return <div className="mh-scroll-reveal-root" ref={rootRef}>{children}</div>;
}

const storySteps = [
  { label: "01", topic: "apresentação", title: "Uma página que fala por você.", description: "Seu nome, sua história, seus serviços e suas fotos reunidos em um link fácil de compartilhar.", detail: "Seu perfil, onde sua cliente estiver", icon: MapPin },
  { label: "02", topic: "serviços", title: "Mostre o que você faz.", description: "Apresente seus serviços, valores e detalhes para sua cliente entender o que combina com ela.", detail: "Cada serviço com seus detalhes", icon: Scissors },
  { label: "03", topic: "horários", title: "Ela escolhe o melhor momento.", description: "A cliente vê os horários disponíveis e envia o pedido. Você confere antes de confirmar.", detail: "Só horários dentro da sua agenda", icon: CalendarDays },
  { label: "04", topic: "pedido", title: "Você acompanha cada solicitação.", description: "Veja as informações escolhidas pela cliente e responda sem perder o fio da conversa.", detail: "Cada pedido passa por você", icon: ShieldCheck },
  { label: "05", topic: "organização", title: "Mais tempo para fazer o que ama.", description: "Agenda, clientes e solicitações organizados para você encontrar tudo sem caçar mensagens antigas.", detail: "Tudo no mesmo lugar", icon: CalendarDays },
];

export function StorySection() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((active + 1) % storySteps.length), 3000);
    return () => window.clearTimeout(timer);
  }, [active]);
  const step = storySteps[active];
  const StepIcon = step.icon;
  return <section className="mh-story" id="conheca">
    <div className="mh-wrap mh-story-grid">
      <div className="mh-story-intro" data-scroll-reveal>
        <span className="mh-kicker"><span aria-hidden="true"/>Um lugar só seu</span>
        <h2>Seu talento já merece ser <em>encontrado.</em></h2>
        <p>Você faz um trabalho incrível. Agora ele pode ter uma casa à altura, pronta para compartilhar em qualquer conversa ou bio.</p>
        <Link className="mh-text-link" href="/cadastro">Crie seu espaço <ArrowRight size={15}/></Link>
        <div className="mh-story-phone-wrap"><ScrollPhone active={active}/></div>
      </div>
      <div className="mh-story-content" data-scroll-reveal>
        <article className="mh-story-card" key={step.label}>
          <div className="mh-story-num">{step.label} <span>· {step.topic}</span></div>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          <span className="mh-story-pill"><StepIcon size={13}/> {step.detail}</span>
          <div className="mh-story-progress" role="group" aria-label="Etapas da apresentação">
            {storySteps.map((item, index) => <button key={item.label} type="button" className={index === active ? "active" : ""} aria-label={`Mostrar etapa ${item.label}: ${item.topic}`} aria-pressed={index === active} onClick={() => setActive(index)} />)}
          </div>
        </article>
      </div>
    </div>
  </section>;
}

export function ScrollPhone({ active }: { active: number }) {
  const screen = storyScreens[active] ?? storyScreens[0];
  return (
    <div className="mh-phone-story" aria-label={`Prévia ilustrativa do aplicativo, etapa ${active + 1} de ${storyScreens.length}`}>
      <div className="mh-phone">
        <div className="mh-phone-island" />
        <div className="mh-phone-status"><span>9:41</span><span>● ● ● ▰</span></div>
        <div className="mh-phone-screen" key={active}>
          <div className="mh-phone-top"><span>‹</span><b>tá marcado!</b><span>♡</span></div>
          <div className={`mh-phone-cover mh-phone-cover-${screen.mode}`}><span>{screen.label}</span><b>{screen.mode === "done" ? "✓" : "a"}</b><small>{screen.title}</small></div>
          <div className="mh-phone-content">
            <span className="mh-phone-eyebrow">{screen.label}</span><b>{screen.title}</b><small>{screen.subtitle}</small>
            {screen.mode === "profile" && <><div className="mh-phone-services"><span>Box braids<small>a partir de R$ 220 · 4h</small></span><Plus size={13}/></div><div className="mh-phone-services"><span>Nagô<small>a partir de R$ 100 · 2h</small></span><Plus size={13}/></div><div className="mh-phone-cta">Escolher um horário</div></>}
            {screen.mode === "services" && <><div className="mh-phone-choice"><Check size={12}/> Box braids <small>R$ 220 · 4h</small></div><div className="mh-phone-choice">Nagô <small>R$ 100 · 2h</small></div><div className="mh-phone-cta">Continuar</div></>}
            {screen.mode === "calendar" && <><div className="mh-phone-month">Outubro 2026 <ChevronDown size={12}/></div><div className="mh-phone-days">{["5","6","7","8","9","10","11"].map((day,index)=><span key={day} className={index === 5 ? "picked" : ""}>{["S","T","Q","Q","S","S","D"][index]}<b>{day}</b></span>)}</div><div className="mh-phone-slots"><span>09:00</span><span>10:30</span><span className="picked">11:00</span><span>14:00</span></div></>}
            {screen.mode === "request" && <div className="mh-phone-confirm"><span>26 de setembro · 11:00</span><span>Box braids</span><i>Pedido enviado para revisão</i></div>}
            {screen.mode === "done" && <div className="mh-phone-confirm done"><span>Seu pedido está sendo cuidado.</span><i>Obrigada por escolher meu trabalho ♡</i></div>}
          </div>
          <div className="mh-phone-home" />
        </div>
      </div>
      <div className="mh-phone-dots" aria-label={`Etapa ${active + 1} de ${storyScreens.length}`}>{storyScreens.map((item,index)=><span key={item.mode} className={active === index ? "active" : ""} aria-hidden="true" />)}</div>
    </div>
  );
}

export function SpecialtyRail() {
  const items=["Tranças","Unhas","Cílios","Sobrancelhas","Maquiagem","Estética","Depilação","Cabelo"];
  return <div className="mh-specialty-rail"><div className="mh-specialty-track">{[...items,...items].map((item,index)=><span key={`${item}-${index}`}><i aria-hidden="true">{["✳","✿","◌","✳","✿","◌","✳","✿"][index%8]}</i>{item}</span>)}</div></div>;
}
