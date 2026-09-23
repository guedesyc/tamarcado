import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({status:z.enum(["under_review","proposed","confirmed","cancelled_by_professional","expired","completed","no_show"]),changes:z.object({start_at:z.string().datetime().optional(),end_at:z.string().datetime().optional(),requested_date:z.string().date().optional(),requested_time:z.string().regex(/^\d\d:\d\d$/).optional(),duration_minutes:z.number().int().min(1).max(1440).optional(),price_cents:z.number().int().min(0).optional()}).default({})});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Não foi possível atualizar o atendimento."},{status:403});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Atendimento não encontrado."},{status:404});
 let raw:unknown;try{raw=await request.json()}catch{return NextResponse.json({error:"Confira a ação e tente novamente."},{status:400})}
 const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:"Confira a ação e tente novamente."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {error}=await supabase.rpc("transition_appointment",{p_appointment_id:id,p_next:parsed.data.status,p_changes:parsed.data.changes});
 if(error)return NextResponse.json({error:error.message.includes("SLOT_UNAVAILABLE")?"Esse horário acabou de ficar indisponível. Escolha outro.":"Não foi possível atualizar o atendimento. Confira o status atual."},{status:error.message.includes("SLOT_UNAVAILABLE")?409:400});
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
