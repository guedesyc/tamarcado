import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema=z.object({status:z.enum(["under_review","proposed","confirmed","cancelled_by_professional","expired","completed","no_show"]),changes:z.object({start_at:z.string().datetime().optional(),end_at:z.string().datetime().optional(),requested_date:z.string().date().optional(),requested_time:z.string().regex(/^\d\d:\d\d$/).optional(),duration_minutes:z.number().int().min(1).max(1440).optional(),price_cents:z.number().int().min(0).optional(),proposal_reason:z.string().trim().max(500).optional(),rejection_reason:z.string().trim().max(500).optional()}).default({})});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível atualizar o atendimento deste endereço."},{status:403});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Atendimento não encontrado."},{status:404});
 let raw:unknown;try{raw=await request.json()}catch{return NextResponse.json({error:"Confira a ação e tente novamente."},{status:400})}
 const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:"Confira a ação e tente novamente."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {error}=await supabase.rpc("transition_appointment",{p_appointment_id:id,p_next:parsed.data.status,p_changes:parsed.data.changes});
 if(error){
  console.error("[appointment-transition] RPC failed",{code:error.code,appointmentId:id,nextStatus:parsed.data.status});
  const message=error.message.includes("SLOT_UNAVAILABLE")?"O horário proposto está fora do expediente, bloqueado ou sem capacidade. Confira a data, a duração e o horário de atendimento da profissional."
   :error.message.includes("NO_SHOW_TOO_EARLY")?"A falta só pode ser registrada depois do término do horário marcado."
   :error.message.includes("Invalid appointment status transition")?"Esta solicitação já mudou de estado. Atualize a página e confira a situação atual."
   :error.message.includes("SIGNAL_REQUIRED")?"Este espaço exige sinal. Use “Confirmar e pedir sinal” para concluir a confirmação."
   :"Não foi possível atualizar o atendimento. Confira a solicitação e tente novamente.";
  const capacityConflict=error.message.includes("SLOT_UNAVAILABLE");
  return NextResponse.json({error:message,...(capacityConflict?{code:"SLOT_UNAVAILABLE"}:{})},{status:capacityConflict?409:400});
 }
 if(parsed.data.status==="proposed"){
  const trackingToken=randomBytes(32).toString("base64url");
  const tokenHash=createHash("sha256").update(trackingToken).digest("hex");
  const {error:linkError}=await supabase.rpc("set_appointment_proposal_tracking_token",{p_appointment_id:id,p_token_hash:tokenHash});
  if(linkError){
   console.error("[appointment-transition] Could not issue proposal tracking link",{code:linkError.code,appointmentId:id});
   return NextResponse.json({error:"A proposta foi salva, mas não foi possível gerar o link de acompanhamento. Tente enviar novamente."},{status:500});
  }
  return NextResponse.json({ok:true,tracking_token:trackingToken},{headers:{"Cache-Control":"no-store"}});
 }
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
