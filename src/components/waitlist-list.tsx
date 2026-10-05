import { WaitlistActions } from "@/components/waitlist-actions";

type Entry = { id: string; status: string; customer_name: string; customer_phone: string; preferred_date: string | null; note: string | null; created_at: string; services: { name: string } | { name: string }[] | null };

export function WaitlistList({ entries, businessName, timeZone }: { entries: Entry[]; businessName: string; timeZone: string }) {
  return <section className="panel">{entries.map(entry => {
    const service = Array.isArray(entry.services) ? entry.services[0]?.name : entry.services?.name;
    const preferredDate = entry.preferred_date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.preferred_date}T12:00:00Z`)) : "Sem data específica";
    const created = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(entry.created_at));
    return <article className="appointment-row waitlist-row" key={entry.id}>
      <div className="row-main"><b>{entry.customer_name}</b><small>{entry.customer_phone} · {service ?? "Serviço removido"} · Preferência: {preferredDate}</small>{entry.note && <small>{entry.note}</small>}<small>Entrou em {created}</small></div>
      <WaitlistActions id={entry.id} status={entry.status} name={entry.customer_name} phone={entry.customer_phone} service={service ?? "serviço"} businessName={businessName} preferredDate={entry.preferred_date}/>
    </article>;
  })}</section>;
}
