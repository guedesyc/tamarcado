/** Builds the in-memory profile used by the admin preview generator. No imports, so tests can load it directly. */

export type PreviewServiceInput = { id: string; name: string; price: string; duration: string; photo: string | null };
export type PreviewInput = { name: string; specialty: string; slug: string; description: string; avatar: string | null; services: PreviewServiceInput[] };

export const MAX_PREVIEW_SERVICES = 4;

/** Same rules as the onboarding slug: lowercase ASCII words joined by hyphens, up to 40 characters. */
export function slugify(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/g, "");
}

/** "120", "120,50", "R$ 1.200,00" → cents. Empty or invalid → null ("A combinar"). */
export function parsePriceCents(value: string): number | null {
  const cleaned = value.replace(/[^\d,.]/g, "");
  if (!cleaned) return null;
  const thousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(cleaned);
  const normalized = cleaned.includes(",") || thousandsOnly ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export function parseDurationMinutes(value: string): number | null {
  const minutes = Number.parseInt(value, 10);
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 1440 ? minutes : null;
}

export function buildPreviewProfile(input: PreviewInput) {
  const name = input.name.trim() || "Seu nome aqui";
  return {
    id: "preview",
    slug: slugify(input.slug) || slugify(input.name) || "seu-nome",
    name,
    business_name: name,
    description: input.description.trim(),
    neighborhood: null,
    city: null,
    state: null,
    avatar_path: input.avatar,
    cover_path: null,
    categories: input.specialty.trim() ? [input.specialty.trim()] : [],
    portfolio: [],
    services: input.services.slice(0, MAX_PREVIEW_SERVICES).filter(service => service.name.trim()).map(service => ({
      id: service.id,
      name: service.name.trim(),
      description: "",
      price: parsePriceCents(service.price),
      price_from: false,
      duration: parseDurationMinutes(service.duration),
      mode: "approval",
      questions: [],
      portfolio: service.photo ? [{ path: service.photo, alt: service.name.trim() }] : [],
    })),
  };
}
