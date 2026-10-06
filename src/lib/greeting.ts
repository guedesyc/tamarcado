export function greetingForHour(hour: number) {
  const normalizedHour = ((Math.trunc(hour) % 24) + 24) % 24;
  if (normalizedHour >= 18 || normalizedHour < 5) {
    return { text: "Boa noite", emoji: "🌙" };
  }
  if (normalizedHour >= 12) {
    return { text: "Boa tarde", emoji: "☀️" };
  }
  return { text: "Bom dia", emoji: "☀️" };
}
