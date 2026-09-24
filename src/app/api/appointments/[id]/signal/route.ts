import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({action:z.enum(["request","verify"])});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Não foi possível atualizar o sinal."},{status:403});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Atendimento não encontrado."},{status:404});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira a ação e tente novamente."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Ação inválida."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data,error}=parsed.data.action==="request"?await supabase.rpc("request_appointment_signal",{p_appointment_id:id}):await supabase.rpc("verify_appointment_signal",{p_appointment_id:id});
 if(error){const message=error.message.includes("PIX_NOT_CONFIGURED")?"Configure chave Pix, titular e valor do sinal em Configurações.":error.message.includes("SLOT_UNAVAILABLE")?"Esse horário já foi ocupado. Atualize as solicitações.":error.message.includes("Signal is not reported")?"A cliente ainda não avisou o pagamento pelo link.":"Não foi possível atualizar o sinal. Confira o estado atual do pedido.";return NextResponse.json({error:message},{status:error.message.includes("SLOT_UNAVAILABLE")?409:400})}
 return NextResponse.json({ok:true,...(parsed.data.action==="request"?data as Record<string,unknown>: {})},{headers:{"Cache-Control":"no-store"}});
}
