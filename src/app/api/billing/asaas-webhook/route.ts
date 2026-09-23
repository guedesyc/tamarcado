import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AsaasEvent={id?:string;event?:string;payment?:{subscription?:string;externalReference?:string};subscription?:{id?:string;externalReference?:string};checkout?:{id?:string;externalReference?:string}};

export async function POST(request:Request){
 const expected=process.env.ASAAS_WEBHOOK_TOKEN;const received=request.headers.get("asaas-access-token")??"";
 if(!expected||received.length!==expected.length||!timingSafeEqual(Buffer.from(received),Buffer.from(expected)))return NextResponse.json({error:"Não autorizado."},{status:401});
 let event:AsaasEvent;try{event=await request.json() as AsaasEvent}catch{return NextResponse.json({error:"Evento inválido."},{status:400})}
 if(!event.id||!event.event)return NextResponse.json({error:"Evento inválido."},{status:400});const admin=createAdminClient();if(!admin)return NextResponse.json({error:"Webhook indisponível."},{status:503});
 const {error:insertError}=await admin.from("asaas_webhook_events").insert({event_id:event.id,event_type:event.event,payload:event});
 if(insertError){if(insertError.code!=="23505")return NextResponse.json({error:"Não foi possível registrar o evento."},{status:500});const {data:previous}=await admin.from("asaas_webhook_events").select("processed_at").eq("event_id",event.id).maybeSingle();if(previous?.processed_at)return NextResponse.json({ok:true,duplicate:true})}
 const businessId=event.checkout?.externalReference??event.subscription?.externalReference??event.payment?.externalReference;
 if(businessId&&/^[0-9a-f-]{36}$/i.test(businessId)){
  let updateError=null;
  if(event.event==="CHECKOUT_PAID"||event.event==="PAYMENT_CONFIRMED"||event.event==="PAYMENT_RECEIVED"){
   const {error}=await admin.from("subscription_records").upsert({business_id:businessId,provider:"asaas",provider_checkout_id:event.checkout?.id??null,provider_subscription_id:event.subscription?.id??event.payment?.subscription??null,status:"active",price_cents:2990,updated_at:new Date().toISOString()},{onConflict:"business_id"});updateError=error;
  }else if(event.event==="SUBSCRIPTION_CREATED"){
   const {error}=await admin.from("subscription_records").update({provider_subscription_id:event.subscription?.id??null,updated_at:new Date().toISOString()}).eq("business_id",businessId);updateError=error;
  }else if(["PAYMENT_OVERDUE","SUBSCRIPTION_INACTIVATED","SUBSCRIPTION_DELETED"].includes(event.event)){
   const {error}=await admin.from("subscription_records").update({status:event.event==="PAYMENT_OVERDUE"?"past_due":"cancelled",updated_at:new Date().toISOString()}).eq("business_id",businessId);updateError=error;
  }
  if(updateError)return NextResponse.json({error:"Não foi possível atualizar a assinatura."},{status:500});
 }
 await admin.from("asaas_webhook_events").update({processed_at:new Date().toISOString()}).eq("event_id",event.id);
 return NextResponse.json({ok:true});
}
