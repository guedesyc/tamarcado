export const TRAINING_URL = "https://drive.google.com/file/d/1962DKSxeOobRxfTl3OwTy94iJDwtxWx0/view?usp=sharing";

export const workspaceLinks = [
  ["Início", "/app"],
  ["Agenda", "/app/agenda"],
  ["Solicitações", "/app/solicitacoes"],
  ["Clientes", "/app/clientes"],
  ["Lista de espera", "/app/espera"],
  ["Serviços", "/app/servicos"],
  ["Perguntas para clientes", "/app/perguntas"],
  ["Financeiro", "/app/financeiro"],
  ["Portfólio", "/app/portfolio"],
  ["Minha página", "/app/minha-pagina"],
  ["Configurações", "/app/configuracoes"],
  ["Assinatura", "/app/assinatura"],
  ["Treinamento", TRAINING_URL],
] as const;

export function isExternalWorkspaceLink(href: string) {
  return href === TRAINING_URL;
}
