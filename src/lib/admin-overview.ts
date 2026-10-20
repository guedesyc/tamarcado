/** Pure helpers for the platform admin panel. No imports, so tests can load this file directly. */

export type ProfessionalRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  signed_up_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  business_id: string | null;
  business_name: string | null;
  slug: string | null;
  published_at: string | null;
  active_services_count: number;
  availability_rules_count: number;
  public_requests_count: number;
  last_request_at: string | null;
  free_quota_used: number;
  subscription_provider: string | null;
  subscription_status: string | null;
  subscription_livemode: boolean | null;
};

export const PENDING_KEYS = ["email_unconfirmed", "no_services", "no_hours", "no_requests", "trial_exhausted", "payment_failed", "inactive"] as const;
export type PendingKey = typeof PENDING_KEYS[number];

export const PENDING_LABELS: Record<PendingKey, string> = {
  email_unconfirmed: "E-mail não confirmado (+24h)",
  no_services: "Sem serviços",
  no_hours: "Sem horários",
  no_requests: "Nenhum pedido",
  trial_exhausted: "Grátis esgotado sem assinatura",
  payment_failed: "Pagamento falhou",
  inactive: "Sem acesso há +14 dias",
};

export type OnboardingStage = "account" | "draft" | "published";
export const ONBOARDING_LABELS: Record<OnboardingStage, string> = { account: "Só conta criada", draft: "Espaço em rascunho", published: "Página publicada" };

export const FREE_QUOTA = 5;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function lastAccess(row: ProfessionalRow): string | null {
  const candidates = [row.last_seen_at, row.last_sign_in_at].filter((value): value is string => Boolean(value));
  if (!candidates.length) return null;
  return candidates.reduce((latest, value) => (new Date(value) > new Date(latest) ? value : latest));
}

export function onboardingStage(row: ProfessionalRow): OnboardingStage {
  if (!row.business_id) return "account";
  return row.published_at ? "published" : "draft";
}

/** Matches the app rule: a Stripe record in the current Stripe mode with status "active". */
export function subscriptionActive(row: ProfessionalRow, liveMode: boolean): boolean {
  return row.subscription_provider === "stripe" && row.subscription_livemode === liveMode && row.subscription_status === "active";
}

export function pendingItems(row: ProfessionalRow, now: Date, liveMode: boolean): PendingKey[] {
  const items: PendingKey[] = [];
  const time = now.getTime();
  if (!row.email_confirmed_at && time - new Date(row.signed_up_at).getTime() > DAY) items.push("email_unconfirmed");
  if (row.active_services_count === 0) items.push("no_services");
  if (row.availability_rules_count === 0) items.push("no_hours");
  if (row.public_requests_count === 0) items.push("no_requests");
  const active = subscriptionActive(row, liveMode);
  if (row.free_quota_used >= FREE_QUOTA && !active) items.push("trial_exhausted");
  if (row.subscription_status === "past_due" || row.subscription_status === "incomplete") items.push("payment_failed");
  const seen = lastAccess(row);
  if (!seen || time - new Date(seen).getTime() > 14 * DAY) items.push("inactive");
  return items;
}

export type FunnelStep = { label: string; count: number };

export function funnel(rows: ProfessionalRow[], liveMode: boolean): FunnelStep[] {
  const count = (predicate: (row: ProfessionalRow) => boolean) => rows.filter(predicate).length;
  return [
    { label: "Cadastros", count: rows.length },
    { label: "E-mail confirmado", count: count(row => Boolean(row.email_confirmed_at)) },
    { label: "Primeiro serviço", count: count(row => row.active_services_count > 0) },
    { label: "Horários configurados", count: count(row => row.availability_rules_count > 0) },
    { label: "Primeiro pedido", count: count(row => row.public_requests_count > 0) },
    { label: `${FREE_QUOTA} atendimentos`, count: count(row => row.free_quota_used >= FREE_QUOTA) },
    { label: "Assinatura ativa", count: count(row => subscriptionActive(row, liveMode)) },
  ];
}

export function parsePendingFilter(value: unknown): PendingKey | null {
  return typeof value === "string" && (PENDING_KEYS as readonly string[]).includes(value) ? (value as PendingKey) : null;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function filterProfessionals(rows: ProfessionalRow[], options: { query?: string; pending?: PendingKey | null; now: Date; liveMode: boolean }) {
  const query = normalize((options.query ?? "").trim());
  return rows.filter(row => {
    if (options.pending && !pendingItems(row, options.now, options.liveMode).includes(options.pending)) return false;
    if (!query) return true;
    return [row.full_name, row.email, row.business_name, row.slug].some(value => value && normalize(value).includes(query));
  });
}
