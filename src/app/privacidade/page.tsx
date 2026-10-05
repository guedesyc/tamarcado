import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

export const metadata = { title: "Política de Privacidade" };

export default function Privacy() {
  return <main className="wrap" style={{ maxWidth: 820, paddingTop: 35, paddingBottom: 90 }}>
    <Link className="brand" href="/"><BrandLogo /></Link>
    <span className="eyebrow" style={{ display: "block", marginTop: 50 }}>Privacidade · versão inicial</span>
    <h1 className="serif" style={{ fontSize: 52 }}>Seus dados pedem cuidado.</h1>
    <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>Este texto é uma base informativa, não substitui revisão jurídica. Antes do lançamento, o controlador deve completar seus dados, operadores, prazos de retenção e canal de privacidade, e revisar o documento com assessoria apropriada.</p>

    <h2>Dados tratados</h2>
    <p>Para profissionais: dados de acesso, nome profissional, contato, serviços, horários, agenda e registros financeiros básicos. Para clientes: nome, telefone/WhatsApp, serviço solicitado, horário e mensagens necessárias à negociação. Não solicitamos senha de clientes.</p>
    <p>Ao pedir entrada na lista de espera, a cliente informa nome, WhatsApp, serviço, uma data de preferência opcional e observação opcional. O pedido não reserva horário e não gera contato automático.</p>

    <h2>Finalidade e contato</h2>
    <p>Usamos dados para fornecer agendamento, autenticar profissionais, proteger contas, manter o histórico solicitado e cumprir obrigações legais. Os dados da lista de espera são usados pela profissional para avaliar uma possível vaga e, se fizer sentido, iniciar manualmente uma conversa pelo WhatsApp. O sistema não envia lembretes ou mensagens automáticas.</p>

    <h2>Visibilidade e acesso</h2>
    <p>Nome do negócio, descrição, serviços, portfólio autorizado e região aproximada podem aparecer na página pública. Telefone da cliente, observações internas, lista de espera e endereço residencial não são públicos. O acesso à lista é restrito ao espaço profissional correspondente.</p>

    <h2>Armazenamento, segurança e retenção</h2>
    <p>Aplicamos controle de acesso por negócio, políticas de banco, validação no servidor e limitação de tentativas em rotas públicas. Hoje, o limitador mantém contadores apenas no processo ativo e não substitui um serviço compartilhado entre várias instâncias. Nenhuma medida elimina todo risco. Os registros da lista permanecem no histórico quando marcados como agendados ou encerrados; o prazo final de retenção e o processo de eliminação precisam ser definidos antes do lançamento. Não inclua dados sensíveis nas observações.</p>

    <h2>Seus direitos</h2>
    <p>Você pode solicitar acesso, correção ou exclusão dos dados, observadas retenções legais e necessidades de segurança. O canal oficial para essas solicitações ainda precisa ser publicado antes da abertura do serviço.</p>
    <p style={{ marginTop: 35, fontSize: 12, color: "var(--muted)" }}>Última atualização: 4 de outubro de 2026.</p>
  </main>;
}
