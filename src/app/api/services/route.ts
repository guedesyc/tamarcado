import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const optionSchema=z.object({label:z.string().trim().min(1).max(120),priceDelta:z.coerce.number().min(-100000).max(100000).default(0),durationDelta:z.coerce.number().int().min(-1440).max(1440).default(0)});
const questionSchema=z.object({label:z.string().trim().min(1).max(200),type:z.enum(["single_choice","multiple_choice","text","number","boolean","note"]),required:z.boolean().default(false),options:z.array(optionSchema).max(20).default([])}).superRefine((question,ctx)=>{if(["single_choice","multiple_choice"].includes(question.type)&&question.options.length===0)ctx.addIssue({code:"custom",message:"Adicione ao menos uma opção para esta pergunta."});if(new Set(question.options.map(option=>option.label.toLocaleLowerCase("pt-BR"))).size!==question.options.length)ctx.addIssue({code:"custom",message:"As opções da mesma pergunta precisam ter nomes diferentes."})});
const schema=z.object({name:z.string().trim().min(2).max(120),description:z.string().max(1000).default(""),price:z.preprocess(value=>value===null||value===""?null:value,z.coerce.number().min(0).max(100000).nullable()),duration:z.preprocess(value=>value===null||value===""?null:value,z.coerce.number().int().min(1).max(1440).nullable()),buffer:z.coerce.number().int().min(0).max(240).default(0),mode:z.enum(["instant","approval","evaluation"]),questions:z.array(questionSchema).max(20).default([])});

export async function POST(request:Request){
 let raw:unknown;try{raw=await request.json()}catch{return NextResponse.json({error:"Confira os campos e tente novamente."},{status:400})}
 const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:"Confira nome, preço e duração do serviço."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data,error}=await supabase.rpc("create_service_setup",{p_service:{name:parsed.data.name,description:parsed.data.description,base_price_cents:parsed.data.price===null?null:Math.round(parsed.data.price*100),base_duration_minutes:parsed.data.duration,buffer_minutes:parsed.data.buffer,booking_mode:parsed.data.mode,questions:parsed.data.questions.map(question=>({...question,options:question.options.map(option=>({...option,price_delta_cents:Math.round(option.priceDelta*100),duration_delta_minutes:option.durationDelta}))}))}});
 if(error||!data)return NextResponse.json({error:"Não foi possível salvar o serviço. Confira os campos e tente novamente."},{status:400});
 return NextResponse.json({ok:true,id:data},{status:201});
}
