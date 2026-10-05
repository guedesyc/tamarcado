import { BrandLogo } from "@/components/brand-logo";
import { ServicePhotoCarousel } from "@/components/service-photo-carousel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PortfolioPhoto = { path: string; alt: string };
type PublicService = { id: string; name: string; description: string; price: number | null; price_from: boolean; duration: number | null; mode: string; questions: unknown[]; portfolio: PortfolioPhoto[] };
type Profile = { id: string; slug: string; name: string; business_name?: string; description: string; neighborhood: string | null; city: string | null; state: string | null; avatar_path: string | null; cover_path: string | null; categories: string[]; services: PublicService[]; portfolio: PortfolioPhoto[] };
const reserved = new Set(["admin", "app", "api", "login", "logout", "cadastro", "entrar", "esqueci-senha", "senha", "precos", "ajuda", "suporte", "termos", "privacidade", "configuracoes", "financeiro", "agenda", "r", "auth", "minha-agenda"]);

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (reserved.has(slug)) notFound();
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data, error } = await supabase.rpc("get_public_profile", { p_slug: slug });
  if (error || !data) notFound();
  const profile = data as Profile;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ownerMembership } = user ? await supabase.from("business_members").select("business_id").eq("business_id", profile.id).eq("user_id", user.id).maybeSingle() : { data: null };
  const isOwner = Boolean(ownerMembership);
  const location = [profile.neighborhood, profile.city, profile.state].filter(Boolean).join(", ");
  const portfolioBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio`;

  return <main className="wrap" style={{ maxWidth: 760 }}>
    <header className="public-header"><Link className="brand" href="/"><BrandLogo /></Link><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{user && <Link className="btn small secondary" href="/minha-agenda">Minha agenda</Link>}{isOwner && <><Link className="btn small secondary" href="/app">Meu painel</Link><Link className="btn small secondary" href="/app/configuracoes">Configurações</Link></>}<Link className="btn small secondary" href="/">Conheça o Tá Marcado <ArrowRight size={14}/></Link></div></header>
    <section style={{ paddingTop: 15 }}><div className="profile-hero">{profile.cover_path && <img className="profile-cover-image" src={`${portfolioBaseUrl}/${profile.cover_path}`} alt={`Capa de ${profile.business_name || profile.name}`}/>}</div><div className="profile-info">{profile.avatar_path && <img className="profile-business-logo" src={`${portfolioBaseUrl}/${profile.avatar_path}`} alt={`Logo de ${profile.business_name || profile.name}`}/>}<span className="eyebrow">{profile.categories.join(" · ")}</span><h1 className="serif" style={{ fontSize: 38, margin: "8px 0" }}>{profile.business_name || profile.name}</h1><p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 13px" }}>{profile.description}</p>{location && <span style={{ fontSize: 12, color: "var(--muted)" }}><MapPin size={14}/> {location}</span>}</div></section>
    {profile.portfolio.length > 0 && <section style={{ paddingTop: 36 }}><span className="eyebrow">Um pouco do meu trabalho</span><div className="public-portfolio">{profile.portfolio.map((item, index) => <img key={`${item.path}-${index}`} src={`${portfolioBaseUrl}/${item.path}`} alt={item.alt || "Trabalho de portfólio"} loading="lazy"/>)}</div></section>}
    <section className="section" style={{ padding: "42px 0 80px" }}><span className="eyebrow">Um cuidado pensado para você</span><h2 className="serif" style={{ fontSize: 34, margin: "10px 0 5px" }}>Serviços</h2><p style={{ fontSize: 13, color: "var(--muted)" }}>Escolha um serviço para ver os detalhes e horários disponíveis.</p>
      {profile.services.length ? <div className="public-service-grid">{profile.services.map(service => <article className="public-service-card" key={service.id}>
        <ServicePhotoCarousel images={service.portfolio ?? []} baseUrl={portfolioBaseUrl}/>
        <div className="service-text"><b>{service.name}</b>{service.description && <p className="public-service-description">{service.description}</p>}</div>
        <div className="public-service-details">
          <small><Clock3 size={13}/> {service.duration ? `${Math.floor(service.duration / 60)}h${service.duration % 60 ? ` ${service.duration % 60}min` : ""}` : "Duração combinada com a profissional"}</small>
          <div className="service-price">{service.price === null ? "A combinar" : `${service.price_from ? "A partir de " : ""}R$ ${(service.price / 100).toFixed(2).replace(".", ",")}`}<small>valor estimado</small></div>
        </div>
        <Link aria-label={`Quero marcar ${service.name}`} href={`/${slug}/agendar?servico=${encodeURIComponent(service.name)}`} className="btn">Quero Marcar! <ArrowRight size={15}/></Link>
      </article>)}</div> : <p className="trial-box">A profissional está preparando os serviços. Volte em breve.</p>}
      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>Preço e duração podem variar conforme suas escolhas. A profissional confirma tudo com você.</p>
    </section>
  </main>;
}
