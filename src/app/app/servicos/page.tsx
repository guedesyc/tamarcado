import { BrandLogo } from "@/components/brand-logo";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Scissors, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ServiceManager } from "@/components/service-manager";
import { ServiceCapacityEditor } from "@/components/service-capacity-editor";
import { ServiceActions } from "@/components/service-actions";

type Service = { id: string; name: string; description: string; base_price_cents: number | null; base_duration_minutes: number | null; buffer_minutes: number; booking_mode: string; active: boolean; simultaneous_capacity: number };
const links = [["Início", "/app"], ["Agenda", "/app/agenda"], ["Solicitações", "/app/solicitacoes"], ["Clientes", "/app/clientes"], ["Serviços", "/app/servicos"], ["Financeiro", "/app/financeiro"], ["Portfólio", "/app/portfolio"], ["Minha página", "/app/minha-pagina"], ["Configurações", "/app/configuracoes"], ["Assinatura", "/app/assinatura"]];

export default async function ServicesPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: membership } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/app/onboarding");
  const { data } = await supabase.from("services").select("id,name,description,base_price_cents,base_duration_minutes,buffer_minutes,booking_mode,active,simultaneous_capacity").eq("business_id", membership.business_id).order("created_at");
  const services = (data ?? []) as Service[];

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/app"><BrandLogo /></Link><div className="side-label" style={{ marginTop: 25 }}>Seu espaço</div>{links.map(([name, url]) => <Link className={`side-link ${name === "Serviços" ? "active" : ""}`} href={url} key={url}>{name}</Link>)}</aside>
    <main className="app-main"><header className="app-top"><span style={{ fontSize: 13, color: "var(--muted)" }}>Seu espaço de atendimento</span></header>
      <div className="app-content"><div className="dash-heading"><div><span className="eyebrow">Seu catálogo</span><h1>Serviços</h1><p>O que você faz, do seu jeito.</p></div><ServiceManager/></div>
        {services.length ? <div className="service-list">{services.map(service => <article className="service-card" key={service.id}>
          <span className="service-thumb"><Scissors size={22}/></span>
          <div className="service-text"><b>{service.name}</b><small>{service.description || "Sem descrição"}</small></div>
          <div className="service-price">{service.base_price_cents === null ? "A combinar" : `R$ ${(service.base_price_cents / 100).toFixed(2).replace(".", ",")}`}<small><Clock3 size={12}/> {service.base_duration_minutes ? `${service.base_duration_minutes} min` : "Duração flexível"}{service.buffer_minutes ? ` + ${service.buffer_minutes} min de intervalo` : ""}</small><ServiceCapacityEditor serviceId={service.id} initialCapacity={service.simultaneous_capacity ?? 1}/></div>
          <span className="status">{service.active ? service.booking_mode === "instant" ? "Automático" : service.booking_mode === "evaluation" ? "Avaliação" : "Aprovação" : "Inativo"}</span>
          <ServiceActions serviceId={service.id} active={service.active}/>
        </article>)}</div> : <section className="panel" style={{ textAlign: "center", padding: 45 }}><Scissors size={25} color="var(--green2)"/><h2 className="serif" style={{ fontSize: 28 }}>Seu primeiro serviço</h2><p style={{ fontSize: 13, color: "var(--muted)" }}>Adicione um serviço para que suas clientes saibam como marcar com você.</p></section>}
      </div>
    </main>
    <nav className="mobile-nav">{links.slice(0, 5).map(([name, url]) => <Link className={name === "Serviços" ? "active" : ""} href={url} key={url}>{name}</Link>)}</nav>
  </div>;
}
