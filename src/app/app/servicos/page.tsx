import { BrandLogo } from "@/components/brand-logo";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ServiceManager } from "@/components/service-manager";
import { ServiceCatalogManager } from "@/components/service-catalog-manager";

type Service = { id: string; name: string; description: string | null; base_price_cents: number | null; base_duration_minutes: number | null; buffer_minutes: number; booking_mode: string; active: boolean; simultaneous_capacity: number; photos: {id:string;storage_path:string;alt_text:string}[] };
const links = [["Início", "/app"], ["Agenda", "/app/agenda"], ["Solicitações", "/app/solicitacoes"], ["Clientes", "/app/clientes"], ["Serviços", "/app/servicos"], ["Perguntas para clientes", "/app/perguntas"], ["Financeiro", "/app/financeiro"], ["Portfólio", "/app/portfolio"], ["Minha página", "/app/minha-pagina"], ["Configurações", "/app/configuracoes"], ["Assinatura", "/app/assinatura"]];

export default async function ServicesPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: membership } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/app/onboarding");
  const [{ data }, { data: photos }] = await Promise.all([
    supabase.from("services").select("id,name,description,base_price_cents,base_duration_minutes,buffer_minutes,booking_mode,active,simultaneous_capacity").eq("business_id", membership.business_id).order("created_at"),
    supabase.from("portfolio_items").select("id,service_id,storage_path,alt_text").eq("business_id", membership.business_id).eq("is_public", true).order("position"),
  ]);
  const services = (data ?? []).map(service => ({ ...service, photos: (photos ?? []).filter(photo => photo.service_id === service.id) })) as Service[];
  const storageBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/app"><BrandLogo /></Link><div className="side-label" style={{ marginTop: 25 }}>Seu espaço</div>{links.map(([name, url]) => <Link className={`side-link ${name === "Serviços" ? "active" : ""}`} href={url} key={url}>{name}</Link>)}</aside>
    <main className="app-main"><header className="app-top"><span style={{ fontSize: 13, color: "var(--muted)" }}>Seu espaço de atendimento</span></header>
      <div className="app-content"><div className="dash-heading"><div><span className="eyebrow">Seu catálogo</span><h1>Serviços</h1><p>O que você faz, do seu jeito.</p></div><ServiceManager/></div>
        <ServiceCatalogManager services={services} storageBaseUrl={storageBaseUrl}/>
      </div>
    </main>
    <nav className="mobile-nav">{links.slice(0, 5).map(([name, url]) => <Link className={name === "Serviços" ? "active" : ""} href={url} key={url}>{name}</Link>)}</nav>
  </div>;
}
