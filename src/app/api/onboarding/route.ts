import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS } from "@/lib/domain";

const schema=z.object({name:z.string().trim().min(2).max(120),displayName:z.string().trim().min(2).max(120),phone:z.string().trim().min(10).max(40),slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(40),categories:z.array(z.string()).min(1).max(8),service:z.string().trim().min(2).max(120),price:z.coerce.number().min(0).max(100000).finite(),duration:z.coerce.number().int().min(15).max(1440),description:z.string().max(500).default(""),start:z.string().regex(/^\d\d:\d\d$/),end:z.string().regex(/^\d\d:\d\d$/),city:z.string().max(100).optional()});

export async function POST(request:Request){
 let input:unknown;try{input=await request.json()}catch{return NextResponse.json({error:"Confira as informações e tente novamente."},{status:400})}
 const parsed=schema.safeParse(input);if(!parsed.success||RESERVED_SLUGS.has(parsed.data?.slug??""))return NextResponse.json({error:"Revise os campos. Esse endereço pode estar reservado."},{status:400});
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"A configuração do espaço ainda não está disponível."},{status:503});
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const value=parsed.data;
 const {data:businessId,error}=await supabase.rpc("create_business_setup",{p_business_name:value.name,p_slug:value.slug,p_display_name:value.displayName,p_category_slugs:value.categories});
 if(error||!businessId)return NextResponse.json({error:error?.message.includes("duplicate key")?"Esse endereço já está em uso. Escolha outro.":"Não foi possível criar seu espaço. Confira o endereço e tente novamente."},{status:409});
 const {error:serviceError}=await supabase.from("services").insert({business_id:businessId,name:value.service,base_price_cents:Math.round(value.price*100),base_duration_minutes:value.duration,booking_mode:"approval"});
 if(serviceError)return NextResponse.json({error:"O espaço foi criado, mas não conseguimos salvar o serviço inicial. Entre novamente para continuar."},{status:500});
 const {error:availabilityError}=await supabase.from("availability_rules").insert([1,2,3,4,5].map(weekday=>({business_id:businessId,weekday,start_time:value.start,end_time:value.end})));
 if(availabilityError)return NextResponse.json({error:"O espaço foi criado, mas não conseguimos salvar os horários iniciais."},{status:500});
 const {error:profileError}=await supabase.from("professional_profiles").update({bio:value.description}).eq("business_id",businessId);
 if(profileError)return NextResponse.json({error:"Não foi possível concluir seu perfil. Entre novamente para continuar."},{status:500});
 const [neighborhood,...cityParts]=(value.city??"").split(",").map(part=>part.trim());
 const {error:publishError}=await supabase.from("businesses").update({contact_phone:value.phone,public_neighborhood:neighborhood||null,public_city:cityParts.join(", ")||neighborhood||null,published_at:new Date().toISOString()}).eq("id",businessId);
 if(publishError)return NextResponse.json({error:"Não foi possível publicar sua página."},{status:500});
 return NextResponse.json({ok:true,url:`/${value.slug}`},{status:201});
}
