import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AsaasCustomer={id?:string;errors?:{description?:string}[]};type AsaasCheckout={id?:string;link?:string;url?:string;errors?:{description?:string}[]};

export async function POST(){
 const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Entre na sua conta para continuar."},{status:401});
 const {data:{user}}=await supabase.auth.getUser();if(!user?.email)return NextResponse.json({error:"Adicione um e-mail à sua conta antes de assinar."},{status:400});
 const {data:member}=await supabase.from("business_members").select("business_id").eq("user_id",user.id).limit(1).maybeSingle();if(!member)return NextResponse.json({error:"Seu espaço não foi encontrado."},{status:404});
 const apiKey=process.env.ASAAS_API_KEY;const admin=createAdminClient();if(!apiKey||!admin)return NextResponse.json({error:"A assinatura ainda não foi configurada para este ambiente."},{status:503});
 const apiBase=(process.env.ASAAS_API_BASE_URL??"https://api-sandbox.asaas.com/v3").replace(/\/$/,"");const {data:business}=await supabase.from("businesses").select("id,name,contact_phone").eq("id",member.business_id).single();if(!business)return NextResponse.json({error:"Seu espaço não foi encontrado."},{status:404});
 const {data:existing}=await admin.from("subscription_records").select("id,provider_customer_id,status").eq("business_id",business.id).maybeSingle();
 let customerId=existing?.provider_customer_id;
 try{
  if(!customerId){const customerResponse=await fetch(`${apiBase}/customers`,{method:"POST",headers:{"content-type":"application/json",access_token:apiKey},body:JSON.stringify({name:business.name,email:user.email,phone:business.contact_phone||undefined,externalReference:business.id}),cache:"no-store"});const customer=await customerResponse.json() as AsaasCustomer;if(!customerResponse.ok||!customer.id)throw new Error(customer.errors?.[0]?.description??"Não foi possível iniciar o checkout.");customerId=customer.id}
  const today=new Date();today.setDate(today.getDate()+1);const nextDueDate=`${today.toISOString().slice(0,10)} 12:00:00`;
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL??new URL("http://localhost:3000").origin;
  const checkoutBody={billingTypes:["CREDIT_CARD"],chargeTypes:["RECURRENT"],minutesToExpire:60,customer:customerId,externalReference:business.id,callback:{successUrl:`${siteUrl}/app/assinatura?checkout=retorno`,cancelUrl:`${siteUrl}/app/assinatura?checkout=cancelado`,expiredUrl:`${siteUrl}/app/assinatura?checkout=expirado`},items:[{name:"Tá Marcado · Plano mensal",description:"Agenda e página profissional do Tá Marcado",quantity:1,value:49.99}],subscription:{cycle:"MONTHLY",nextDueDate}};
  const checkoutResponse=await fetch(`${apiBase}/checkouts`,{method:"POST",headers:{"content-type":"application/json",access_token:apiKey},body:JSON.stringify(checkoutBody),cache:"no-store"});const checkout=await checkoutResponse.json() as AsaasCheckout;if(!checkoutResponse.ok||!checkout.id)throw new Error(checkout.errors?.[0]?.description??"Não foi possível criar o checkout.");
  const checkoutUrl=checkout.link??checkout.url??`https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;
  const {error}=await admin.from("subscription_records").upsert({business_id:business.id,provider:"asaas",provider_customer_id:customerId,provider_checkout_id:checkout.id,status:"incomplete",price_cents:2990,updated_at:new Date().toISOString()},{onConflict:"business_id"});if(error)throw new Error("O checkout foi criado, mas não conseguimos registrar sua tentativa. Tente novamente.");
  return NextResponse.json({url:checkoutUrl},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const safeMessage=error instanceof Error?error.message:"Não foi possível iniciar sua assinatura.";return NextResponse.json({error:safeMessage},{status:502})}
}
