import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

export const metadata = { title: "Política de Privacidade" };

export default function Privacy() {
  return <main className="wrap" style={{ maxWidth: 820, paddingTop: 35, paddingBottom: 90 }}>
    <Link className="brand" href="/"><BrandLogo /></Link>
    <span className="eyebrow" style={{ display: "block", marginTop: 50 }}>Privacidade · transparência</span>
    <h1 className="serif" style={{ fontSize: 52 }}>Seus dados pedem cuidado.</h1>
    <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>Este aviso descreve o funcionamento atual do Tá Marcado e ainda precisa de revisão jurídica. O contato para suporte e solicitações sobre dados é contato@ygsystems.com.br. Os prazos de retenção por categoria ainda precisam ser formalmente definidos.</p>

    <h2>Dados tratados</h2>
    <p>Para profissionais: dados de acesso, nome, e-mail, contato, informações do negócio, serviços, horários, agenda, configuração Pix e registros básicos de assinatura. Para clientes: nome, telefone/WhatsApp, serviço e horário solicitados, respostas às perguntas do serviço, observações e justificativa de cancelamento. O agendamento não exige conta de cliente; a criação de novas contas está temporariamente desativada. Não armazenamos dados de cartão no Tá Marcado.</p>
    <p>Ao pedir entrada na lista de espera, a cliente informa nome, WhatsApp, serviço, uma data de preferência opcional e observação opcional. O pedido não reserva horário e não gera contato automático.</p>
    <p>Fotos de logo, capa e portfólio são enviadas pela profissional. No envio, o sistema remove metadados comuns de localização e identificação incorporados em JPEG, PNG e WebP. Imagens associadas a uma página publicada podem ser acessíveis publicamente; obtenha autorização de pessoas identificáveis que apareçam nelas.</p>

    <h2>Finalidade e contato</h2>
    <p>Usamos dados para fornecer agendamento, autenticar profissionais, proteger contas, manter o histórico do atendimento, operar a assinatura profissional e cumprir obrigações aplicáveis. Os dados da lista de espera são usados pela profissional para avaliar uma possível vaga e, se fizer sentido, iniciar manualmente uma conversa pelo WhatsApp. O sistema não envia lembretes ou mensagens automáticas.</p>

    <h2>Visibilidade e acesso</h2>
    <p>Nome do negócio, descrição, serviços, portfólio autorizado e região aproximada podem aparecer na página pública. Telefone da cliente, observações internas, lista de espera e endereço residencial não são públicos. O acesso à lista é restrito ao espaço profissional correspondente.</p>
    <p>O app usa Supabase para autenticação, banco e imagens; Hostinger para hospedagem do sistema; e Stripe para dados necessários à assinatura profissional. Ao escolher abrir uma mensagem preparada no WhatsApp, você sai do Tá Marcado e passa a interagir com esse serviço externo. Os pagamentos de atendimento/sinal são combinados diretamente entre cliente e profissional; não passam pelo Stripe.</p>

    <h2>Armazenamento, segurança e retenção</h2>
    <p>Aplicamos controle de acesso por negócio, políticas de banco, validação no servidor, tokens de acompanhamento guardados como hash e limitação de tentativas em rotas públicas. O limitador mantém contadores no processo ativo e não é compartilhado entre várias instâncias. O link de acompanhamento expira à meia-noite seguinte à data acordada para o atendimento, no fuso do negócio; se a data for alterada, os links acompanham a nova data. Isso bloqueia o acesso pelo link, mas não apaga o pedido nem o histórico financeiro. A lista de espera pode ser apagada pela profissional; os demais registros não têm expurgo automático definido. Não inclua dados sensíveis nas observações ou respostas livres. Nenhuma medida elimina todo risco.</p>

    <h2>Seus direitos</h2>
    <p>Você pode solicitar acesso, correção ou exclusão dos dados pelo e-mail <a href="mailto:contato@ygsystems.com.br">contato@ygsystems.com.br</a>, observadas as hipóteses legais de conservação. O vencimento do link não apaga o atendimento: informações podem ser necessárias para executar o serviço, prestar suporte e manter registros financeiros. Os prazos aplicáveis e o processo de análise de cada pedido ainda precisam ser formalizados.</p>
    <p style={{ marginTop: 35, fontSize: 12, color: "var(--muted)" }}>Última atualização: 6 de outubro de 2026. Canal de contato informado; prazos de retenção e processo operacional de direitos ainda pendentes.</p>
  </main>;
}
