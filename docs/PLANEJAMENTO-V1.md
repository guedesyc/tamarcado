# Tá Marcado — Planejamento da V1

## 1. Resumo

Tá Marcado é um SaaS brasileiro multi-tenant para profissionais autônomas de beleza criarem uma página pública, exibirem serviços e receberem solicitações de agendamento sem exigir conta da cliente. A V1 prioriza o fluxo principal: página pública → serviço → personalização → horário → solicitação → negociação → confirmação → conclusão.

Princípios: segurança e integridade no servidor, mobile-first, linguagem simples, domínio separado da UI, dados privados protegidos por tenant e nenhuma funcionalidade futura deve ser implementada prematuramente.

## 2. Escopo exato da V1

- Site institucional responsivo com preço, FAQ, SEO e seção de mapa apenas visual/“em breve”.
- Cadastro/login da profissional e onboarding guiado.
- Perfil público com slug único, descrição, região aproximada, fotos e serviços.
- Categorias extensíveis e templates opcionais de serviço.
- Serviços com preço/duração configuráveis, perguntas personalizadas e modificadores de preço/duração.
- Regras de disponibilidade, exceções, bloqueios e timezone por negócio.
- Página pública de solicitação sem conta da cliente.
- Token aleatório, revogável e com expiração/limitação apropriadas para acompanhamento.
- Solicitação direta, aprovação ou avaliação; negociação com histórico de eventos.
- State machine de agendamento e validação transacional contra conflito de agenda.
- Painel: início, agenda, solicitações, clientes, serviços, portfólio, minha página, financeiro, assinatura e configurações.
- Atendimentos manuais sem consumo do trial.
- Histórico básico de clientes e financeiro.
- Trial de 10 atendimentos públicos elegíveis, contador auditável e bloqueio apenas de novos agendamentos públicos após o limite.
- Abstrações para notificações e pagamentos, sem integração externa obrigatória na primeira entrega.
- RLS, autorização server-side, logs estruturados, tratamento de erros, testes de domínio e integração.

## 3. Fora da V1

Marketplace e busca geográfica; mapa funcional; “Me encaixa”; avaliações públicas; IA; app nativo; emissão fiscal; estoque; CRM avançado; múltiplos planos; assinatura da cliente; automação não oficial de WhatsApp; pagamento do atendimento/sinal pela plataforma; cálculo de deslocamento; OTP por telefone; ranking público.

## 4. Personas e jornadas

### Profissional autônoma

Quer transformar o link do Instagram/WhatsApp em uma página confiável e reduzir a troca manual de mensagens. Jornada: cadastro → negócio → categoria → primeiro serviço → disponibilidade → publicação → compartilhamento → análise de solicitações → confirmação → conclusão.

### Cliente

Quer encontrar rapidamente preço estimado, duração e horário sem criar conta. Jornada: página → serviço → wizard de personalização → horário → nome/WhatsApp → revisão → solicitação → acompanhamento por token.

### Operação/suporte futuro

Não faz parte da superfície V1; o modelo deve permitir auditoria e suporte sem conceder acesso indevido a dados de tenants.

## 5. Mapa de páginas

Públicas: `/`, `/precos`, `/ajuda`, `/termos`, `/privacidade`, `/:slug`, `/:slug/agendar`, `/r/:token`.

Autenticação: `/entrar`, `/cadastro`, recuperação de acesso.

Onboarding: `/app/onboarding/sobre`, `/categoria`, `/servico`, `/horarios`, `/pagina`, `/concluido`.

Painel: `/app`, `/app/agenda`, `/app/solicitacoes`, `/app/clientes`, `/app/servicos`, `/app/portfolio`, `/app/minha-pagina`, `/app/financeiro`, `/app/assinatura`, `/app/configuracoes`.

Rotas administrativas permanecem protegidas e não indexáveis. Slugs reservados ficam em uma constante centralizada e também são validados no banco.

## 6. Arquitetura técnica proposta

- Next.js App Router + TypeScript strict.
- Server Components por padrão; Client Components somente para interação.
- Tailwind + componentes acessíveis baseados em Radix, com tokens visuais próprios.
- React Hook Form + Zod para formulários e contratos compartilhados.
- Supabase PostgreSQL, Auth e Storage; migrações versionadas.
- Camadas: `app` (rotas/UI), `domain` (regras puras), `application` (casos de uso), `infrastructure` (Supabase/providers), `shared` (schemas, tipos, erros e utilidades).
- Casos críticos sempre executados no servidor e, quando houver concorrência, em função transacional/RPC no PostgreSQL.
- Interfaces `NotificationProvider`, `PaymentProvider`, `StorageProvider` e `AnalyticsProvider`, com implementações mínimas na V1.
- Vercel como destino inicial, mantendo dependências portáveis.

## 7. Modelo de dados inicial

Entidades principais: `auth.users`; `businesses`; `business_members`; `professional_profiles`; `categories`; `services`; `service_questions`; `service_question_options`; `service_modifiers`; `availability_rules`; `availability_exceptions`; `clients`; `booking_requests`; `appointments`; `appointment_answers`; `appointment_events`; `appointment_messages`; `portfolio_items`; `financial_entries`; `trial_usage`; `subscription_records`; `notification_events`; `audit_logs`.

Todos os identificadores de domínio serão UUID. Datas usarão `timestamptz`; cada negócio terá `timezone` IANA. Valores monetários serão inteiros em centavos, nunca ponto flutuante. Arquivos ficarão em buckets privados quando não forem públicos.

