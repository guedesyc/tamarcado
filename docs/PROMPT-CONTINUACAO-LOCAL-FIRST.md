# Prompt para continuar o Tá Marcado

Você está continuando o projeto `https://github.com/guedesyc/tamarcado`. Leia primeiro `docs/STATUS-LOCAL-FIRST.md`, confira `git status`, a branch e o histórico antes de editar. Preserve mudanças locais existentes.

## Objetivo

Construir e validar uma V1 confiável para profissionais autônomas de beleza. O fluxo principal deve ser simples para a cliente (sem cadastro) e reduzir trabalho manual da profissional. Mantenha sempre distinta a demonstração local, a prévia estática e o produto conectado.

## Estado atual

- Next.js App Router/React/TypeScript com módulos de painel, agenda, solicitações, clientes, serviços, portfólio, página pública, configurações e assinatura.
- `/demo` e `/demo/fluxo` são laboratórios locais; dados fictícios ficam no `localStorage` do navegador.
- O fluxo ligado ao backend já tem acompanhamento por token, preparo de mensagens de WhatsApp com link individual e lógica de sinal Pix com prazo de uma hora e confirmação manual da profissional. Não prometa detecção automática de pagamento.
- O preço do plano é R$ 49,99/mês nos textos e no valor do checkout Asaas.
- As migrations de sinal, portfólio, capacidade/janela e correções de proposta foram aplicadas no Supabase conforme validação/confirmação registrada em `docs/STATUS-LOCAL-FIRST.md`; não recriar tabelas nem executar SQL destrutivo.
- O repositório GitHub (`main`) é a fonte de versionamento. A raiz contém `index.html`, uma prévia independente publicada em GitHub Pages — não é o app de produção. Pages não executa o Next.js completo, `proxy.ts`, APIs ou lógica de servidor; não tente habilitar `output: "export"` no app inteiro sem resolver incompatibilidades e definir o escopo estático.
- Destino planejado de produção: Hostinger, domínio `tamarcado.ygsystems.com.br`. Antes do deploy, confirmar o plano/ambiente disponível e validar suporte ao runtime Node.js/Next.js; manter segredos fora do Git.
- Hostinger: a implantação Next.js passou após configurar `"build": "next build --webpack"` no `package.json` e substituir `next.config.ts` por `next.config.mjs` (mesmos headers de segurança). A Hostinger usa Node 22.x e mantém o comando `npm run build`. O workaround contornou a falha de GLIBC/Turbopack/config TypeScript; não significa que a GLIBC do host foi atualizada.
- Verificações: `npm run typecheck` e `npm run build` (Webpack) passaram localmente; a implantação na Hostinger também foi reportada como bem-sucedida. Revalidar o domínio, APIs e integrações remotas antes de considerar produção pronta.
- A revisão de 29/09/2026 foi enviada à branch `main`: calendário com estados visuais distintos e dias passados opacos; telas conectadas de clientes, financeiro, configurações do negócio e perguntas por serviço; catálogo compacto de serviços com detalhes; botão Voltar e transição em vídeo no painel; nova logo transparente em todas as áreas que usam `BrandLogo` e favicon em `src/app/icon.png`.
- O usuário confirmou que aplicou no Supabase as migrations aditivas `202609290003_service_question_editor.sql`, `202609290004_record_service_balance.sql` e `202609290005_portfolio_owner_read.sql`. Elas não removem tabelas. Agora testar as telas conectadas após o deploy.
- Revisão de 29/09/2026: Agenda e Solicitações atualizam automaticamente a cada 30 min quando visíveis. A navegação mostra o vídeo desde o clique e não bloqueia cliques internos na agenda; conferir interação das datas após o deploy.
- A tela de Solicitações mostra respostas e os adicionais de preço/duração, junto da estimativa calculada já persistida pelo orçamento. Mensagem WhatsApp para solicitar sinal agora formata serviço, dia/hora, valor/chave/titular Pix, prazo de uma hora e link de acompanhamento em blocos claros.
- Nova migration aditiva `supabase/migrations/202609290006_cancellation_policy_reason.sql`: exige motivo da cliente (mínimo 10 caracteres), registra cancelamento e elegibilidade de reembolso; configurações oferecem política sem reembolso ou avaliação por antecedência de 1–720h. A conversa/devolução segue manual pelo WhatsApp; o app nunca faz reembolso Pix automaticamente. O usuário precisa aplicar esta migration no Supabase antes de testar essa parte. Não exclui tabelas/dados.
- Correção subsequente pronta para publicar: animação de carregamento inicia só depois da mudança efetiva de rota (antes podia aparecer, fechar sobre a página antiga e reaparecer); tela Clientes busca contatos, atendimentos e respostas separadamente e apresenta erro real em vez de falso vazio; Financeiro e Clientes exibem botão Voltar junto ao conteúdo.
- Validação local dessas correções: `npm run test` (7/7), `npm run typecheck`, `npm run lint` (0 erros; warnings preexistentes não bloqueantes), `npm run build` (Webpack) e `git diff --check` passaram. Ainda falta validação autenticada pelo usuário no domínio Hostinger.
- Validação da revisão de navegação/cancelamento 29/09/2026: `npm run test` (7/7), `npm run typecheck`, `npm run lint` (0 erros; 22 warnings preexistentes), `npm run build` (Webpack) e `git diff --check` passam. Para encerrar, aplicar migration `202609290006` e testar produção autenticado, inclusive WhatsApp e calendário.
- Trabalho local mais recente: formulário de serviço aceita capacidade simultânea (1–50) e permite alterá-la por serviço; slots e confirmações são protegidos por alocação transacional de capacidade. A cliente confirma visualmente o WhatsApp digitado antes de enviar o pedido. A profissional escolhe calendário apenas no mês corrente ou até o fim do ano corrente.
- Migration `supabase/migrations/202609280001_shared_service_capacity_booking_window.sql` aplicada ao Supabase conforme confirmação do usuário; inclui capacidade simultânea por serviço, janela mensal/anual e checagens concorrentes. A capacidade configurada é independente por serviço: não representa ainda um pool global de profissionais compartilhados entre tipos diferentes de serviço. Validar comportamento real sob concorrência.
- Migration `supabase/migrations/202609280002_portfolio_service_gallery.sql` aplicada ao Supabase conforme confirmação do usuário; atualiza o perfil público para separar as fotos gerais das fotos vinculadas a cada serviço. O painel agora oferece associação de fotos e envio de uma imagem ao criar um serviço.
- Foi corrigida a validação do cabeçalho `Origin` nas APIs para considerar o endereço público encaminhado pelo proxy da Hostinger; no fluxo público, erros conhecidos (horário ocupado, perfil/serviço indisponível) têm mensagens específicas e falhas inesperadas geram log de servidor sem expor detalhes do banco.
- A aceitação de proposta não confirma o horário: retorna para revisão profissional antes da solicitação do sinal. A página de acompanhamento consulta novos horários por token e respeita a duração real do pedido, inclusive adicionais das respostas.
- Durações visíveis para serviços, opções, intervalo de preparação, propostas e atendimentos manuais usam `hh:mm`; o backend continua armazenando minutos. Testes automatizados cobrem conversões e adicionais positivos/negativos.

