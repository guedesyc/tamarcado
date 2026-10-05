import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";
import { WaitlistList } from "@/components/waitlist-list";

const links = [["Início", "/app"], ["Agenda", "/app/agenda"], ["Solicitações", "/app/solicitacoes"], ["Clientes", "/app/clientes"], ["Lista de espera", "/app/espera"], ["Serviços", "/app/servicos"], ["Perguntas para clientes", "/app/perguntas"], ["Financeiro", "/app/financeiro"], ["Portfólio", "/app/portfolio"], ["Minha página", "/app/minha-pagina"], ["Configurações", "/app/configuracoes"], ["Assinatura", "/app/assinatura"]];
type Entry = { id: string; status: string; customer_name: string; customer_phone: string; preferred_date: string | null; preferred_time: string | null; note: string | null; created_at: string; services: { name: string } | { name: string }[] | null };

export default async function WaitlistPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/entrar");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/app/onboarding");
  const [{ data: business }, { data, error }] = await Promise.all([
    supabase.from("businesses").select("name,timezone").eq("id", member.business_id).maybeSingle(),
    supabase.from("waitlist_entries").select("id,status,customer_name,customer_phone,preferred_date,preferred_time,note,created_at,services(name)").eq("business_id", member.business_id).order("created_at", { ascending: false }).limit(100),
  ]);
  const entries = (data ?? []) as unknown as Entry[];
  const timeZone = business?.timezone || "America/Sao_Paulo";
  const message = ["42P01", "PGRST205"].includes(error?.code ?? "") ? "A lista de espera precisa ser habilitada pelo banco antes de aparecer aqui. Aplique a migration 202610040001_waitlist.sql." : error ? "Não foi possível carregar a lista. Atualize a página ou tente novamente." : "Contatos que autorizaram ser avisados se surgir uma possibilidade.";

  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/app"><BrandLogo /></Link><div className="side-label" style={{ marginTop: 25 }}>Seu espaço</div>{links.map(([name, href]) => <Link className={`side-link ${href === "/app/espera" ? "active" : ""}`} href={href} key={href}>{name}</Link>)}</aside><main className="app-main"><header className="app-top"><span style={{ fontSize: 13, color: "var(--muted)" }}>Seu espaço de atendimento</span></header><div className="app-content"><div className="dash-heading"><div><span className="eyebrow">Tá Marcado</span><h1>Lista de espera</h1><p>{message}</p></div></div>{error ? <section className="panel" role="alert"><p>{message}</p></section> : entries.length ? <WaitlistList entries={entries} businessName={business?.name ?? "seu espaço"} timeZone={timeZone}/> : <section className="panel request-empty"><h2 className="serif">Sua lista de espera está vazia</h2><p>Quando uma cliente pedir para ser avisada se surgir uma vaga, ela aparecerá aqui.</p></section>}</div></main><nav className="mobile-nav" aria-label="Navegação do espaço">{links.map(([name, href]) => <Link className={href === "/app/espera" ? "active" : ""} href={href} key={href}>{name}</Link>)}</nav></div>;
}
