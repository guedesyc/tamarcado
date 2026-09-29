import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const answerSchema=z.object({question_id:z.string().uuid(),option_ids:z.array(z.string().uuid()).max(20).default([]),value:z.union([z.string().max(1000),z.number(),z.boolean()]).optional()});
const querySchema=z.object({slug:z.string().regex(/^[a-z0-9-]{3,40}$/),serviceId:z.string().uuid().optional(),date:z.string().date().optional(),answers:z.string().max(8000).optional(),window:z.enum(["1"]).optional()});

export async function GET(request:Request){
 const url=new URL(request.url);const parsed=querySchema.safeParse({slug:url.searchParams.get("slug"),serviceId:url.searchParams.get("serviceId")??undefined,date:url.searchParams.get("date")??undefined,answers:url.searchParams.get("answers")??undefined,window:url.searchParams.get("window")??undefined});
 if(!parsed.success)return NextResponse.json({slots:[]},{status:400,headers:{"Cache-Control":"no-store"}});
 const supabase=await createClient();if(!supabase)return NextResponse.json({slots:[]},{headers:{"Cache-Control":"no-store"}});
 if(parsed.data.window){const {data,error}=await supabase.rpc("get_public_booking_window",{p_slug:parsed.data.slug});if(error||!data?.length)return NextResponse.json({error:"Calendário indisponível."},{status:404,headers:{"Cache-Control":"no-store"}});return NextResponse.json(data[0],{headers:{"Cache-Control":"no-store"}})}
 if(!parsed.data.serviceId||!parsed.data.date)return NextResponse.json({slots:[]},{status:400,headers:{"Cache-Control":"no-store"}});
 let answers:unknown=[];try{answers=JSON.parse(parsed.data.answers??"[]");if(!Array.isArray(answers)||answers.length>20||answers.some(answer=>!answerSchema.safeParse(answer).success))throw new Error()}catch{return NextResponse.json({slots:[]},{status:400,headers:{"Cache-Control":"no-store"}})}
 const {data,error}=await supabase.rpc("get_public_slots",{p_slug:parsed.data.slug,p_service_id:parsed.data.serviceId,p_date:parsed.data.date,p_answers:answers});
 if(error)return NextResponse.json({slots:[]},{headers:{"Cache-Control":"no-store"}});
 const slots=((data??[]) as {slot_time:string}[]).map(row=>String(row.slot_time).slice(0,5));
 return NextResponse.json({slots},{headers:{"Cache-Control":"no-store"}});
}
