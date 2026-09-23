import { z } from "zod";

export const RESERVED_SLUGS = new Set([
  "admin", "app", "api", "login", "logout", "cadastro", "entrar", "esqueci-senha", "senha", "auth", "precos", "ajuda", "suporte", "termos", "privacidade", "configuracoes", "financeiro", "agenda", "r"
]);

export const bookingSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  phone: z.string().trim().min(10, "Informe um WhatsApp válido.").max(20),
  serviceId: z.string().uuid(),
  date: z.string().min(1),
  time: z.string().min(1),
  note: z.string().max(500).optional()
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type BookingState = "requested" | "under_review" | "proposed" | "confirmed" | "cancelled_by_client" | "cancelled_by_professional" | "expired" | "completed" | "no_show";

const transitions: Record<BookingState, readonly BookingState[]> = {
  requested: ["under_review", "proposed", "confirmed", "cancelled_by_client", "cancelled_by_professional", "expired"],
  under_review: ["proposed", "confirmed", "cancelled_by_client", "cancelled_by_professional", "expired"],
  proposed: ["confirmed", "requested", "cancelled_by_client", "cancelled_by_professional", "expired"],
  confirmed: ["completed", "no_show", "cancelled_by_client", "cancelled_by_professional"],
  cancelled_by_client: [], cancelled_by_professional: [], expired: [], completed: [], no_show: []
};

export function canTransition(from: BookingState, to: BookingState): boolean {
  return transitions[from].includes(to);
}

export function calculateService(basePriceCents: number, baseDurationMinutes: number, modifiers: { priceCents: number; durationMinutes: number }[]) {
  if (!Number.isSafeInteger(basePriceCents) || basePriceCents < 0 || !Number.isSafeInteger(baseDurationMinutes) || baseDurationMinutes < 1) {
    throw new Error("Invalid service base values");
  }
  return modifiers.reduce((total, modifier) => ({
    priceCents: total.priceCents + modifier.priceCents,
    durationMinutes: total.durationMinutes + modifier.durationMinutes
  }), { priceCents: basePriceCents, durationMinutes: baseDurationMinutes });
}

export function trialMessage(completedPublicBookings: number): string | null {
  if (completedPublicBookings === 8) return "Você já realizou 8 atendimentos pelo Tá Marcado 🎉 Restam 2 atendimentos gratuitos. Depois disso, continue usando sua agenda por R$ 29,90/mês.";
  if (completedPublicBookings === 10) return "10 atendimentos. Tá funcionando. 💛 Continue recebendo agendamentos e cuidando da sua agenda por R$ 29,90/mês.";
  return null;
}

export function publicBookingsPaused(count: number, subscriptionActive: boolean): boolean {
  return count >= 10 && !subscriptionActive;
}
