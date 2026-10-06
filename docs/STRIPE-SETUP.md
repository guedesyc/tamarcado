# Stripe Billing — configuração do Tá Marcado

O Tá Marcado cobra da profissional um plano mensal de R$ 49,99 após os 10 atendimentos públicos gratuitos. Os pagamentos entre cliente e profissional continuam fora do Stripe.

## Ambiente de teste

1. No Stripe, mantenha o modo de testes ativo.
2. Crie o produto `Tá Marcado · Plano mensal`.
3. Crie um preço recorrente mensal de `R$ 49,99` em BRL e copie o identificador `price_...`.
4. Aplique a migration `supabase/migrations/202610060001_stripe_billing.sql` no projeto Supabase usado pelo app.
5. Configure no ambiente privado da Hostinger:

```text
STRIPE_SECRET_KEY=chave restrita do Stripe com as permissões mínimas necessárias
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Também devem continuar configuradas `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, a chave pública do Supabase e `SUPABASE_SERVICE_ROLE_KEY`.

## Webhook

Cadastre no Stripe o endpoint:

```text
https://tamarcado.ygsystems.com.br/api/billing/stripe-webhook
```

Selecione estes eventos:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copie o segredo de assinatura do endpoint para `STRIPE_WEBHOOK_SECRET`. O aplicativo confere a assinatura antes de aceitar o evento e registra cada ID apenas uma vez.

## Customer Portal e Invoicing

Ative o Customer Portal no Dashboard Stripe para permitir atualização de forma de pagamento, cancelamento ao fim do período e histórico de faturas. O botão “Gerenciar assinatura” do Tá Marcado cria uma sessão curta e autenticada para esse portal.

## Produção

Depois do teste completo, crie um preço equivalente em modo de produção e troque todas as variáveis por suas versões de produção. Use uma chave restrita (`rk_`) sempre que ela tiver as permissões necessárias e não adicione chaves a arquivos do projeto ou ao Git.

Não habilite `automatic_tax` até definir com contabilidade se há registro tributário aplicável. Enquanto isso, mantenha o monitoramento de limites tributários no Stripe.
