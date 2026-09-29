/** Convert a strict HH:MM value to the integer minutes stored by the API. */
export function durationToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  return minutes < 60 && total >= 1 && total <= 1440 ? total : null;
}

/** Signed duration for modifiers (for example +00:30 or -00:15); 00:00 is valid. */
export function durationDeltaToMinutes(value: string): number | null {
  const match = /^([+-]?)(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const total = hours * 60 + minutes;
  if (minutes >= 60 || total > 1440) return null;
  return match[1] === "-" ? -total : total;
}

export function minutesToDuration(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 1440) throw new RangeError("Invalid duration");
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function formatDurationDelta(value: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}${minutesToDuration(Math.abs(value))}`;
}
