"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Menu, Plus, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

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
  return <header className="mh-header"><div className="mh-wrap mh-header-inner"><Link className="mh-brand" href="/" aria-label="Tá Marcado, início"><BrandLogo/></Link><button className="mh-menu-toggle" type="button" aria-expanded={open} aria-controls="mh-navigation" aria-label={open?"Fechar menu":"Abrir menu"} onClick={()=>setOpen(value=>!value)}>{open?<X size={22}/>:<Menu size={22}/>}</button><nav className={`mh-nav ${open?"is-open":""}`} id="mh-navigation" aria-label="Navegação principal"><a href="#conheca" onClick={()=>setOpen(false)}>Como funciona</a><a href="#especialidades" onClick={()=>setOpen(false)}>Especialidades</a><a href="#preco" onClick={()=>setOpen(false)}>Planos</a><Link href="/demo" onClick={()=>setOpen(false)}>Demonstração</Link><Link className="mh-nav-login" href="/entrar" onClick={()=>setOpen(false)}>Entrar</Link><Link className="mh-nav-cta" href="/cadastro" onClick={()=>setOpen(false)}>Começar grátis <ArrowRight size={15}/></Link></nav></div></header>;
}

export function ScrollPhone() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-story-step]")];
    if (!nodes.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if (visible) setActive(Number((visible.target as HTMLElement).dataset.storyStep));
    }, { rootMargin: "-18% 0px -58% 0px", threshold: [0, .25, .6, 1] });
    nodes.forEach(node=>observer.observe(node));
    return ()=>observer.disconnect();
  }, []);
  const screen = storyScreens[active] ?? storyScreens[0];
  return (
    <div className="mh-phone-story" aria-live="polite" aria-atomic="true">
      <div className="mh-phone">
        <div className="mh-phone-island" />
        <div className="mh-phone-status"><span>9:41</span><span>● ● ● ▰</span></div>
        <div className="mh-phone-screen">
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

const demoServices = [{name:"Box braids",price:220,duration:"4h"},{name:"Nagô",price:100,duration:"2h"},{name:"Twist",price:180,duration:"3h"}];
const demoTimes = ["09:00","10:30","11:00","13:30","15:00","16:30"];

export function BookingPreview() {
  const [service,setService]=useState(0),[day,setDay]=useState<number|null>(null),[time,setTime]=useState<string|null>(null),[sent,setSent]=useState(false);
  const dates=Array.from({length:14},(_,i)=>new Date(2026,9,3+i));
  return <div className="mh-booking-widget"><div className="mh-widget-heading"><span className="mh-widget-logo">A</span><span><b>Ana Tranças</b><small>Salvador · Tranças feitas com cuidado</small></span><span className="mh-widget-dots">•••</span></div>{sent?<div className="mh-widget-success"><span><Check size={23}/></span><h3>Pronto, na demonstração!</h3><p>Você escolheria <b>{demoServices[service].name}</b> para <b>{day?new Intl.DateTimeFormat("pt-BR",{day:"numeric",month:"long"}).format(dates[day-1]):""} às {time}</b>.</p><small>Nenhuma solicitação foi enviada ou salva.</small><button type="button" onClick={()=>{setSent(false);setDay(null);setTime(null)}}>Experimentar de novo</button></div>:<><div className="mh-widget-step"><span>1</span><div><b>Escolha um serviço</b><small>Selecione o atendimento que deseja</small></div></div><div className="mh-widget-services">{demoServices.map((item,index)=><button type="button" key={item.name} className={service===index?"selected":""} onClick={()=>{setService(index);setDay(null);setTime(null)}}><span><b>{item.name}</b><small>{item.duration} · a partir de R$ {item.price},00</small></span><span className="mh-radio"/></button>)}</div><div className="mh-widget-divider"/><div className="mh-widget-step"><span>2</span><div><b>Escolha um dia</b><small>Outubro de 2026</small></div><CalendarDays size={17}/></div><div className="mh-widget-days">{dates.map((date,index)=>{const number=index+1;return <button type="button" key={number} aria-pressed={day===number} className={day===number?"selected":""} onClick={()=>{setDay(number);setTime(null)}}><small>{new Intl.DateTimeFormat("pt-BR",{weekday:"short"}).format(date).replace(".","")}</small><b>{date.getDate()}</b></button>})}</div><div className="mh-widget-divider"/><div className="mh-widget-step"><span>3</span><div><b>Escolha um horário</b><small>{day?"Algumas opções para você":"Selecione um dia para ver os horários"}</small></div><Clock3 size={17}/></div><div className={`mh-widget-times ${day?"is-ready":""}`}>{demoTimes.slice(0,day?6:0).map(item=><button key={item} type="button" aria-pressed={time===item} className={time===item?"selected":""} onClick={()=>setTime(item)}>{item}</button>)}{!day&&<span className="mh-widget-placeholder">Os horários aparecem ao escolher um dia</span>}</div><button type="button" className="mh-widget-submit" disabled={!day||!time} onClick={()=>setSent(true)}>Ver prévia do pedido <ArrowRight size={15}/></button><small className="mh-widget-disclaimer">Prévia demonstrativa · não envia um pedido real</small></>}</div>;
}

export function SpecialtyRail() {
  const items=["Tranças","Unhas","Cílios","Sobrancelhas","Maquiagem","Estética","Depilação","Cabelo"];
  return <div className="mh-specialty-rail"><div className="mh-specialty-track">{[...items,...items].map((item,index)=><span key={`${item}-${index}`}><i aria-hidden="true">{["✳","✿","◌","✳","✿","◌","✳","✿"][index%8]}</i>{item}</span>)}</div></div>;
}
