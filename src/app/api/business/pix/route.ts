import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema=z.object({pix_key:z.string().trim().max(200),pix_holder:z.string().trim().max(120),signal_type:z.enum(["fixed","percent"]),signal_amount:z.number().min(0).max(100000)}).superRefine((value,context)=>{if(value.signal_type==="percent"&&value.signal_amount>100)context.addIssue({code:"custom",path:["signal_amount"],message:"A porcentagem não pode ultrapassar 100%."})});

async function ownerBusiness(){
 const supabase=await createClient();if(!supabase)return{response:NextResponse.json({error:"Entre na sua conta para continuar."},{status:401})};
 const {data:{user}}=await supabase.auth.getUser();if(!user)return{response:NextResponse.json({error:"Entre na sua conta para continuar."},{status:401})};
 const {data:member}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).eq("role","owner").limit(1).maybeSingle();if(!member)return{response:NextResponse.json({error:"Somente a pessoa responsável pelo espaço pode alterar o Pix."},{status:403})};
 return{supabase,businessId:member.business_id};
}

export async function GET(){
 const auth=await ownerBusiness();if("response" in auth)return auth.response;
 const {data,error}=await auth.supabase.from("businesses").select("pix_key,pix_holder,signal_type,signal_amount").eq("id",auth.businessId).single();
 if(error)return NextResponse.json({error:"Não foi possível carregar os dados do Pix."},{status:500});
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}

export async function PUT(request:Request){
 const auth=await ownerBusiness();if("response" in auth)return auth.response;
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira os dados e tente novamente."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Confira chave, titular e valor do sinal."},{status:400});
 const {error}=await auth.supabase.from("businesses").update(parsed.data).eq("id",auth.businessId);
 if(error)return NextResponse.json({error:"Não foi possível salvar a configuração do Pix."},{status:500});
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
