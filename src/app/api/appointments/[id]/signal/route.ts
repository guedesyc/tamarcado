import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema=z.object({action:z.enum(["request","verify","confirm"])});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível atualizar o sinal deste endereço."},{status:403});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Atendimento não encontrado."},{status:404});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira a ação e tente novamente."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Ação inválida."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data,error}=parsed.data.action==="request"
  ?await supabase.rpc("request_appointment_signal",{p_appointment_id:id})
  :parsed.data.action==="confirm"
   ?await supabase.rpc("confirm_appointment_without_signal",{p_appointment_id:id})
   :await supabase.rpc("verify_appointment_signal",{p_appointment_id:id});
 if(error){console.error("[appointment-signal] RPC failed",{code:error.code,message:error.message,appointmentId:id,action:parsed.data.action});const message=error.message.includes("PIX_NOT_CONFIGURED")?"Configure chave Pix, titular e valor do sinal em Configurações.":error.message.includes("INVALID_SIGNAL_AMOUNT")?"O valor calculado do sinal precisa ser maior que zero. Confira o preço e a configuração do Pix.":error.message.includes("SIGNAL_DISABLED")?"O sinal está desativado nas configurações. Atualize a página para confirmar sem Pix.":error.message.includes("SLOT_UNAVAILABLE")?"Esse horário já foi ocupado. Atualize as solicitações.":error.message.includes("Signal is not reported")?"A cliente ainda não avisou o pagamento pelo link.":error.message.includes("Invalid appointment status")?"O pedido já mudou de estado. Atualize a página antes de continuar.":"Não foi possível atualizar o atendimento. Atualize a página e tente novamente.";return NextResponse.json({error:message},{status:error.message.includes("SLOT_UNAVAILABLE")?409:400})}
 return NextResponse.json({ok:true,...data as Record<string,unknown>},{headers:{"Cache-Control":"no-store"}});
}
