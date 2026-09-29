"use client";

import { useEffect,useState } from "react";
import { Check,Clock3 } from "lucide-react";

type WindowMode="month"|"year";

export function BookingWindowSettings(){
 const [value,setValue]=useState<WindowMode>("month");const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [message,setMessage]=useState("");
 useEffect(()=>{let active=true;fetch("/api/business/booking-window").then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);if(active)setValue(result.booking_window)}).catch(error=>{if(active)setMessage(error instanceof Error?error.message:"Não foi possível carregar a configuração.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function save(){setSaving(true);setMessage("");try{const response=await fetch("/api/business/booking-window",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({booking_window:value})});const result=await response.json();if(!response.ok)throw new Error(result.error);setMessage("Período de agendamento salvo.")}catch(error){setMessage(error instanceof Error?error.message:"Não foi possível salvar.")}finally{setSaving(false)}}
 return <section className="panel" style={{maxWidth:800,marginTop:16}}><h2 className="serif" style={{fontSize:26}}>Até quando as clientes podem agendar?</h2><p>Escolha a janela que aparece no calendário público. A configuração usa o mês ou ano corrente no fuso horário do seu espaço.</p><div className="form-field"><label htmlFor="booking-window">Disponibilidade do calendário</label><select id="booking-window" value={value} onChange={event=>setValue(event.target.value as WindowMode)} disabled={loading||saving}><option value="month">Somente o mês atual</option><option value="year">Até o fim do ano atual</option></select><small>No modo mensal, o próximo mês só fica aberto quando ele começar. Pedidos e propostas também respeitam esse limite.</small></div><button className="btn" onClick={save} disabled={loading||saving}>{saving?<Clock3 size={15}/>:<Check size={15}/>} {saving?"Salvando…":"Salvar período"}</button>{message&&<p className={message.startsWith("Não")?"form-error":"trial-box"} role="status">{message}</p>}</section>;
}
