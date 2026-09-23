import Link from "next/link";
import { ArrowRight, Clock3, MapPin, Scissors } from "lucide-react";

const services = [
  { name: "Box braids", detail: "A partir de 4 horas", price: "A partir de R$ 220,00" },
  { name: "Nagô", detail: "A partir de 2 horas", price: "A partir de R$ 100,00" },
  { name: "Twist", detail: "Duração combinada", price: "A partir de R$ 180,00" },
];

export default function ExampleBraiderPage() {
  return <main className="wrap" style={{ maxWidth: 760 }}>
    <header className="public-header"><Link className="brand" href="/"><span className="brand-mark">t</span><span>tá marcado</span></Link><span className="pill">Exemplo de página pública</span></header>
    <section style={{ paddingTop: 15 }}><div className="profile-hero"/><div className="profile-info"><span className="profile-avatar">AM</span><span className="eyebrow">Tranças · Salvador</span><h1 className="serif" style={{ fontSize: 38, margin: "8px 0" }}>Ana Martins</h1><p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 13px" }}>Tranças feitas com carinho e atenção a cada detalhe. Vamos encontrar o estilo ideal para você?</p><span style={{ fontSize: 12, color: "var(--muted)" }}><MapPin size={14}/> Salvador, BA</span></div></section>
    <section className="section" style={{ padding: "42px 0 80px" }}><span className="eyebrow">Um cuidado pensado para você</span><h2 className="serif" style={{ fontSize: 34, margin: "10px 0 5px" }}>Serviços</h2><p style={{ fontSize: 13, color: "var(--muted)" }}>Um exemplo de como os serviços aparecem na página de uma profissional.</p><div className="service-list">{services.map(service=><article className="service-card" key={service.name}><span className="service-thumb"><Scissors size={23}/></span><div className="service-text"><b>{service.name}</b><small><Clock3 size={12}/> {service.detail}</small></div><div className="service-price">{service.price}<small>valor estimado</small></div><a className="btn small" href="#sobre-o-exemplo">Ver exemplo <ArrowRight size={13}/></a></article>)}</div><p id="sobre-o-exemplo" className="trial-box" style={{ marginTop: 22 }}>Esta é uma demonstração visual. Para testar solicitações e horários reais, primeiro é preciso configurar o Supabase e publicar um perfil.</p></section>
  </main>;
}
