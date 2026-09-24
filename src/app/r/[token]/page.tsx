import Link from "next/link";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock3, MessageCircle } from "lucide-react";
import { BookingControls } from "@/components/booking-controls";

export const dynamic = "force-dynamic";

export default async function BookingStatus({ params }: { params: Promise<{ token: string }> }) {
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();
 const supabase=await createClient();
 if(!supabase) return <main className="form-wrap"><section className="form-card"><span className="eyebrow">Acompanhamento</span><h1>Seu pedido está protegido.</h1><p>Estamos preparando o acompanhamento online. Guarde este link para voltar a ele.</p><Link className="btn" href="/ana-trancas">Voltar à página</Link></section></main>;
 const tokenHash=createHash("sha256").update(token).digest("hex");
 const {data,error}=await supabase.rpc("get_public_booking",{p_token_hash:tokenHash});
 if(error||!data) notFound();
 const booking=data as {service_name:string;requested_at:string;status:string;business_name:string;slug:string;timezone:string;note?:string;payment_status:string;signal_amount_cents:number|null;signal_deadline:string|null;pix_key:string|null;pix_holder:string|null;client_phone:string;professional_phone:string};
 const statusLabel=booking.payment_status==="signal_requested"?"Aguardando sinal":booking.payment_status==="signal_reported"?"Pagamento informado":booking.payment_status==="signal_expired"?"Prazo do sinal encerrado":booking.payment_status==="partial"?"Confirmado":({requested:"Aguardando resposta",under_review:"Em análise",proposed:"A profissional fez uma proposta",confirmed:"Confirmado",cancelled_by_client:"Cancelado",cancelled_by_professional:"Cancelado pela profissional",expired:"Solicitação expirada",completed:"Concluído",no_show:"Não compareceu"} as Record<string,string>)[booking.status]??"Em atualização";
 const money=(cents:number|null)=>cents===null?"—":`R$ ${(cents/100).toFixed(2).replace(".",",")}`;
 return <main className="form-wrap"><section className="form-card"><span className="eyebrow">Seu atendimento</span><h1>Pedido para {booking.business_name}.</h1><p>Acompanhe por este link. Você não precisa criar uma conta.</p><div className="trial-box"><div className="trial-top"><span>{booking.service_name}</span><span className="status">{statusLabel}</span></div><p style={{marginTop:12}}><CalendarDays size={14}/> {new Intl.DateTimeFormat("pt-BR",{dateStyle:"full",timeStyle:"short",timeZone:booking.timezone||"America/Sao_Paulo"}).format(new Date(booking.requested_at))}</p></div>{booking.note&&<p>{booking.note}</p>}{["signal_requested","signal_reported"].includes(booking.payment_status)&&<div className="trial-box"><b>Dados para o sinal</b><p>Valor: <strong>{money(booking.signal_amount_cents)}</strong></p><p>Pix ({booking.pix_holder}): <strong>{booking.pix_key}</strong></p><p>O sinal é pago diretamente à profissional. Após pagar, toque em “Já fiz o Pix”; a confirmação só acontece depois da conferência do extrato.</p></div>}<BookingControls token={token} status={booking.status} paymentStatus={booking.payment_status as "unpaid"|"partial"|"paid"|"refunded"|"not_applicable"|"signal_requested"|"signal_reported"|"signal_expired"} slug={booking.slug} service={booking.service_name} professionalPhone={booking.professional_phone??""} requestedAt={booking.requested_at} signalDeadline={booking.signal_deadline}/><div style={{marginTop:22}}><Link className="btn secondary" href={`/${booking.slug}`}><MessageCircle size={15}/> Voltar à página</Link></div><p style={{fontSize:11,color:"var(--muted)"}}><Clock3 size={13}/> Guarde este link para consultar alterações.</p></section></main>;
}
