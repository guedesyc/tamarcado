# Contas opcionais para clientes

## Arquitetura

- A cliente continua podendo agendar sem conta. O convite para entrar aparece **depois** do pedido ser salvo.
- A autenticação usa o mesmo Supabase Auth das profissionais. A mesma usuária pode ter os dois papéis.
- `customer_profiles` guarda nome e WhatsApp reutilizáveis. O WhatsApp salvo pelo formulário não é considerado verificado e não dá acesso a pedidos antigos.
- `customer_appointment_links` associa um atendimento específico à conta. O vínculo só é criado quando a sessão autenticada apresenta o hash de um token de acompanhamento válido.
- A área `/minha-agenda` lê apenas os atendimentos da conta pela função `get_my_customer_appointments`. A função ignora identificadores de negócio ou cliente enviados pelo navegador.
- `/r/[token]` e os agendamentos anônimos permanecem operacionais. Uma cliente autenticada pode adicionar um pedido antigo à própria agenda enquanto o link estiver válido.
- Após um pedido anônimo, um cookie `HttpOnly`, `SameSite=Lax` e temporário guarda a prova para ligar **aquele** pedido depois do login no mesmo navegador. O token de acompanhamento não é enviado ao provedor OAuth. Se o cookie expirar ou o login ocorrer em outro dispositivo, abra o link de acompanhamento e use “Adicionar à minha agenda” antes de entrar.

## Ativação no Supabase

1. Aplique, uma vez, `supabase/migrations/202610050007_optional_customer_accounts.sql` no SQL Editor do projeto correto. Não altere migrações antigas.
2. Em Authentication → URL Configuration, configure o Site URL de produção como `https://tamarcado.ygsystems.com.br` e permita `https://tamarcado.ygsystems.com.br/auth/callback` e `https://tamarcado.ygsystems.com.br/auth/confirm`. Adicione equivalentes locais para desenvolvimento.
3. Em Authentication → Providers → Google, habilite Google e informe Client ID e Client Secret criados no Google Cloud. No Google Cloud, use a URL de callback **do projeto Supabase** indicada nessa tela. Os segredos ficam no Google Cloud/Supabase, nunca no repositório.
4. Habilite o provedor Email. Para magic link com SSR/PKCE, ajuste o template “Magic Link” para usar um link como:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar no Tá Marcado</a>
   ```

5. Confirme que `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) e `NEXT_PUBLIC_SITE_URL` já estão configuradas na hospedagem. Não use service role no navegador.

Ao implantar o código antes da migration, o agendamento anônimo e `/r/[token]` continuam funcionando; a área da cliente indica que a ativação ainda está pendente. Ao implantar antes de configurar Google ou e-mail, cada método pode falhar individualmente sem impedir o agendamento.

## Verificação manual

1. Agende sem conta e confirme que o pedido foi salvo e o link `/r/[token]` abre.
2. Após o sucesso, escolha “Agora não” e confira que nada é exigido.
3. Entre com Google, volte a `/minha-agenda` e confira o pedido feito no mesmo navegador.
4. Saia; solicite link por e-mail, abra-o e confira a sessão da cliente.
5. Salve nome e WhatsApp em “Meus dados”; faça outro pedido autenticada e confira o preenchimento inicial editável.
6. Abra um link antigo autenticada e clique em “Adicionar à minha agenda”. Confira que só aquele pedido foi adicionado.
7. Com outra conta, tente abrir `/minha-agenda/[id]` de um atendimento não vinculado. A página deve retornar 404.
8. Confira que uma conta profissional ainda acessa `/app` e também pode acessar `/minha-agenda`.
9. Confira que proposta, sinal, cancelamento e ações do link `/r/[token]` permanecem disponíveis.
10. Repita os passos em largura de celular e desktop, incluindo navegação por teclado e preferência de movimento reduzido.

## Limites deliberados

- Não há associação retroativa automática por nome, telefone ou cadastro `clients` de um negócio.
- A área da cliente mostra dados e detalhes próprios; alterações de proposta, sinal e cancelamento continuam pelo link de acompanhamento já existente.
- O histórico só inclui pedidos vinculados explicitamente. Um pedido anônimo cujo link foi perdido não pode ser recuperado com nome ou telefone.
