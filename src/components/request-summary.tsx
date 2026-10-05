import { CalendarDays, Clock3, Scissors } from "lucide-react";

export function RequestSummary({ name, requestedAt, receivedAt, service, timeZone, paymentStatus }: {
  name: string; requestedAt: string | null | undefined; receivedAt: string | null | undefined;
  service: string | null | undefined; timeZone: string; paymentStatus?: string | null;
}) {
  const format = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
  return <div className="row-main request-summary">
    <b>{name}</b>
    <div className="request-summary-facts">
      {requestedAt && <span><CalendarDays size={15}/><span><small>Atendimento</small>{format(requestedAt)}</span></span>}
      {service && <span><Scissors size={15}/><span><small>Serviço</small>{service}</span></span>}
      {receivedAt && <span><Clock3 size={15}/><span><small>Pedido recebido</small>{format(receivedAt)}</span></span>}
    </div>
    {paymentStatus === "signal_requested" && <span className="request-summary-note">Aguardando sinal da cliente</span>}
    {paymentStatus === "signal_reported" && <span className="request-summary-note">Cliente informou o pagamento do sinal</span>}
  </div>;
}
