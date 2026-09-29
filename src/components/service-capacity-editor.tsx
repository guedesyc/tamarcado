"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check,Clock3 } from "lucide-react";

export function ServiceCapacityEditor({serviceId,initialCapacity}:{serviceId:string;initialCapacity:number}){
 const router=useRouter();const [capacity,setCapacity]=useState(initialCapacity);const [saving,setSaving]=useState(false);const [message,setMessage]=useState("");
 async function save(){setSaving(true);setMessage("");try{const response=await fetch(`/api/services/${serviceId}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({simultaneousCapacity:capacity})});const result=await response.json();if(!response.ok)throw new Error(result.error);setMessage("Capacidade salva.");router.refresh()}catch(error){setMessage(error instanceof Error?error.message:"Não foi possível salvar.")}finally{setSaving(false)}}
 return <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:5}}><label htmlFor={`capacity-${serviceId}`} style={{fontSize:10,color:"var(--muted)"}}>Simultâneos</label><input id={`capacity-${serviceId}`} type="number" min="1" max="50" value={capacity} onChange={event=>setCapacity(Math.max(1,Math.min(50,Number(event.target.value)||1)))} aria-label="Máximo simultâneo deste serviço" style={{width:58,padding:"4px 6px"}}/><button type="button" className="pill" disabled={saving||capacity===initialCapacity} onClick={save} style={{padding:"4px 8px"}}>{saving?<Clock3 size={12}/>:<Check size={12}/>} Salvar</button>{message&&<small role="status" style={{width:"100%",color:message.includes("não")?"var(--coral)":"var(--green2)"}}>{message}</small>}</div>;
}
