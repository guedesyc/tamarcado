import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdminAccess, recordAdminAudit } from "@/lib/admin-auth";
import { RESERVED_SLUGS } from "@/lib/domain";
import { AdminMfa } from "@/components/admin-mfa";
import { AdminPreviewGenerator } from "@/components/admin-preview-generator";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gerador de prévia | Tá Marcado", robots: { index: false, follow: false, nocache: true } };

export default async function AdminPreviewPage() {
  const access = await getPlatformAdminAccess();
  if (access.status === "denied") notFound();

  if (access.status === "needs_mfa") {
    const supabase = await createClient();
    const { data: factors } = supabase ? await supabase.auth.mfa.listFactors() : { data: null };
    return <main className="form-wrap"><AdminMfa hasVerifiedFactor={Boolean(factors?.totp.length)}/></main>;
  }

  await recordAdminAudit(access.userId, "admin.preview_generator_view", null);
  const siteHost = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tamarcado.ygsystems.com.br").host;

  return <main className="wrap" style={{ maxWidth: 1200, paddingTop: 28, paddingBottom: 80 }}>
    <Link href="/admin" style={{ fontSize: 13, color: "var(--green2)" }}>← Voltar ao painel</Link>
    <span className="eyebrow" style={{ display: "block", marginTop: 14 }}>Prospecção</span>
    <h1 className="serif" style={{ fontSize: 40, margin: "10px 0 4px" }}>Gerador de prévia</h1>
    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, marginBottom: 22 }}>Monte como ficaria a página de uma profissional e baixe a imagem para mandar no Instagram. Nada é salvo nem publicado.</p>
    <AdminPreviewGenerator siteHost={siteHost} reservedSlugs={[...RESERVED_SLUGS]}/>
  </main>;
}
