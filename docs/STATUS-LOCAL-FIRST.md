# Tá Marcado — checklist local-first

Objetivo: validar os fluxos do produto no computador, sem conta externa, banco remoto ou hospedagem. A demonstração em `/demo` e `/demo/fluxo` grava dados fictícios no `localStorage` deste navegador. Ela serve para validar UX e regras, não para uso com clientes reais.

## Já construído

- [x] Landing page, identidade visual, páginas de ajuda/termos/privacidade e prévia pública de trancista.
- [x] Identidade visual da marca Tá Marcado com paleta blush/rose gold e ameixa escura para contraste; logo aplicada nas páginas e centralizada no painel e cabeçalho da demonstração.
- [x] Estrutura do produto em Next.js/TypeScript e configuração de segurança para desenvolvimento local.
- [x] Base de autenticação, onboarding, painel e APIs preparadas para Supabase (dependem de credenciais e banco para rodar).
- [x] Migrations com modelo multi-tenant, RLS, agenda, solicitações, serviços, trial, portfólio e assinatura.
- [x] Demonstração da profissional Ana: dashboard, calendário mensal, clientes, serviços, finanças ilustrativas, perfil e configurações.
- [x] Configurador local de perguntas por serviço: escolha única/múltipla, texto, número, sim/não e foto de referência (na demo, guarda apenas o nome do arquivo).
- [x] Editor local permite editar serviço, valor, duração, disponibilidade, perguntas e opções. Os controles de opção identificam o valor extra em reais e o tempo adicional em minutos; zero significa sem acréscimo, e o botão de exclusão tem tamanho compacto.
- [x] Fluxo da cliente em etapas com calendário mensal, seleção de data e horários disponíveis, perguntas e cálculo local de preço/duração a partir das opções (formato para novas opções: `nome | valor em R$ | minutos`).
- [x] Contato telefônico obrigatório com DDD e solicitação da cliente visível na visão da profissional.
- [x] Profissional pode confirmar, recusar ou propor horário, preço, duração e mensagem; a cliente pode aceitar, sugerir outro horário ou cancelar.
- [x] Histórico básico do pedido e sincronização entre as visões do fluxo via `localStorage`.
- [x] Chaves de armazenamento separadas para o painel `/demo` e o fluxo `/demo/fluxo`, evitando que os formatos de dados distintos provoquem erro de renderização/tela preta ao trocar de visão. Dados antigos do fluxo guardados na chave compartilhada anterior não são migrados automaticamente.
- [x] Verificação de TypeScript (`npm run typecheck`) passa após estas alterações.

Prompt reutilizável para a próxima etapa: `docs/PROMPT-CONTINUACAO-LOCAL-FIRST.md`.

## Falta para validar a V1 localmente, antes do banco/hospedagem

### Em andamento

- Painel `/demo`: já oferece calendário mensal para profissional e cliente; ao selecionar data exibe atendimentos ou horários disponíveis. Inclui solicitações com ID do cliente e respostas, clientes/histórico agrupados por telefone, edição de serviços, perguntas associadas a múltiplos serviços, portfólio local por serviço, expediente com domingo e pausa para almoço, bloqueios de agenda e financeiro demonstrativo calculado a partir dos atendimentos. Ainda faltam validação manual mobile/desktop, exceções de expediente, edição/cancelamento de atendimentos e revisão dos limites de armazenamento local.
- Fluxo `/demo/fluxo`: a escolha de data da cliente agora é mensal. A aba Calendário da profissional ainda precisa migrar da apresentação semanal para calendário mensal e permitir inspeção detalhada dos horários.
- O editor local já cobre os campos principais, mas ainda faltam intervalo/preparação, reordenação das perguntas/opções e validação completa dos valores e estados.

- [ ] Exercitar manualmente os fluxos em tamanhos mobile e desktop, incluindo troca entre as abas Profissional: responder e Cliente: acompanhar.
- [ ] Migrar a aba Calendário da profissional em `/demo/fluxo` para visão mensal, com resumo dos atendimentos por dia e horários ao abrir uma data.
- [ ] Completar o editor: intervalo/preparação, reordenação de perguntas e opções, validação de campos e tratamento de perguntas opcionais.
- [ ] Persistir arquivos de referência em armazenamento local de demonstração (hoje só guardamos o nome escolhido; nenhum arquivo é enviado).
- [ ] Completar calendário local: criar atendimento manual, editar/cancelar atendimento, navegar por dias/meses e validar férias e exceções de expediente.
- [ ] Transformar clientes e financeiro ilustrativos em registros locais editáveis, incluindo pagamentos e totais calculados a partir dos atendimentos.
- [ ] Completar histórico/conversa: observações, respostas a propostas depois do aceite, estados expirados/concluídos/falta e regras de conflito/remarcação.
- [ ] Permitir redefinir os dados fictícios da demonstração e criar migração/recuperação segura para dados antigos ou inválidos no navegador.
- [ ] Adicionar testes automatizados locais para cálculo, disponibilidade, transições e persistência; revisar acessibilidade e lint.
- [ ] Fazer aceite manual do percurso completo: configurar serviço → cliente responde → envia pedido → profissional responde → cliente aceita/troca/cancela → agenda atualiza.

## Depois que a V1 local estiver aprovada

- [ ] Trocar persistência de demonstração por Supabase/PostgreSQL, aplicar migrations e testar RLS/isolamento entre negócios.
- [ ] Validar concorrência da agenda e fluxos reais de autenticação, e-mail e uploads.
- [ ] Configurar Asaas em sandbox, validar webhooks e só então configurar produção.
- [ ] Preparar domínio, variáveis secretas, deploy, observabilidade, backup, privacidade e revisão jurídica.

## Como abrir agora

1. Na pasta do projeto, rode `npm run dev`.
2. Abra `http://localhost:3000/demo` para o painel.
3. Em **Testar fluxo cliente ↔ profissional**, ou diretamente em `http://localhost:3000/demo/fluxo`, configure perguntas e percorra as duas pontas.

Pedidos, configurações e respostas das demonstrações existem somente no perfil do navegador usado. Não são multiusuário, backup, persistência confiável nem sistema para produção.
