# Tá Marcado

## Conta opcional da cliente

O agendamento público continua disponível sem conta. Depois de enviar o pedido, a cliente pode usar Google ou link por e-mail para reunir atendimentos em `/minha-agenda`. A implantação dessa função exige a migration `202610050007_optional_customer_accounts.sql` e a configuração dos provedores no Supabase. Consulte [docs/CUSTOMER-AUTH-SETUP.md](docs/CUSTOMER-AUTH-SETUP.md) para arquitetura, ativação e verificação manual.

Plataforma de agendamento para profissionais autônomas. Stack: Next.js 16 App Router, React, TypeScript strict, Tailwind 4, Supabase/PostgreSQL, Supabase Auth e Storage.

## Rodar localmente

1. Use Node.js 20.9 ou superior.
2. Copie `.env.example` para `.env.local` e preencha URL e chave pública do Supabase.
3. Aplique, nesta ordem, as migrations em `supabase/migrations/` no projeto Supabase.
4. No Supabase Auth, habilite confirmação por e-mail e adicione `http://localhost:3000/auth/callback` às URLs permitidas.
5. Rode `npm ci` e `npm run dev`.

As rotas antigas de demonstração (`/demo`, `/demo/fluxo` e `/exemplo-trancista`) redirecionam para a página inicial. O site de produção não oferece mais o laboratório local; os fluxos reais usam o Supabase.

A landing page abre sem credenciais. Cadastro, painel, publicação, portfólio, agendamentos e assinatura precisam de um projeto Supabase configurado. A chave `SUPABASE_SERVICE_ROLE_KEY` só é usada no servidor para conciliar webhooks e assinaturas; nunca a exponha no navegador.

## Assinatura

O provedor integrado é o Stripe Billing. Configure `STRIPE_SECRET_KEY` (preferencialmente uma chave restrita), `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_SITE_URL`. Crie no Stripe um produto “Tá Marcado · Plano mensal” com preço recorrente de R$ 49,99/mês e informe o identificador do preço em `STRIPE_PRICE_ID`.

Cadastre o endpoint `/api/billing/stripe-webhook` no Stripe e assine, no mínimo, `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` e `customer.subscription.deleted`. A assinatura só fica ativa após webhook assinado e validado; a URL de retorno do Checkout não concede acesso. Eventos são idempotentes por ID. O Customer Portal hospeda atualização de cartão, faturas e cancelamento.

Veja o roteiro de configuração e teste em [docs/STRIPE-SETUP.md](docs/STRIPE-SETUP.md).

## Regras sensíveis

- Regras de domínio em `src/lib/domain.ts` e funções PostgreSQL versionadas em `supabase/migrations/`.
- O trial soma somente atendimentos públicos concluídos; registros manuais ficam fora.
- A confirmação usa uma constraint de intervalo no PostgreSQL para impedir choque simultâneo.
- Clientes acompanham pedidos por token aleatório; só o hash do token é salvo.
- RLS separa dados por `business_id`; eventos, trial e assinatura não aceitam escrita direta pelo navegador.
- Fotos públicas do portfólio ficam em bucket separado e são validadas no servidor por assinatura real do arquivo e tamanho.

## Situação do produto

A base cobre site institucional, cadastro/recuperação de acesso, onboarding, criação de serviços com perguntas e modificadores, perfil público, estimativa de preço/duração calculada no servidor, disponibilidade e pedidos, negociação por link, agenda, trial, assinatura Stripe e portfólio. Antes de operar com clientes reais ainda é necessário configurar Supabase e Stripe, aplicar e validar as migrations, e concluir itens de produto/operação: edição de serviços/perfil, exceções e bloqueios na interface do calendário, lançamentos financeiros, mensagens/notificações da negociação, rate limiting distribuído/antiabuso, compressão de imagens e revisão jurídica dos termos/privacidade. Painéis de algumas dessas áreas ainda são estruturas iniciais, não fluxos completos.

### Landing atual

A página institucional do app está em `src/app/page.tsx`, com estilos em `src/app/marketing.css` e interações em `src/components/marketing-home.tsx`. Ela inclui uma demonstração local de agendamento, apresentação dos recursos e uma faixa horizontal de comentários. O bloco de portfólio promocional e o footer foram retirados da landing; o recurso de portfólio do painel permanece disponível. `public/tamarcado-share-preview.png` é a imagem de prévia fornecida pelo usuário, e o Instagram da marca é `https://instagram.com/tamarcado_app`.

Há cinco comentários de exemplo na faixa, além do texto anterior. Troque ou valide esses textos com profissionais reais antes de apresentá-los como depoimentos autênticos. As alterações mais recentes de UI foram enviadas à `main` no commit `79e021c`; ainda é necessário confirmar o deploy da Hostinger. Consulte `docs/STATUS-LOCAL-FIRST.md` para o estado completo e as próximas validações.

## Comandos

- `npm run dev` — desenvolvimento.
- `npm run build` — build de produção.
- `npm run typecheck` — verificação TypeScript.

## Prévia no GitHub Pages

O repositório GitHub (`main`) é a fonte de versionamento. `index.html` na raiz publica uma prévia estática em `https://guedesyc.github.io/tamarcado/`; ela não executa o painel completo, autenticação, APIs, Supabase, WhatsApp nem checkout. O domínio planejado para o aplicativo completo é `tamarcado.ygsystems.com.br`, na Hostinger, com ambiente que suporte o runtime do Next.js.
