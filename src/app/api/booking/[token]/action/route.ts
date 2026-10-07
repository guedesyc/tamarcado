import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema=z.object({action:z.enum(["accept","cancel","request_another_time","report_signal"]),date:z.string().date().optional(),time:z.string().regex(/^\d\d:\d\d$/).optional(),reason:z.string().trim().min(3).max(500).optional()});

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível atualizar o atendimento deste endereço."},{status:403});
 const {token}=await params;if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return NextResponse.json({error:"Link inválido ou expirado."},{status:404});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira sua escolha e tente novamente."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Confira sua escolha e tente novamente."},{status:400});
 if(parsed.data.action==="request_another_time"&&(!parsed.data.date||!parsed.data.time))return NextResponse.json({error:"Escolha outro dia e horário."},{status:400});
 if(parsed.data.action==="cancel"&&(!parsed.data.reason||parsed.data.reason.trim().length<3))return NextResponse.json({error:"Informe brevemente por que precisa cancelar."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"O acompanhamento está temporariamente indisponível."},{status:503});
 const tokenHash=createHash("sha256").update(token).digest("hex");
 const {data,error}=parsed.data.action==="cancel"
  ?await supabase.rpc("cancel_public_booking",{p_token_hash:tokenHash,p_reason:parsed.data.reason})
  :parsed.data.action==="report_signal"
   ?await supabase.rpc("report_public_booking_signal",{p_token_hash:tokenHash})
   :await supabase.rpc("respond_public_booking",{p_token_hash:tokenHash,p_action:parsed.data.action,p_requested_date:parsed.data.date??null,p_requested_time:parsed.data.time??null});
 if(error){console.error("[public-booking-action] RPC failed",{code:error.code,action:parsed.data.action});const message=error.message.includes("SLOT_UNAVAILABLE")?"Esse horário não está disponível. Escolha outro.":error.message.includes("BOOKING_NOT_CANCELLABLE")?"Este atendimento não pode mais ser cancelado por este link.":error.message.includes("BOOKING_LINK_INVALID")?"Este link de acompanhamento expirou. Peça um novo link à profissional.":error.message.includes("CANCELLATION_REASON_REQUIRED")?"Informe brevemente o motivo do cancelamento.":"Não foi possível atualizar o atendimento agora. Recarregue o link e tente novamente.";return NextResponse.json({error:message},{status:error.message.includes("SLOT_UNAVAILABLE")?409:400})}
 return NextResponse.json({ok:true,...(parsed.data.action==="cancel"?{cancellation:data}:{})},{headers:{"Cache-Control":"no-store"}});
}
