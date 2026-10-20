import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicProfileView, type PublicProfile } from "@/components/public-profile-view";

const reserved = new Set(["admin", "app", "api", "login", "logout", "cadastro", "entrar", "esqueci-senha", "senha", "precos", "ajuda", "suporte", "termos", "privacidade", "configuracoes", "financeiro", "agenda", "r", "auth", "minha-agenda"]);

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (reserved.has(slug)) notFound();
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data, error } = await supabase.rpc("get_public_profile", { p_slug: slug });
  if (error || !data) notFound();
  const profile = data as PublicProfile;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ownerMembership } = user ? await supabase.from("business_members").select("business_id").eq("business_id", profile.id).eq("user_id", user.id).maybeSingle() : { data: null };
  const isOwner = Boolean(ownerMembership);
  const portfolioBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio`;

  return <PublicProfileView profile={profile} imageBaseUrl={portfolioBaseUrl} headerActions={<>{user && <Link className="btn small secondary" href="/minha-agenda">Minha agenda</Link>}{isOwner && <><Link className="btn small secondary" href="/app">Meu painel</Link><Link className="btn small secondary" href="/app/configuracoes">Configurações</Link></>}</>}/>;
}
