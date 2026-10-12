import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
 const supabase=await createClient();
 if(!supabase) redirect("/entrar?erro=config");
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/entrar");
 const {data:memberships}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).eq("role","owner");
 const ids=(memberships??[]).map(member=>member.business_id);
 const {data:businesses}=ids.length?await supabase.from("businesses").select("id,name,slug,contact_phone,public_neighborhood,public_city,published_at,created_at").in("id",ids).order("created_at",{ascending:false}):{data:[]};
 const published=(businesses??[]).find(business=>business.published_at);
 if(published)redirect("/app");
 const draft=(businesses??[])[0];
 let initialDraft:Record<string,string>={};let initialCategories:string[]=[];
 if(draft){
  const [{data:profile},{data:service},{data:rules},{data:links}]=await Promise.all([
   supabase.from("professional_profiles").select("display_name,bio").eq("business_id",draft.id).maybeSingle(),
   supabase.from("services").select("name,base_price_cents,base_duration_minutes").eq("business_id",draft.id).order("created_at").limit(1).maybeSingle(),
   supabase.from("availability_rules").select("start_time,end_time").eq("business_id",draft.id).order("weekday").limit(1).maybeSingle(),
   supabase.from("business_categories").select("category_id").eq("business_id",draft.id)
  ]);
  const {data:categories}=links?.length?await supabase.from("categories").select("slug,name").in("id",links.map(link=>link.category_id)):{data:[]};
  const categorySlugs=["trancas","unhas","cilios","sobrancelhas","depilacao","maquiagem","cabelo","estetica"];
  const categoryNames=["Tranças","Unhas","Cílios","Sobrancelhas","Depilação","Maquiagem","Cabelo","Estética"];
  initialCategories=(categories??[]).map(category=>categoryNames[categorySlugs.indexOf(category.slug)]).filter(Boolean);
  initialDraft={display:profile?.display_name??"",business:draft.name,whatsapp:draft.contact_phone??"",slug:draft.slug,description:profile?.bio??"",city:[draft.public_neighborhood,draft.public_city].filter((value,index,array)=>value&&array.indexOf(value)===index).join(", "),service:service?.name??"",price:service?.base_price_cents===null||service?.base_price_cents===undefined?"":(service.base_price_cents/100).toFixed(2),duration:String(service?.base_duration_minutes??240),start:rules?.start_time?.slice(0,5)??"09:00",end:rules?.end_time?.slice(0,5)??"18:00"};
 }
 return <main className="form-wrap"><OnboardingForm initialName={String(user.user_metadata.full_name??"")} initialDraft={initialDraft} initialCategories={initialCategories}/></main>;
}
