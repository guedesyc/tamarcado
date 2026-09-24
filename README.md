# Tá Marcado

Plataforma de agendamento para profissionais autônomas. Stack: Next.js 16 App Router, React, TypeScript strict, Tailwind 4, Supabase/PostgreSQL, Supabase Auth e Storage.

## Rodar localmente

1. Use Node.js 20.9 ou superior.
2. Copie `.env.example` para `.env.local` e preencha URL e chave pública do Supabase.
3. Aplique, nesta ordem, as migrations em `supabase/migrations/` no projeto Supabase.
4. No Supabase Auth, habilite confirmação por e-mail e adicione `http://localhost:3000/auth/callback` às URLs permitidas.
5. Rode `npm ci` e `npm run dev`.

Para explorar a interface sem configurar o Supabase, rode `npm run dev` e abra `/demo`. O laboratório `/demo/fluxo` demonstra a configuração de perguntas, o pedido da cliente, a resposta/proposta da profissional e a atualização do calendário. Essa demonstração salva dados fictícios no `localStorage` do navegador; veja `docs/STATUS-LOCAL-FIRST.md` para o checklist e os limites do modo local.

A landing page abre sem credenciais. Cadastro, painel, publicação, portfólio, agendamentos e assinatura precisam de um projeto Supabase configurado. A chave `SUPABASE_SERVICE_ROLE_KEY` só é usada no servidor para conciliar webhooks e assinaturas; nunca a exponha no navegador.

## Assinatura

O provedor integrado é o Asaas Checkout. Para sandbox, configure `ASAAS_API_KEY`, `ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3`, `SUPABASE_SERVICE_ROLE_KEY` e `ASAAS_WEBHOOK_TOKEN`. Cadastre no Asaas o endpoint `/api/billing/asaas-webhook` e use o mesmo segredo no header `asaas-access-token`. Em produção, use a URL e a chave de produção e defina `NEXT_PUBLIC_SITE_URL` para o domínio HTTPS definitivo.

O checkout hospedado aceita cartão, cria recorrência mensal e mantém dados de cartão no Asaas. A assinatura só fica ativa após webhook verificado; a URL de retorno do checkout não concede acesso. Eventos são idempotentes por ID.

## Regras sensíveis

- Regras de domínio em `src/lib/domain.ts` e funções PostgreSQL versionadas em `supabase/migrations/`.
- O trial soma somente atendimentos públicos concluídos; registros manuais ficam fora.
- A confirmação usa uma constraint de intervalo no PostgreSQL para impedir choque simultâneo.
- Clientes acompanham pedidos por token aleatório; só o hash do token é salvo.
- RLS separa dados por `business_id`; eventos, trial e assinatura não aceitam escrita direta pelo navegador.
- Fotos públicas do portfólio ficam em bucket separado e são validadas no servidor por assinatura real do arquivo e tamanho.

## Situação do produto

A base cobre site institucional, cadastro/recuperação de acesso, onboarding, criação de serviços com perguntas e modificadores, perfil público, estimativa de preço/duração calculada no servidor, disponibilidade e pedidos, negociação por link, agenda, trial, assinatura Asaas e portfólio. Antes de operar com clientes reais ainda é necessário configurar Supabase e Asaas, aplicar e validar as migrations, e concluir itens de produto/operação: edição de serviços/perfil, exceções e bloqueios na interface do calendário, lançamentos financeiros, mensagens/notificações da negociação, rate limiting distribuído/antiabuso, compressão de imagens e revisão jurídica dos termos/privacidade. Painéis de algumas dessas áreas ainda são estruturas iniciais, não fluxos completos.

## Comandos

- `npm run dev` — desenvolvimento.
- `npm run build` — build de produção.
- `npm run typecheck` — verificação TypeScript.

## Prévia no GitHub Pages

`index.html` na raiz é uma prévia estática de apresentação publicada em `https://guedesyc.github.io/tamarcado/`. Ela não executa o painel completo, autenticação, APIs, Supabase, WhatsApp nem checkout; o aplicativo Next.js completo precisa de hospedagem com runtime de servidor.
