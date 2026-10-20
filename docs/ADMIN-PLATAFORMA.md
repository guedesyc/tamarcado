# Painel de admin da plataforma (`/admin`)

Painel somente leitura para acompanhar as profissionais cadastradas: funil, lista com busca e filtros por pendência, último acesso e status da assinatura. Não mostra dados das clientes das profissionais, só números agregados (contagem de pedidos e data do último pedido).

## Como funciona o acesso

- Não há login nem senha separados. A conta entra pelo `/entrar` normal (Supabase Auth).
- O servidor verifica o JWT da sessão (`getClaims`) e procura o `user_id` na tabela `public.platform_admins`, lida só com a service role. A tabela tem RLS ativado e nenhuma policy, então nada nela é acessível pelo navegador.
- Quem não é admin (ou não está logado) recebe **404** em `/admin` e em `/api/admin/*`.
- Admin com sessão `aal1` vê só a tela de 2FA. Os dados só aparecem com sessão **`aal2`** (TOTP verificado).
- Quando já existe um TOTP verificado, não é possível cadastrar outro a partir de uma sessão `aal1`. Isso impede que alguém com só a senha troque o 2FA.
- A página tem `noindex`, não está no `sitemap.xml` e não aparece no `robots.txt`, para não revelar o caminho.
- Cada visualização e cada ação de admin é gravada em `audit_logs` (`entity_type = 'platform_admin'`, `business_id = null`, para que não apareçam para nenhuma profissional pela RLS de tenant). O texto buscado não é gravado.

## Migrations

1. `202610190001_platform_admins_and_last_seen.sql`: cria `platform_admins`, `platform_user_activity` (coluna `last_seen_at`) e a função `touch_last_seen()`.
2. `202610190002_admin_platform_overview.sql`: cria `admin_platform_professionals()`, executável só pela `service_role`. Ela exclui contas de cliente (`account_type = 'customer'` ou com `customer_profiles`).

Aplique no Supabase (SQL Editor ou `supabase db push`) **antes** do deploy do código. Sem elas, o `/app` continua funcionando: a atualização do último acesso falha em silêncio e só registra o erro no log.

## Último acesso

Quando a profissional abre qualquer página de `/app`, o proxy chama `touch_last_seen()`. Um cookie `tm_last_seen` (1h) limita isso a uma chamada por hora por navegador, e a própria função só grava se o valor salvo tiver mais de 1 hora. O painel mostra o mais recente entre `last_seen_at` e `auth.users.last_sign_in_at`. Antes da migration, só o `last_sign_in_at` está disponível.

## Passo a passo: marcar sua conta como admin

1. Confirme que você tem uma conta normal no Tá Marcado (a mesma do `/entrar`).
2. No Supabase Dashboard → **SQL Editor**, rode trocando pelo seu e-mail:

   ```sql
   insert into public.platform_admins (user_id, note)
   select id, 'fundador' from auth.users where email = 'SEU-EMAIL-AQUI'
   on conflict (user_id) do nothing;
   ```

3. Confira com `select * from public.platform_admins;`.

Para remover um admin: `delete from public.platform_admins where user_id = '...';`.

## Passo a passo: ativar o 2FA (TOTP)

1. Supabase Dashboard → **Authentication → Multi-Factor** (ou *Sign In / Providers → Multi-Factor Authentication*, dependendo da versão do painel): deixe **TOTP (App Authenticator)** ativado. Em projetos novos ele já vem ativado por padrão.
2. Entre no site normalmente com e-mail e senha e abra `https://SEU-DOMINIO/admin`.
3. Clique em **Configurar 2FA**, escaneie o QR code no app autenticador (Google Authenticator, 1Password, Authy…) e digite o código de 6 dígitos.
4. A página recarrega já com o painel. Nos próximos acessos, `/admin` pede só o código.

Se perder o celular: no Supabase Dashboard → **Authentication → Users** → sua conta → remova o fator MFA. No próximo acesso a `/admin`, o cadastro do 2FA começa de novo.

## Ações disponíveis

- **Reenviar confirmação**: só aparece para quem ainda não confirmou o e-mail. Usa o mesmo envio do cadastro (`auth.resend`, tipo `signup`) e fica registrada em `audit_logs`.
- **Abrir página**: abre a página pública (`/slug`) quando está publicada.

## Pendências calculadas

| Pendência | Regra |
|---|---|
| E-mail não confirmado | sem `email_confirmed_at` e cadastro há mais de 24h |
| Sem serviços | nenhum serviço ativo |
| Sem horários | nenhuma regra em `availability_rules` |
| Nenhum pedido | nenhum agendamento com `source = 'public'` |
| Grátis esgotado sem assinatura | `free_booking_quota_used >= 5` e assinatura Stripe não ativa no modo atual |
| Pagamento falhou | assinatura `past_due` ou `incomplete` |
| Sem acesso há mais de 14 dias | último acesso (ou nenhum) com mais de 14 dias |

As regras estão em `src/lib/admin-overview.ts` e têm testes em `tests/admin-overview.test.mjs`.
