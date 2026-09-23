import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({action:z.enum(["accept","cancel","request_another_time"]),date:z.string().date().optional(),time:z.string().regex(/^\d\d:\d\d$/).optional()});

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Não foi possível atualizar o atendimento."},{status:403});
 const {token}=await params;if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return NextResponse.json({error:"Link inválido ou expirado."},{status:404});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira sua escolha e tente novamente."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Confira sua escolha e tente novamente."},{status:400});
 if(parsed.data.action==="request_another_time"&&(!parsed.data.date||!parsed.data.time))return NextResponse.json({error:"Escolha outro dia e horário."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"O acompanhamento está temporariamente indisponível."},{status:503});
 const tokenHash=createHash("sha256").update(token).digest("hex");const {error}=await supabase.rpc("respond_public_booking",{p_token_hash:tokenHash,p_action:parsed.data.action,p_requested_date:parsed.data.date??null,p_requested_time:parsed.data.time??null});
 if(error)return NextResponse.json({error:error.message.includes("SLOT_UNAVAILABLE")?"Esse horário não está disponível. Escolha outro.":"Não foi possível atualizar o atendimento. Confira o estado atual pelo link."},{status:error.message.includes("SLOT_UNAVAILABLE")?409:400});
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
