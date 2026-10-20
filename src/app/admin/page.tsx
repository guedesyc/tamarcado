import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdminAccess, recordAdminAudit } from "@/lib/admin-auth";
import { stripeIsLiveMode } from "@/lib/stripe";
import { AdminMfa } from "@/components/admin-mfa";
import {
  FREE_QUOTA, ONBOARDING_LABELS, PENDING_KEYS, PENDING_LABELS, filterProfessionals, funnel, lastAccess,
  onboardingStage, parsePendingFilter, pendingItems, subscriptionActive, type ProfessionalRow,
} from "@/lib/admin-overview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin | Tá Marcado", robots: { index: false, follow: false, nocache: true } };

const NOTICES: Record<string, string> = {
  reenviado: "E-mail de confirmação reenviado.",
  "ja-confirmado": "Esse e-mail já está confirmado.",
  "erro-reenvio": "Não foi possível reenviar o e-mail agora. Tente de novo em alguns minutos.",
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const formatDate = (value: string | null) => (value ? dateFormat.format(new Date(value)) : "—");
const formatDateTime = (value: string | null) => (value ? dateTimeFormat.format(new Date(value)) : "Nunca");

function subscriptionLabel(row: ProfessionalRow, liveMode: boolean) {
  if (subscriptionActive(row, liveMode)) return "Ativa";
  if (!row.subscription_status || row.subscription_status === "trial") return "Sem assinatura";
  const labels: Record<string, string> = { active: "Ativa (outro modo Stripe)", past_due: "Pagamento atrasado", cancelled: "Cancelada", incomplete: "Incompleta" };
  return labels[row.subscription_status] ?? row.subscription_status;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getPlatformAdminAccess();
  if (access.status === "denied") notFound();

  if (access.status === "needs_mfa") {
    const supabase = await createClient();
    const { data: factors } = supabase ? await supabase.auth.mfa.listFactors() : { data: null };
    return <main className="form-wrap"><AdminMfa hasVerifiedFactor={Boolean(factors?.totp.length)}/></main>;
  }

  const admin = createAdminClient();
  if (!admin) notFound();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const pending = parsePendingFilter(params.pendencia);
  const notice = typeof params.aviso === "string" ? NOTICES[params.aviso] : undefined;

  const { data, error } = await admin.rpc("admin_platform_professionals");
  const rows = (data ?? []) as ProfessionalRow[];
  const now = new Date();
  const liveMode = stripeIsLiveMode();
  const visible = filterProfessionals(rows, { query, pending, now, liveMode });
  const steps = funnel(rows, liveMode);
  const pendingCounts = Object.fromEntries(PENDING_KEYS.map(key => [key, rows.filter(row => pendingItems(row, now, liveMode).includes(key)).length]));
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tamarcado.ygsystems.com.br";

  // The search text is not stored: it may contain an e-mail address.
  await recordAdminAudit(access.userId, "admin.platform_view", null, { pending_filter: pending, searched: Boolean(query), results: visible.length });

  return <main className="wrap" style={{ maxWidth: 1400, paddingTop: 28, paddingBottom: 80 }}>
    <span className="eyebrow">Somente leitura</span>
    <h1 className="serif" style={{ fontSize: 40, margin: "10px 0 4px" }}>Painel da plataforma</h1>
    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>Profissionais cadastradas e onde cada uma parou. Dados das clientes aparecem só como números.</p>
    {notice && <p className="pill" role="status">{notice}</p>}
    {error && <p className="pill" role="alert">Não foi possível carregar os dados. Confira se as migrations do painel foram aplicadas.</p>}

    <section aria-label="Funil" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, margin: "22px 0" }}>
      {steps.map(step => <article className="stat-card" key={step.label}>
        <span className="stat-label">{step.label}</span>
        <div className="stat-value">{step.count}</div>
        <span className="stat-note">{rows.length ? `${Math.round((step.count / rows.length) * 100)}% dos cadastros` : "—"}</span>
      </article>)}
    </section>

    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Pendências</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link className="pill" href="/admin" style={{ fontWeight: pending ? 400 : 700 }}>Todas ({rows.length})</Link>
        {PENDING_KEYS.map(key => <Link className="pill" key={key} href={`/admin?pendencia=${key}`} style={{ fontWeight: pending === key ? 700 : 400 }}>{PENDING_LABELS[key]} ({pendingCounts[key]})</Link>)}
      </div>
      <form method="get" action="/admin" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        <input name="q" defaultValue={query} placeholder="Buscar por nome, e-mail, negócio ou link" aria-label="Buscar profissional" style={{ flex: "1 1 260px", padding: "9px 12px" }}/>
        <select name="pendencia" defaultValue={pending ?? ""} aria-label="Filtrar por pendência" style={{ padding: "9px 12px" }}>
          <option value="">Todas as pendências</option>
          {PENDING_KEYS.map(key => <option key={key} value={key}>{PENDING_LABELS[key]}</option>)}
        </select>
        <button className="btn small" type="submit">Filtrar</button>
      </form>
    </section>

    <section className="panel">
      <div className="panel-title">Profissionais ({visible.length})</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ textAlign: "left", color: "var(--muted)" }}>
            {["Profissional", "Página", "Cadastro", "Último acesso", "E-mail", "Onboarding", "Grátis", "Assinatura", "Último pedido", "Pendências", "Ações"].map(label => <th key={label} style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{label}</th>)}
          </tr></thead>
          <tbody>
            {visible.map(row => {
              const items = pendingItems(row, now, liveMode);
              const pageUrl = row.slug && row.published_at ? `${baseUrl}/${row.slug}` : null;
              return <tr key={row.user_id} style={{ borderTop: "1px solid #0000000f", verticalAlign: "top" }}>
                <td style={{ padding: "8px 6px", minWidth: 180 }}><b>{row.full_name ?? "Sem nome"}</b><br/><span style={{ color: "var(--muted)", overflowWrap: "anywhere" }}>{row.email ?? "—"}</span>{row.business_name && <><br/><small>{row.business_name}</small></>}</td>
                <td style={{ padding: "8px 6px" }}>{row.slug ? (pageUrl ? <a href={pageUrl} target="_blank" rel="noreferrer">/{row.slug}</a> : <span>/{row.slug} (rascunho)</span>) : "—"}</td>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{formatDate(row.signed_up_at)}</td>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{formatDateTime(lastAccess(row))}</td>
                <td style={{ padding: "8px 6px" }}>{row.email_confirmed_at ? "Confirmado" : "Pendente"}</td>
                <td style={{ padding: "8px 6px" }}>{ONBOARDING_LABELS[onboardingStage(row)]}<br/><small style={{ color: "var(--muted)" }}>{row.active_services_count} serviço(s) · {row.availability_rules_count} horário(s)</small></td>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{Math.min(row.free_quota_used, FREE_QUOTA)}/{FREE_QUOTA}</td>
                <td style={{ padding: "8px 6px" }}>{subscriptionLabel(row, liveMode)}</td>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{formatDate(row.last_request_at)}<br/><small style={{ color: "var(--muted)" }}>{row.public_requests_count} pedido(s)</small></td>
                <td style={{ padding: "8px 6px", minWidth: 160 }}>{items.length ? items.map(key => <span className="pill" key={key} style={{ display: "inline-block", margin: "0 4px 4px 0", fontSize: 11 }}>{PENDING_LABELS[key]}</span>) : "—"}</td>
                <td style={{ padding: "8px 6px", minWidth: 150 }}>
                  {!row.email_confirmed_at && <form method="post" action="/api/admin/resend-confirmation" style={{ marginBottom: 6 }}>
                    <input type="hidden" name="userId" value={row.user_id}/>
                    <button className="btn small" type="submit">Reenviar confirmação</button>
                  </form>}
                  {pageUrl && <a href={pageUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Abrir página <ExternalLink size={12}/></a>}
                </td>
              </tr>;
            })}
            {!visible.length && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Nenhuma profissional encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </main>;
}
