import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS } from "@/lib/domain";
import { isSameSiteOrigin } from "@/lib/request-origin";

const schema=z.object({name:z.string().trim().min(2).max(120),displayName:z.string().trim().min(2).max(120),phone:z.string().trim().min(10).max(40),categories:z.array(z.string()).min(1).max(8),service:z.string().trim().min(2).max(120),price:z.coerce.number().min(0).max(100000).finite(),duration:z.coerce.number().int().min(15).max(1440),description:z.string().max(500).default(""),start:z.string().regex(/^\d\d:\d\d$/),end:z.string().regex(/^\d\d:\d\d$/),city:z.string().max(100).optional()});
const fieldLabels:Record<string,string>={name:"nome do negócio",displayName:"nome profissional",phone:"WhatsApp",categories:"categoria",service:"serviço inicial",price:"preço",duration:"duração",description:"descrição",start:"início do expediente",end:"fim do expediente",city:"cidade ou região"};

function slugFromBusinessName(name:string){
 const slug=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40).replace(/-+$/g,"");
 return slug.length>=3?slug:"meu-espaco";
}

async function availableBusinessSlug(base:string,supabase:NonNullable<Awaited<ReturnType<typeof createClient>>>,currentBusinessId?:string){
 for(let suffix=1;suffix<=100;suffix++){
  const ending=suffix===1?"":`-${suffix}`;
  const candidate=`${base.slice(0,40-ending.length).replace(/-+$/g,"")}${ending}`;
  if(RESERVED_SLUGS.has(candidate))continue;
  const {data,error}=await supabase.from("businesses").select("id").eq("slug",candidate).maybeSingle();
  if(error)return null;
  if(!data||data.id===currentBusinessId)return candidate;
 }
 return null;
}

export async function POST(request:Request){
 if(!isSameSiteOrigin(request))return NextResponse.json({error:"Não foi possível criar o espaço desta página."},{status:403});
 let input:unknown;try{input=await request.json()}catch{return NextResponse.json({error:"Confira as informações e tente novamente."},{status:400})}
 const parsed=schema.safeParse(input);
 if(!parsed.success){const invalidFields=[...new Set(parsed.error.issues.map(issue=>fieldLabels[String(issue.path[0])]??"informações"))];return NextResponse.json({error:`Confira ${invalidFields.join(", ")} e tente novamente.`},{status:400})}
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"A configuração do espaço ainda não está disponível."},{status:503});
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const value=parsed.data;
 const { data: memberships } = await supabase.from("business_members").select("business_id").eq("user_id",user.id).eq("role","owner");
 const businessIds=(memberships??[]).map(row=>row.business_id);
 const { data: ownedBusinesses } = businessIds.length ? await supabase.from("businesses").select("id,slug,published_at,created_at").in("id",businessIds).order("created_at",{ascending:false}) : {data:[]};
 const draft=(ownedBusinesses??[]).find(business=>!business.published_at);
 const generatedSlug=await availableBusinessSlug(slugFromBusinessName(value.name),supabase,draft?.id);
 if(!generatedSlug)return NextResponse.json({error:"Não foi possível gerar um endereço para sua página. Tente novamente."},{status:503});
 const [neighborhood,...cityParts]=(value.city??"").split(",").map(part=>part.trim());
 let businessId=draft?.id;
 if(businessId){
  const {error}=await supabase.from("businesses").update({name:value.name,slug:generatedSlug,contact_phone:value.phone,public_neighborhood:neighborhood||null,public_city:cityParts.join(", ")||neighborhood||null}).eq("id",businessId).select("id").maybeSingle();
  if(error)return NextResponse.json({error:"Não foi possível atualizar o espaço que já começou a ser configurado."},{status:500});
 }else{
  const {data,error}=await supabase.rpc("create_business_setup",{p_business_name:value.name,p_slug:generatedSlug,p_display_name:value.displayName,p_category_slugs:value.categories});
  if(error||!data)return NextResponse.json({error:error?.code==="23505"?"Esse endereço já está em uso. Escolha outro.":"Não foi possível criar seu espaço. Confira o endereço e tente novamente."},{status:409});
  businessId=data;
 }
 const {error:profileError}=await supabase.from("professional_profiles").upsert({business_id:businessId,display_name:value.displayName,bio:value.description},{onConflict:"business_id"});
 if(profileError)return NextResponse.json({error:"Não foi possível salvar os dados profissionais. Tente publicar novamente."},{status:500});
 const {error:removeCategoriesError}=await supabase.from("business_categories").delete().eq("business_id",businessId);
 if(removeCategoriesError)return NextResponse.json({error:"Não foi possível atualizar as categorias do espaço."},{status:500});
 const {data:categoryRows,error:categoryLookupError}=await supabase.from("categories").select("id,slug").in("slug",value.categories).eq("active",true);
 if(categoryLookupError||(categoryRows??[]).length!==value.categories.length)return NextResponse.json({error:"Uma das categorias escolhidas não está disponível. Volte e selecione novamente."},{status:400});
 const {error:categoryInsertError}=await supabase.from("business_categories").insert(categoryRows!.map(category=>({business_id:businessId,category_id:category.id})));
 if(categoryInsertError)return NextResponse.json({error:"Não foi possível atualizar as categorias do espaço."},{status:500});
 const {data:existingService,error:serviceLookupError}=await supabase.from("services").select("id").eq("business_id",businessId).order("created_at").limit(1).maybeSingle();
 if(serviceLookupError)return NextResponse.json({error:"Não foi possível verificar o serviço inicial. Tente novamente."},{status:500});
 const serviceValue={name:value.service,base_price_cents:Math.round(value.price*100),base_duration_minutes:value.duration,booking_mode:"approval" as const,active:true};
 const serviceResult=existingService
  ? await supabase.from("services").update(serviceValue).eq("id",existingService.id).eq("business_id",businessId)
  : await supabase.from("services").insert({business_id:businessId,...serviceValue});
 if(serviceResult.error)return NextResponse.json({error:"Não conseguimos salvar o serviço inicial. Revise os dados e tente novamente."},{status:500});
 const {error:clearAvailabilityError}=await supabase.from("availability_rules").delete().eq("business_id",businessId);
 if(clearAvailabilityError)return NextResponse.json({error:"Não foi possível atualizar os horários iniciais."},{status:500});
 const {error:availabilityError}=await supabase.from("availability_rules").insert([1,2,3,4,5].map(weekday=>({business_id:businessId,weekday,start_time:value.start,end_time:value.end})));
 if(availabilityError)return NextResponse.json({error:"Não foi possível salvar os horários iniciais. Revise os horários e tente novamente."},{status:500});
 const {data:published,error:publishError}=await supabase.from("businesses").update({published_at:new Date().toISOString()}).eq("id",businessId).select("id,slug,published_at").maybeSingle();
 if(publishError||!published?.published_at)return NextResponse.json({error:"Os dados foram salvos, mas a página ainda não foi publicada. Tente novamente."},{status:500});
 return NextResponse.json({ok:true,url:`/${published.slug}`},{status:201});
}
