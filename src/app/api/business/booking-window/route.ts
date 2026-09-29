import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema=z.object({booking_window:z.enum(["month","year"])});

async function ownerBusiness(){
 const supabase=await createClient();
 if(!supabase)return{response:NextResponse.json({error:"Entre na sua conta para continuar."},{status:401})};
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return{response:NextResponse.json({error:"Entre na sua conta para continuar."},{status:401})};
 const {data:member}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).eq("role","owner").limit(1).maybeSingle();
 if(!member)return{response:NextResponse.json({error:"Somente a pessoa responsável pelo espaço pode alterar esta configuração."},{status:403})};
 return{supabase,businessId:member.business_id};
}

export async function GET(){
 const auth=await ownerBusiness();if("response" in auth)return auth.response;
 const {data,error}=await auth.supabase.from("businesses").select("booking_window").eq("id",auth.businessId).single();
 if(error)return NextResponse.json({error:"Não foi possível carregar o período de agendamento."},{status:500});
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}

export async function PUT(request:Request){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível salvar desta página."},{status:403});
 const auth=await ownerBusiness();if("response" in auth)return auth.response;
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira a configuração e tente novamente."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Escolha mês atual ou ano atual."},{status:400});
 const {error}=await auth.supabase.from("businesses").update(parsed.data).eq("id",auth.businessId);
 if(error)return NextResponse.json({error:"Não foi possível salvar o período de agendamento."},{status:500});
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