Índices essenciais: slug único case-insensitive; ownership/tenant; status e data dos agendamentos; disponibilidade por negócio; tokens por hash; eventos por entidade e data. Informações privadas e públicas serão separadas por colunas/consultas e políticas.

## 8. Multi-tenancy e RLS

Cada registro privado referencia `business_id`. O servidor resolve o negócio da sessão por `business_members`; o cliente nunca escolhe livremente o tenant. RLS exige membro autorizado para leitura/escrita privada. Dados públicos usam views/queries explicitamente limitadas ao perfil publicado e serviços ativos.

Testes obrigatórios: profissional A não lê/edita dados de B; usuário sem sessão não lê painel; cliente não acessa dados privados por alteração de UUID; token só retorna o atendimento autorizado e campos permitidos.

## 9. Autenticação e acesso da cliente

Decisão V1: profissionais usam Supabase Auth com e-mail e senha, confirmação de e-mail e recuperação por link. Implementado; depende das URLs e templates de e-mail configurados no Supabase.

Clientes não têm conta. Cada solicitação gera um token criptograficamente aleatório; somente o hash é salvo no banco. O token bruto aparece apenas no link enviado na resposta da criação. Rotas por token aplicam expiração/revogação, rate limit, respostas uniformes e nunca expõem telefone, observações internas ou IDs sequenciais.

## 10. State machine

`draft → requested → under_review → proposed → confirmed → completed`.

Cancelamentos partem de estados permitidos para `cancelled_by_client` ou `cancelled_by_professional`; solicitações não respondidas podem ir para `expired`; atendimentos confirmados podem ir para `no_show`. Cada transição valida ator, pré-condições e versão do registro, grava evento imutável com estado anterior, novo estado, ator e timestamp. Nenhuma atualização silenciosa sobrescreve preço, duração ou horário negociados.

## 11. Disponibilidade e concorrência

O motor recebe timezone, regras semanais, exceções, bloqueios, antecedência, horizonte e duração total (serviço + preparação). Gera slots somente quando o intervalo completo cabe no expediente e não intersecta bloqueios ou compromissos confirmados.

Na solicitação, o servidor recalcula preço/duração e valida o slot dentro de transação. A proteção contra double booking usa constraint de intervalo no PostgreSQL para compromissos confirmados. Solicitações pendentes não bloqueiam definitivamente a agenda na V1. Regras de exceção e bloqueios ainda precisam de interface.

## 12. Preço e duração

O backend calcula a partir da versão do serviço, respostas validadas e modificadores aplicáveis. O resultado inclui base, itens aplicados, preço final e duração final, com snapshot no booking/appointment. O frontend apenas apresenta uma estimativa. Alterações posteriores criam nova proposta e evento auditável.

## 13. Trial e assinatura

`trial_usage` registra contadores por negócio. Decisão V1: somente atendimento público concluído incrementa o uso; manual, recusado, cancelado e expirado não incrementa. Ao atingir 8, exibir aviso; após 10, manter acesso aos dados e pausar novos agendamentos públicos até assinatura ativa. Asaas Checkout foi escolhido para a recorrência mensal; a ativação depende de webhook validado.

## 14. Storage, privacidade e segurança

Upload com allowlist de MIME/extensão, tamanho máximo, nomes gerados, compressão, processamento seguro e URLs assinadas quando privado. CSP e headers de segurança; secrets apenas no servidor; rate limiting em login, criação de solicitação e token; validação Zod server-side; escaping de conteúdo; webhook assinado quando existir; logs sem tokens ou dados sensíveis.

LGPD: coleta mínima, finalidade clara, termos e privacidade desde a V1, separação público/privado, exclusão/exportação planejadas e consentimento antes de reutilizar fotos de clientes. Endereço residencial nunca é público por padrão.

## 15. Testes e qualidade

Unitários: preço, duração, disponibilidade, timezone, transições e trial. Integração: RLS, autorização, confirmação concorrente e tokens. E2E: onboarding → publicação → solicitação → proposta → aceite → confirmação → conclusão → trial. Verificações adicionais: TypeScript, lint, acessibilidade, SEO, responsividade 320–430px e performance.

## 16. Roadmap incremental

1. Fundação Next.js, tokens visuais, erros, logging e migrações.
2. Auth, tenant, onboarding e perfil.
3. Serviços, perguntas e motor de preço/duração.
4. Disponibilidade, calendário e conflitos.
5. Página pública e wizard da cliente.
6. Negociação, token e histórico.
7. Clientes, portfólio e financeiro.
8. Trial, assinatura preparada e notificações abstratas.
9. Home, SEO, acessibilidade, hardening e E2E.

Cada etapa deve entregar fluxo verificável e não avançar com falhas de isolamento, concorrência ou regras de domínio.

## 17. Decisões de negócio registradas

1. Trial contado ao concluir; pedidos manuais não contam.
2. E-mail e senha, com confirmação e recuperação.
3. Novos pedidos públicos pausam ao atingir dez conclusões sem assinatura; acesso aos dados permanece.
4. Política de cancelamento/remarcação e limites de avaliação permanecem decisões de produto.
5. Asaas para checkout/recorrência, após comparação das taxas publicadas.

Este arquivo começou como especificação/planejamento. O código já implementa parte do escopo, mas os itens descritos como pendentes e a configuração dos serviços externos impedem considerar a V1 pronta para produção.

Sem resposta para as decisões 1–3, a implementação deve usar as recomendações indicadas; as decisões 4–6 podem ser adiadas sem bloquear a fundação técnica.
