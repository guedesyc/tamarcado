import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const answer=z.object({question_id:z.string().uuid(),option_ids:z.array(z.string().uuid()).max(20).default([]),value:z.union([z.string().max(1000),z.number(),z.boolean()]).optional()});
const schema=z.object({slug:z.string().regex(/^[a-z0-9-]{3,40}$/),serviceId:z.string().uuid(),answers:z.array(answer).max(20)});
export async function POST(request:Request){
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Dados inválidos."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Dados inválidos."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Serviço indisponível."},{status:503});
 const {data,error}=await supabase.rpc("calculate_service_quote",{p_slug:parsed.data.slug,p_service_id:parsed.data.serviceId,p_answers:parsed.data.answers});
 if(error)return NextResponse.json({error:"Não foi possível calcular esta estimativa."},{status:400,headers:{"Cache-Control":"no-store"}});
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}
