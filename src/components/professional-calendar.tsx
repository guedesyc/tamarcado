import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

type Appointment = {
  id: string; status: string; payment_status: string; start_at: string; end_at: string;
  service_name_snapshot: string; clients: { name: string; phone: string } | { name: string; phone: string }[] | null;
};
type Block = { id: string; starts_at: string; ends_at: string; kind: string; label: string | null };

function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function clientName(appointment: Appointment) {
  return Array.isArray(appointment.clients) ? appointment.clients[0]?.name : appointment.clients?.name;
}

export function ProfessionalCalendar({ month, today, selectedDay, timeZone, appointments, blocks }: {
  month: string; today: string; selectedDay?: string; timeZone: string; appointments: Appointment[]; blocks: Block[];
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index - startOffset + 1, 12));
    return { date, key: date.toISOString().slice(0, 10), inside: date.getUTCMonth() === monthNumber - 1 };
  });
  const selectedDate = selectedDay && selectedDay.startsWith(`${month}-`) ? selectedDay : cells.find(cell => cell.inside && cell.key >= today)?.key ?? `${month}-01`;
  const selectedAppointments = appointments.filter(item => dateKey(new Date(item.start_at), timeZone) === selectedDate);
  const selectedBlocks = blocks.filter(item => dateKey(new Date(item.starts_at), timeZone) <= selectedDate && dateKey(new Date(item.ends_at), timeZone) >= selectedDate);
  const title = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1, 12)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, monthNumber, 1, 12)).toISOString().slice(0, 7);
  const visibleAppointments = selectedAppointments.filter(item => !["cancelled_by_client", "cancelled_by_professional", "expired"].includes(item.status));

  return <div className="professional-calendar">
    <section className="panel">
      <div className="calendar-month-heading">
        <Link className="pill" aria-label="Mês anterior" href={`/app/agenda?mes=${previous}`}><ChevronLeft size={16}/></Link>
        <h2>{title}</h2>
        <Link className="pill" aria-label="Próximo mês" href={`/app/agenda?mes=${next}`}><ChevronRight size={16}/></Link>
      </div>
      <div className="professional-calendar-grid" role="grid" aria-label={`Agenda de ${title}`}>
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(label => <span className="calendar-weekday" key={label}>{label}</span>)}
        {cells.map(({ date, key, inside }) => {
          const dayAppointments = appointments.filter(item => dateKey(new Date(item.start_at), timeZone) === key && !["cancelled_by_client", "cancelled_by_professional", "expired"].includes(item.status));
          const count = dayAppointments.length;
          const blocked = blocks.some(item => dateKey(new Date(item.starts_at), timeZone) <= key && dateKey(new Date(item.ends_at), timeZone) >= key);
          const hasPending = dayAppointments.some(item => item.status !== "confirmed" || ["signal_requested", "signal_reported"].includes(item.payment_status));
          const hasConfirmed = dayAppointments.some(item => item.status === "confirmed" && !["signal_requested", "signal_reported"].includes(item.payment_status));
          return <Link className={`professional-calendar-day${inside ? "" : " outside"}${key < today ? " past" : ""}${key === today ? " today" : ""}${blocked ? " has-block" : ""}${hasPending ? " has-pending" : ""}${hasConfirmed ? " has-confirmed" : ""}`} key={key} href={`/app/agenda?mes=${month}&dia=${key}`} aria-label={`${date.getUTCDate()}${count ? `, ${count} atendimento(s)` : ""}${blocked ? ", bloqueio de agenda" : ""}${hasPending ? ", falta confirmar ou conferir sinal" : ""}${hasConfirmed ? ", atendimento confirmado" : ""}`}>
            <b>{date.getUTCDate()}</b>
            {count > 0 && <small>{count} atend.</small>}
            <span className="calendar-day-markers">{hasConfirmed && <i className="calendar-marker-confirmed" title="Atendimento confirmado"/>}{hasPending && <i className="calendar-marker-pending" title="Pendente de ação"/>}{blocked && <i className="calendar-marker-block" title="Bloqueio neste dia"/>}</span>
          </Link>;
        })}
      </div>
      <div className="calendar-legend"><span><i className="calendar-legend-event"/> Confirmado</span><span><i className="calendar-legend-pending"/> Pendente / sinal</span><span><i className="calendar-legend-block"/> Bloqueio</span></div>
    </section>
    <section className="panel calendar-day-detail">
      <div className="panel-title">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${selectedDate}T12:00:00Z`))}</div>
      {selectedBlocks.map(block => <div className="calendar-entry blocked-entry" key={block.id}><b>{block.label || "Horário bloqueado"}</b><small>{new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(block.starts_at))}–{new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(block.ends_at))}</small></div>)}
      {visibleAppointments.map(item => { const pendingSignal = ["signal_requested", "signal_reported"].includes(item.payment_status); const className = item.status !== "confirmed" ? "calendar-request-pending" : pendingSignal ? (item.payment_status === "signal_reported" ? "calendar-signal-reported" : "calendar-signal-pending") : "calendar-confirmed"; return <article className={`calendar-entry ${className}`} key={item.id}>
        <b>{new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone }).format(new Date(item.start_at))} · {clientName(item) || "Cliente"}</b>
        <small>{item.service_name_snapshot} · {item.payment_status === "signal_requested" ? "Aguardando sinal" : item.payment_status === "signal_reported" ? "Sinal informado · falta conferir" : item.status === "confirmed" ? "Confirmado" : "Aguardando confirmação"}</small>
        <span className={`status ${className}`}>{item.payment_status === "signal_requested" ? "Aguardando sinal" : item.payment_status === "signal_reported" ? "Conferir sinal" : item.status === "confirmed" ? "Confirmado" : "Pendente"}</span>
      </article>;})}
      {!selectedBlocks.length && !visibleAppointments.length && <p className="calendar-empty"><Clock3 size={16}/> Nenhum atendimento ou bloqueio neste dia.</p>}
    </section>
  </div>;
}
