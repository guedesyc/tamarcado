import { BrandLogo } from "@/components/brand-logo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "@/components/booking-form";

type Question={id:string;label:string;type:"single_choice"|"multiple_choice"|"text"|"number"|"boolean"|"note";required:boolean;options:{id:string;label:string;price_delta_cents:number;duration_delta_minutes:number}[]};type Service={id:string;name:string;price:number|null;duration:number|null;questions:Question[]};type Profile={id:string;slug:string;name:string;services:Service[]};
const blocked=new Set(["admin","app","api","login","logout","cadastro","entrar","esqueci-senha","senha","precos","ajuda","suporte","termos","privacidade","configuracoes","financeiro","agenda","r","auth"]);

export default async function PublicBooking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{servico?:string}>}){
 const [{slug},{servico}]=await Promise.all([params,searchParams]);if(blocked.has(slug))notFound();const supabase=await createClient();if(!supabase)notFound();
 const {data}=await supabase.rpc("get_public_profile",{p_slug:slug});if(!data)notFound();const profile=data as Profile;const service=profile.services.find(item=>item.name===servico)??profile.services[0];if(!service)notFound();
 return <main className="form-wrap"><div style={{width:"min(100%,550px)"}}><Link className="brand" href={`/${slug}`} style={{margin:"0 0 18px 4px"}}><BrandLogo /></Link><BookingForm selectedService={service.name} serviceId={service.id} slug={slug} basePriceCents={service.price} baseDurationMinutes={service.duration} questions={service.questions??[]}/></div></main>;
}