## Próximos passos

1. Aguardar/conferir o deploy automático da `main` na Hostinger. Abrir `https://tamarcado.ygsystems.com.br` e validar login, configurações, expediente, serviços, perguntas, portfólio, agenda, clientes e financeiro; consultar logs em caso de falha.
2. Repetir a navegação entre páginas para confirmar que o loader aparece uma vez, sem retorno visual à rota anterior. Em Financeiro e Clientes, conferir o botão Voltar no topo do conteúdo.
3. Confirmar que o atendimento já criado aparece em Clientes, com detalhes e respostas. Se ainda não aparecer, observar a mensagem de erro da tela e o log `[clients-page]` da Hostinger para localizar a falha específica de consulta/RLS.
4. Completar teste E2E das transições pedido → proposta → resposta → sinal → verificação → confirmação, incluindo expiração, cancelamento, horários concorrentes e atualizações da agenda/clientes. Regras críticas já tiveram validação SQL transacional com rollback; isso não substitui teste completo na produção.
4. Tratar GitHub Pages apenas como prévia estática; revisar visualmente em celular/desktop sem sugerir que o backend está conectado.
5. Aplicar `202609290006_cancellation_policy_reason.sql` no Supabase; escolher e salvar a política em Configurações; testar motivo no cancelamento, mensagem WhatsApp, sinal já pago/pendente e antecedência mínima.
6. Completar lembretes, estado de falta/no-show, lista de espera e notificações. Hoje `wa.me` apenas abre uma mensagem preparada para envio manual.
7. Ampliar testes automatizados para disponibilidade, cálculo de preço, transições, tokens, RLS e concorrência; revisar acessibilidade e responsividade em aparelhos reais.
8. Depois de validar o restante, configurar Asaas em sandbox e testar checkout recorrente/webhooks idempotentes antes de produção. GitHub Pages não hospeda o backend.
9. Atualizar `docs/STATUS-LOCAL-FIRST.md` somente quando cada item for realmente implementado e verificado; diferenciar deploy bem-sucedido de integrações de produção configuradas.

Não presuma que um botão do WhatsApp enviou a mensagem; o app só prepara o texto/link. Não publique dados reais nem exponha chaves. Não altere banco remoto, domínio ou infraestrutura de produção sem autorização explícita.
