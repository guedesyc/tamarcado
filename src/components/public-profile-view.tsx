import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ServicePhotoCarousel } from "@/components/service-photo-carousel";

export type PortfolioPhoto = { path: string; alt: string };
export type PublicService = { id: string; name: string; description: string; price: number | null; price_from: boolean; duration: number | null; mode: string; questions: unknown[]; portfolio: PortfolioPhoto[] };
export type PublicProfile = { id: string; slug: string; name: string; business_name?: string; description: string; neighborhood: string | null; city: string | null; state: string | null; avatar_path: string | null; cover_path: string | null; categories: string[]; services: PublicService[]; portfolio: PortfolioPhoto[] };

type Props = {
  profile: PublicProfile;
  /** Storage base URL for image paths. Empty string means paths are already full URLs (admin preview). */
  imageBaseUrl: string;
  headerActions?: ReactNode;
  /** Admin preview: links become inert and booking buttons are disabled, so nothing is requested. */
  preview?: boolean;
};

/** Visual part of the public profile page (`/[slug]`), shared with the admin preview generator. */
export function PublicProfileView({ profile, imageBaseUrl, headerActions, preview = false }: Props) {
  const imageUrl = (path: string) => (imageBaseUrl ? `${imageBaseUrl}/${path}` : path);
  const location = [profile.neighborhood, profile.city, profile.state].filter(Boolean).join(", ");
  const title = profile.business_name || profile.name;

  return <main className="wrap" style={{ maxWidth: 760 }}>
    <header className="public-header">{preview ? <span className="brand"><BrandLogo /></span> : <Link className="brand" href="/"><BrandLogo /></Link>}<div style={{ display: "flex", alignItems: "center", gap: 8 }}>{headerActions}{preview ? <span className="btn small secondary">Conheça o Tá Marcado <ArrowRight size={14}/></span> : <Link className="btn small secondary" href="/">Conheça o Tá Marcado <ArrowRight size={14}/></Link>}</div></header>
    <section style={{ paddingTop: 15 }}><div className="profile-hero">{profile.cover_path && <img className="profile-cover-image" src={imageUrl(profile.cover_path)} alt={`Capa de ${title}`}/>}</div><div className="profile-info">{profile.avatar_path && <img className="profile-business-logo" src={imageUrl(profile.avatar_path)} alt={`Logo de ${title}`}/>}<span className="eyebrow">{profile.categories.join(" · ")}</span><h1 className="serif" style={{ fontSize: 38, margin: "8px 0" }}>{title}</h1><p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 13px" }}>{profile.description}</p>{location && <span style={{ fontSize: 12, color: "var(--muted)" }}><MapPin size={14}/> {location}</span>}</div></section>
    {profile.portfolio.length > 0 && <section style={{ paddingTop: 36 }}><span className="eyebrow">Um pouco do meu trabalho</span><div className="public-portfolio">{profile.portfolio.map((item, index) => <img key={`${item.path}-${index}`} src={imageUrl(item.path)} alt={item.alt || "Trabalho de portfólio"} loading="lazy"/>)}</div></section>}
    <section className="section" style={{ padding: "42px 0 80px" }}><span className="eyebrow">Um cuidado pensado para você</span><h2 className="serif" style={{ fontSize: 34, margin: "10px 0 5px" }}>Serviços</h2><p style={{ fontSize: 13, color: "var(--muted)" }}>Escolha um serviço para ver os detalhes e horários disponíveis.</p>
      {profile.services.length ? <div className="public-service-grid">{profile.services.map(service => <article className="public-service-card" key={service.id}>
        <ServicePhotoCarousel images={service.portfolio ?? []} baseUrl={imageBaseUrl}/>
        <div className="service-text"><b>{service.name}</b>{service.description && <p className="public-service-description">{service.description}</p>}</div>
        <div className="public-service-details">
          <small style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock3 size={13}/> {service.duration ? `${Math.floor(service.duration / 60)}h${service.duration % 60 ? ` ${service.duration % 60}min` : ""}` : "Duração combinada com a profissional"}</small>
          <div className="service-price">{service.price === null ? "A combinar" : `${service.price_from ? "A partir de " : ""}R$ ${(service.price / 100).toFixed(2).replace(".", ",")}`}<small>valor estimado</small></div>
        </div>
        {preview
          ? <span className="btn" aria-disabled="true">Quero Marcar! <ArrowRight size={15}/></span>
          : <Link aria-label={`Quero marcar ${service.name}`} href={`/${profile.slug}/agendar?servico=${encodeURIComponent(service.name)}`} className="btn">Quero Marcar! <ArrowRight size={15}/></Link>}
      </article>)}</div> : <p className="trial-box">A profissional está preparando os serviços. Volte em breve.</p>}
      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>Preço e duração podem variar conforme suas escolhas. A profissional confirma tudo com você.</p>
    </section>
  </main>;
}
