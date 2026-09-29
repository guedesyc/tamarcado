import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema=z.object({simultaneousCapacity:z.number().int().min(1).max(50)});
const activeSchema=z.object({active:z.boolean()});

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível alterar o serviço deste endereço."},{status:403});
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Serviço inválido."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira a capacidade informada."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"A capacidade deve estar entre 1 e 50."},{status:400});
 const {error}=await supabase.rpc("update_service_capacity",{p_service_id:id,p_capacity:parsed.data.simultaneousCapacity});
 if(error){const conflict=error.message.includes("CAPACITY_BELOW_CURRENT");return NextResponse.json({error:conflict?"A capacidade não pode ficar abaixo dos atendimentos já confirmados nesse período.":"Não foi possível atualizar a capacidade do serviço."},{status:conflict?409:400})}
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível alterar o serviço deste endereço."},{status:403});
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Serviço inválido."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Confira o estado do serviço."},{status:400})}
 const parsed=activeSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Estado de serviço inválido."},{status:400});
 const {data:member}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).limit(1).maybeSingle();if(!member)return NextResponse.json({error:"Seu espaço não foi encontrado."},{status:404});
 const {data,error}=await supabase.from("services").update({active:parsed.data.active}).eq("id",id).eq("business_id",member.business_id).select("id").maybeSingle();
 if(error||!data)return NextResponse.json({error:"Não foi possível atualizar este serviço."},{status:400});
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível remover o serviço deste endereço."},{status:403});
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Serviço inválido."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:member}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).limit(1).maybeSingle();if(!member)return NextResponse.json({error:"Seu espaço não foi encontrado."},{status:404});
 const {count,error:countError}=await supabase.from("portfolio_items").select("id",{count:"exact",head:true}).eq("business_id",member.business_id).eq("service_id",id);
 if(countError)return NextResponse.json({error:"Não foi possível verificar as fotos deste serviço."},{status:500});
 if((count??0)>0)return NextResponse.json({error:"Este serviço tem fotos no portfólio. Desvincule-as ou remova-as antes de excluir o serviço."},{status:409});
 const {error}=await supabase.from("services").delete().eq("id",id).eq("business_id",member.business_id);
 if(error)return NextResponse.json({error:"Não foi possível excluir o serviço. Se houver atendimentos anteriores, prefira inativá-lo."},{status:409});
 return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
