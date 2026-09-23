import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({name:z.string().trim().min(2).max(120),phone:z.string().trim().min(10).max(40),serviceId:z.string().uuid(),date:z.string().date(),time:z.string().regex(/^\d\d:\d\d$/),price:z.coerce.number().min(0).max(100000).optional(),duration:z.coerce.number().int().min(1).max(1440).optional(),note:z.string().max(500).optional()});

export async function POST(request:Request){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Não foi possível criar o atendimento."},{status:403});
 let raw:unknown;try{raw=await request.json()}catch{return NextResponse.json({error:"Confira os dados e tente novamente."},{status:400})}
 const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:"Confira nome, serviço e horário do atendimento."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data,error}=await supabase.rpc("create_manual_appointment",{p_client_name:parsed.data.name,p_client_phone:parsed.data.phone,p_service_id:parsed.data.serviceId,p_date:parsed.data.date,p_time:parsed.data.time,p_price_cents:parsed.data.price===undefined?null:Math.round(parsed.data.price*100),p_duration_minutes:parsed.data.duration??null,p_note:parsed.data.note??null});
 if(error)return NextResponse.json({error:error.message.includes("SLOT_UNAVAILABLE")?"Esse horário não está disponível. Escolha outro.":"Não foi possível criar o atendimento. Confira os dados."},{status:error.message.includes("SLOT_UNAVAILABLE")?409:400});
 return NextResponse.json({ok:true,id:data},{status:201});
}
