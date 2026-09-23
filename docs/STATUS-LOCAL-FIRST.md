# Tá Marcado — checklist local-first

Objetivo: validar os fluxos do produto no computador, sem conta externa, banco remoto ou hospedagem. A demonstração em `/demo` e `/demo/fluxo` grava dados fictícios no `localStorage` deste navegador. Ela serve para validar UX e regras, não para uso com clientes reais.

## Já construído

- [x] Landing page, identidade visual, páginas de ajuda/termos/privacidade e prévia pública de trancista.
- [x] Estrutura do produto em Next.js/TypeScript e configuração de segurança para desenvolvimento local.
- [x] Base de autenticação, onboarding, painel e APIs preparadas para Supabase (dependem de credenciais e banco para rodar).
- [x] Migrations com modelo multi-tenant, RLS, agenda, solicitações, serviços, trial, portfólio e assinatura.
- [x] Demonstração da profissional Ana: dashboard, calendário semanal, clientes, serviços, finanças ilustrativas, perfil e configurações.
- [x] Configurador local de perguntas por serviço: escolha única/múltipla, texto, número, sim/não e foto de referência (na demo, guarda apenas o nome do arquivo).
- [x] Respostas da cliente em etapas, cálculo local de estimativa de preço/duração a partir das opções (opções novas aceitam `nome | valor em R$ | minutos`) e seleção de horários considerando expediente, duração total e atendimentos confirmados.
- [x] Solicitação com nome e WhatsApp; aparece na visão da profissional e no calendário do mesmo navegador.
- [x] Profissional pode confirmar, recusar ou propor horário, preço, duração e mensagem; a cliente pode aceitar, sugerir outro horário ou cancelar.
- [x] Histórico básico do pedido e sincronização entre abas do mesmo navegador via `localStorage`.
- [x] TypeScript e build de produção passam.

Prompt reutilizável para a próxima etapa: `docs/PROMPT-CONTINUACAO-LOCAL-FIRST.md`.

## Falta para validar a V1 localmente, antes do banco/hospedagem

- [ ] Exercitar manualmente os fluxos acima nos tamanhos mobile e desktop e corrigir problemas encontrados.
- [ ] Completar a tela de serviço local: editar nome/preço/duração, remover/pausar, marcar pergunta opcional e alterar/remover opções e seus modificadores depois de criadas.
- [ ] Persistir anexos de referência em armazenamento local de demonstração (hoje só guardamos o nome escolhido; nenhum arquivo é enviado).
- [ ] Completar calendário local: criar atendimento manual, bloquear horário/dia, editar/cancelar atendimento e navegação de semana/dia; validar férias e exceções.
- [ ] Transformar clientes e financeiro ilustrativos em registros locais editáveis, incluindo pagamentos e totais calculados a partir dos atendimentos.
- [ ] Completar histórico/conversa: observações, respostas a propostas depois do aceite, estados expirados/concluídos/falta e regras de conflito/remarcação.
- [ ] Permitir redefinir os dados fictícios da demonstração e melhorar a recuperação de estado inválido no navegador.
- [ ] Adicionar testes automatizados locais para cálculo, disponibilidade, transições e persistência; revisar acessibilidade e lint.
- [ ] Fazer uma rodada de aceite manual do percurso completo: configurar serviço → cliente responde → envia pedido → profissional responde → cliente aceita/troca/cancela → agenda atualiza.

## Depois que a V1 local estiver aprovada

- [ ] Trocar persistência de demonstração por Supabase/PostgreSQL, aplicar migrations e testar RLS/isolation entre negócios.
- [ ] Validar concorrência da agenda e fluxos reais de autenticação, e-mail e uploads.
- [ ] Configurar Asaas em sandbox, validar webhooks e só então configurar produção.
- [ ] Preparar domínio, variáveis secretas, deploy, observabilidade, backup, privacidade e revisão jurídica.

## Como abrir agora

1. Na pasta do projeto, rode `npm run dev`.
2. Abra `http://localhost:3000/demo` para o painel.
3. Em **Testar fluxo cliente ↔ profissional**, ou diretamente em `http://localhost:3000/demo/fluxo`, configure perguntas e percorra as duas pontas.

Pedidos, configurações e respostas dessa demonstração existem somente no perfil do navegador usado. Não são multiusuário, backup, persistência confiável nem sistema para produção.
