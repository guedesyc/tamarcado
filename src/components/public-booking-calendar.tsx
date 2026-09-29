"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Day = { date: string; available: boolean };
type Answer = { question_id: string; option_ids: string[]; value?: string | number | boolean };

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function PublicBookingCalendar({ slug, serviceId, answers, minDate, maxDate, value, onChange }: {
  slug: string; serviceId: string; answers: Answer[]; minDate?: string; maxDate?: string;
  value: string; onChange: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => (value || minDate || todayKey()).slice(0, 7));
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const answersKey = useMemo(() => JSON.stringify(answers), [answers]);
  const minMonth = (minDate || todayKey()).slice(0, 7);
  // Until the booking window loads, keep the calendar in the current month.
  const maxMonth = maxDate?.slice(0, 7) ?? minMonth;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ slug, serviceId, month, answers: answersKey });
    fetch(`/api/availability?${params}`, { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error("Não foi possível consultar este mês.");
        if (active) setDays(result.days ?? []);
      })
      .catch(() => { if (active) setDays([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, serviceId, month, answersKey]);

  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const offset = (first.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index - offset + 1, 12));
    return { key: date.toISOString().slice(0, 10), number: date.getUTCDate(), inside: date.getUTCMonth() === monthNumber - 1 };
  });
  const available = new Map(days.map(day => [day.date, day.available]));
  const title = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1, 12)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, monthNumber, 1, 12)).toISOString().slice(0, 7);
  const changeMonth = (nextMonth: string) => { setLoading(true); setDays([]); setMonth(nextMonth); };

  return <section className="public-booking-calendar" aria-label="Calendário de agendamento">
    <div className="public-calendar-heading">
      <button className="pill" type="button" aria-label="Mês anterior" disabled={month <= minMonth} onClick={() => changeMonth(previous)}><ChevronLeft size={16}/></button>
      <h2>{title}</h2>
      <button className="pill" type="button" aria-label="Próximo mês" disabled={month >= maxMonth} onClick={() => changeMonth(next)}><ChevronRight size={16}/></button>
    </div>
    <div className="public-calendar-grid">
      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(label => <span className="calendar-weekday" key={label}>{label}</span>)}
      {cells.map(cell => {
        const inRange = (!minDate || cell.key >= minDate) && (!maxDate || cell.key <= maxDate);
        const hasAvailability = available.get(cell.key) === true;
        const disabled = !cell.inside || !inRange || loading || !hasAvailability;
        return <button type="button" key={cell.key}
          className={`public-calendar-day${cell.inside ? "" : " outside"}${!hasAvailability && !loading && cell.inside && inRange ? " unavailable" : ""}${value === cell.key ? " selected" : ""}`}
          aria-label={`${cell.key}${hasAvailability ? ", horários disponíveis" : ", sem horários livres"}`}
          aria-pressed={value === cell.key} disabled={disabled} onClick={() => onChange(cell.key)}>
          <b>{cell.number}</b>{cell.inside && <small>{loading ? " " : hasAvailability ? "Disponível" : inRange ? "Sem vagas" : ""}</small>}
        </button>;
      })}
    </div>
    <p className="public-calendar-help">{loading ? "Verificando os dias com horários livres…" : "Os dias opacos não têm horários disponíveis."}</p>
  </section>;
}
