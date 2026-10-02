# Tá Marcado — andamento e próximos passos

Atualizado em 02/10/2026. Código sincronizado com `origin/main` no commit `79e021c` antes desta atualização documental. GitHub (`main`) é a fonte de versionamento; GitHub Pages mantém uma prévia estática e o app Next.js usa a Hostinger. O deploy mais recente da landing não foi conferido no domínio. O usuário confirmou `202610010001` e `202610010002` no Supabase. A migration `202610010003_mark_client_cancellation_seen.sql` continua indicada como pendente para habilitar “já visualizada”; confirmar o estado quando voltar ao recurso. A tabela `supabase_migrations.schema_migrations` não existe, então não há histórico pelo CLI. Não reexecutar migrations apenas por falta de histórico.

## Landing institucional — 02/10/2026

- [x] Landing responsiva com hero de marca, faixa de especialidades logo após o destaque inicial, narrativa em cinco etapas com celular que avança a cada 3 segundos e seleção manual, demonstração local de agendamento, apresentação do painel/fluxo, preço, FAQ e chamada final.
- [x] A seção de portfólio promocional, o bloco “Feito para a sua realidade” e o footer foram removidos da landing. O recurso de portfólio do produto/painel continua existindo.
- [x] A faixa final de comentários se move horizontalmente e pausa com foco/hover; respeita `prefers-reduced-motion`. Há cinco comentários de exemplo além do texto anterior. Substituir ou validar com profissionais reais antes de apresentar os exemplos como depoimentos autênticos.
- [x] O cartão de apresentação usa `public/tamarcado-share-preview.png`, imagem fornecida pelo usuário. O ícone do Instagram aponta para `https://instagram.com/tamarcado_app`.
- [x] “Experimente por aqui” é uma demonstração client-side: sem conta, gravação, pedido real ou envio de dados. Inclui aviso de prévia local.
- [x] SEO da página inicial, cabeçalho móvel e suporte a `prefers-reduced-motion`. Alterações restritas à landing e sua imagem; sem mudança de auth, Supabase, APIs, cobrança ou páginas internas.
- [x] Commits de código enviados à `main`: redesign e animações `f13d9d5`; ordem, tipografia e proporções `0dad165`; remoção do portfólio/rodapé e comentários deslizantes `add8c68`; imagem e link Instagram `79e021c`.
- [ ] Conferir o deploy Hostinger no domínio e a prévia GitHub Pages após estes commits; não foi verificado se o deploy automático terminou.
- [ ] Fazer revisão visual da landing em desktop e celular. As verificações de typecheck/test/build listadas em registros antigos eram de uma revisão inicial, antes dos últimos ajustes visuais; elas não foram repetidas para o estado atual.
- [ ] Conferir após o deploy se a imagem fornecida aparece com bom corte e legibilidade em desktop/celular; confirmar também os cinco textos de exemplo antes de apresentá-los como depoimentos reais.

## Atualização: solicitações, agenda e registros de teste — 02/10/2026

- [x] Solicitações tem três abas exclusivas pelo estado atual: `requested`/`under_review`/`proposed` em andamento; `confirmed`/`completed`/`no_show` aprovadas; `cancelled_by_client`/`cancelled_by_professional`/`expired` canceladas. Cada página consulta até 10 registros.
- [x] Cancelamentos já vistos continuam no histórico de Canceladas como “Já visualizada”; os registros permanecem no banco. Um cancelamento não aparece na Agenda.
- [x] Consultas da Agenda e das abas não falham se `cancellation_seen_at` ainda não existir. O recurso de marcar como visto depende da migration `010003`.
- [x] Registros antigos permanecem listados; as abas filtram por status e mostram histórico de todas as datas. Linhas da mesma cliente são solicitações diferentes, identificadas por IDs distintos.
- [x] Consulta de leitura compartilhada pela usuária mostrou os registros de Otaviana e Raquel no mesmo `business_id`, todos com `source=public`, sem evidência de mistura entre negócios. Os eventos registram apenas ator `client`/`professional`, não a identidade individual.
- [ ] Confirmar no app atualizado que o pedido público de Otaviana para 05/10 (estado `requested` no resultado SQL) aparece somente em Em andamento; ao aprovar deve mudar para Aprovadas e ao cancelar para Canceladas.
- [ ] Usuária autorizou deixar os registros de teste atuais como estão e limpá-los mais tarde; não apagar nem arquivar agora.
- [ ] Validar deploy Hostinger da `main` no commit `adb7a45` e testar mudança exclusiva entre abas, Agenda e paginação acima de 10 registros.
- [x] Commit recebido do GitHub `adb7a45` melhora os detalhes das solicitações: mostra quando o pedido foi solicitado e o horário solicitado; valida que uma proposta tenha mudança real e só informa no WhatsApp os campos alterados; mostra “Em análise” depois de iniciar a análise.
- [x] Cores do calendário ajustadas para distinguir melhor pendências (âmbar) e bloqueios (vermelho).
- [x] `npm run typecheck` passou localmente no commit `adb7a45`.

## Reconhecimento de cancelamento pela profissional — 01/10/2026

- [x] Solicitações lista cancelamentos feitos pela cliente com justificativa.
- [x] O commit histórico `061c09e` restaurou compatibilidade de RPCs após a migration `202610010001`; a `main` avançou desde então até `adb7a45`.
- [x] Typecheck passou após a alteração.
- [ ] Migration `202610010003_mark_client_cancellation_seen.sql` adiciona marcação persistente de “visto”; aplicar no Supabase para habilitar o botão e o indicador.
- [ ] Após aplicar, confirmar deploy e testar: marcar cancelamento como visto mantém o registro na aba Canceladas com o indicador “Já visualizada”.

## Ajustes de proposta, sinal opcional e catálogo — 29/09/2026

- [x] Loader do painel com fundo branco e dimensões maiores no desktop; mantém proporção responsiva em telas pequenas.
- [x] Proposta de horário agora aceita apenas os campos alterados: data ou horário ausente preserva o valor original. Inclui justificativa opcional para a cliente, exibida no acompanhamento.
- [x] API traduz conflito de expediente, bloqueio ou capacidade em mensagem explicativa. No exemplo reportado, 18h30 também excede o expediente exibido (até 18h), uma causa concreta para rejeição.
- [x] Financeiro atualiza o total/saldo localmente após receber lançamento e oculta Registrar recebimento quando o serviço está quitado.
- [x] Botão Voltar alinhado à esquerda na página Minha Página.
- [x] Configuração de Pix/sinal inclui Sim/Não. Ao desligar, não exige nem exibe dados Pix; confirmações futuras seguem sem sinal. Atendimentos já com sinal pendente não são convertidos por essa alteração.
- [x] Página pública de serviços usa cartões com imagem quadrada em destaque, dados do serviço e CTA “Quero Marcar!”, encaminhando para a solicitação com o serviço pré-selecionado.
- [x] Migration aditiva criada: `supabase/migrations/202609290008_optional_signal_partial_proposals.sql`. Acrescenta somente `businesses.signal_enabled` (padrão `true`) e `appointments.proposal_reason`, e atualiza RPCs. Não contém remoção de tabelas nem exclusão de registros.
- [x] Efeitos esperados de `202609290008_optional_signal_partial_proposals.sql` foram confirmados por consulta de leitura: `businesses.signal_enabled` e `appointments.proposal_reason` existem. O histórico CLI está indisponível nesse projeto.
- [ ] Testar em produção proposta só com data, proposta só com horário, justificativa na página de acompanhamento, sinal Sim/Não, confirmação de sinal ligado, pagamentos já pendentes e recebimento financeiro após deploy.
- [ ] Validar visualmente catálogo e loader em desktop e telefone real após deploy.

## Correção de disponibilidade do calendário público — 29/09/2026

- [x] Reproduzido no Supabase o erro que deixava todos os dias como “Sem vagas”: `calculate_service_quote` falhava com `column reference "option_id" is ambiguous` ao calcular respostas de escolha. A API escondia o erro e o calendário o interpretava como mês sem disponibilidade.
- [x] Corrigida a função usando variável PL/pgSQL sem colisão e preservadas permissões `anon`/`authenticated`; substituição aplicada ao Supabase do projeto. Nenhuma tabela ou dado foi removido/alterado.
- [x] Teste somente leitura após a correção: com respostas válidas, 05/10/2026 retornou 17 horários para “box” e 35 para “Unha em Gel”.
- [x] Migration aditiva e reproduzível adicionada: `202609290007_fix_quote_option_id_ambiguity.sql`.
- [x] API agora responde erro HTTP explícito se o RPC falhar ou se o cliente Supabase não estiver disponível; o calendário informa falha de consulta em vez de marcar silenciosamente todos os dias como indisponíveis.
- [ ] Aguardar o deploy da `main` na Hostinger e validar no link público que os dias úteis aparecem disponíveis e que os horários carregam após responder às perguntas obrigatórias.

## Revisão de agenda, cancelamento e navegação — 29/09/2026

- [x] Agenda e Solicitações recarregam os dados automaticamente a cada 30 minutos enquanto a página estiver visível.
- [x] A transição entre rotas começa imediatamente no clique, termina após a mudança de rota, tem timeout de segurança e não bloqueia interações na mesma rota (como escolher dia/mês na agenda). A opacidade do conteúdo durante a transição não fica presa.
- [x] Solicitações mostram, em detalhes expansíveis, as respostas da cliente, adicionais positivos/negativos de preço e duração e a estimativa calculada; isso torna visível o total que já é gravado no pedido pelo cálculo de orçamento.
- [x] Mensagem de solicitação de sinal no WhatsApp separa serviço/data e os dados do Pix (valor, chave, titular e prazo), com link de acompanhamento.
- [x] Cancelamento pelo link exige motivo (mínimo 10 caracteres), grava esse motivo e prepara conversa de WhatsApp com profissional, informando data, serviço, sinal e política cadastrada. A profissional e cliente combinam a devolução manualmente; o sistema não movimenta Pix nem reembolsa automaticamente.
- [x] Configurações incluem política “não reembolsar” ou “permitir avaliar se cancelado com antecedência mínima” de 1 a 720 horas.
- [x] Nova migration aditiva `202609290006_cancellation_policy_reason.sql`: acrescenta colunas de política e motivo, RPC segura para cancelar com token, evento de auditoria e gatilho para rejeitar cancelamento legado sem justificativa. Não remove tabela nem dados.
- [x] Efeitos esperados de `202609290006_cancellation_policy_reason.sql` foram confirmados por consulta de leitura: `cancel_public_booking` e `appointments.client_cancellation_reason` existem. Validar pedido/cancelamento com e sem sinal, mensagens WhatsApp, política de prazo e configurações.
- [ ] Após deploy, conferir no telefone e desktop que menus e calendário continuam interativos, datas passadas/fora da disponibilidade aparecem desabilitadas e novos horários continuam selecionáveis.

## Revisão do painel conectado — 29/09/2026

Foi identificada uma diferença importante entre o laboratório `/demo` (localStorage) e o painel `/app` (Supabase): recursos mostrados na demonstração — especialmente perguntas e dados completos do perfil — não tinham telas equivalentes de edição no painel conectado. Não houve evidência de uma remoção recente dessas tabelas/configurações; a demonstração local e o produto conectado eram implementações separadas. Os dados fictícios do laboratório não devem ser copiados automaticamente para contas reais.

Alterações desta revisão (código versionado em `main`; confirmar a conclusão do deploy automático da Hostinger antes de considerar produção atualizada):

- [x] Calendário profissional: dias anteriores ficam opacos; marcadores separados para atendimento confirmado, pedido/sinal pendente e bloqueio; detalhes do dia usam cores por estado.
- [x] Clientes: tela com nome, telefone, ação “Ver detalhes”, histórico de pedidos/atendimentos, data, serviço, preço, observações e respostas arquivadas.
- [x] Serviços: lista compacta com nome, foto associada, preço e estado; tocar/abrir mostra galeria, descrição, duração, modo, capacidade e ações de serviço.
- [x] Perguntas para clientes: rota de painel `/app/perguntas` para editar perguntas, opções, obrigatoriedade, adicionais de preço e duração por serviço.
- [x] Configurações: formulário ligado ao Supabase para negócio, nome profissional, e-mail da conta (leitura), WhatsApp, slug derivado, região pública, categorias e intervalos de expediente.
- [x] Financeiro: visão por cliente/serviço, recebimentos e saldo pendente; o sinal confirmado é abatido do preço total. Registro de complemento é transacional e impede sinal não conferido, duplicidade de quitação e excesso sobre o total.
- [x] Navegação privada: botão Voltar no layout do painel e transição com o vídeo fornecido; o conteúdo ao fundo desfoca. A preferência de movimento reduzido desativa a animação.
- [x] Identidade visual: nova logo fornecida pelo usuário substitui o arquivo de marca compartilhado usado pelas páginas; favicon/ícone do app gerado da mesma arte com transparência.
- [x] Nenhuma tabela é removida. Três novas migrations apenas adicionam função de edição de perguntas, função transacional de recebimento e uma política de leitura para o próprio portfólio ainda não publicado.
- [x] Usuário confirmou que aplicou as migrations `202609290003_service_question_editor.sql`, `202609290004_record_service_balance.sql` e `202609290005_portfolio_owner_read.sql` no Supabase; elas são aditivas e não removem tabelas.
- [ ] Depois de concluir o deploy das correções mais recentes, validar o fluxo autenticado no domínio Hostinger com conta real: salvar configurações e expediente, editar e responder perguntas, visualizar imagens privadas do portfólio, ver calendário/clientes, conferir sinal e lançar o saldo.
- [x] Correção anterior: Clientes consulta contatos, atendimentos e respostas separadamente e expõe falhas em vez de exibir falso estado vazio; Financeiro e Clientes exibem botão Voltar visível dentro da página.
- [ ] Persistem limitações externas já conhecidas: `wa.me` abre texto para envio manual; o Asaas permanece fora do escopo desta revisão; teste real em vários celulares e validação de DNS/ambiente continuam necessários.

## O que existe

### Produto e experiência

- [x] Landing page, páginas iniciais de ajuda/termos/privacidade e exemplo público de trancista.
- [x] Marca Tá Marcado, catálogo visual de serviços, perguntas por serviço, preços e durações em `hh:mm`, imagens de serviços, logo e capa.
- [x] Página pública com nome do negócio, localização pública e chamada para iniciar agendamento.
- [x] Painel profissional em Next.js com início, agenda, solicitações, clientes, serviços, financeiro, portfólio, página, configurações e assinatura.
- [x] Configuração local de expediente, bloqueios e sinal Pix; os dias começam na segunda-feira e os estados do calendário de demonstração diferenciam confirmado (verde) e pendente (vermelho).
- [x] Fluxo demonstrativo `/demo/fluxo`: a cliente escolhe serviço, responde perguntas, escolhe um horário e envia solicitação; a profissional responde ou propõe alterações; a cliente pode aceitar, pedir outro horário ou cancelar. Dados ficam no `localStorage` do navegador.
- [x] Página de acompanhamento por link individual no fluxo conectado, sem exigir cadastro da cliente. Mensagens preparadas para WhatsApp incluem o link de acompanhamento.
- [x] Sinal Pix no fluxo conectado: reserva temporária de uma hora, cliente informa que pagou, profissional confere manualmente e então confirma. A confirmação não é automática por comprovante.
- [x] Assinatura mensal ajustada para **R$ 49,99** na comunicação e no valor enviado ao checkout Asaas.

### Código de backend preparado

- [x] Projeto Next.js/TypeScript, rotas de autenticação, APIs, integração Supabase/PostgreSQL, RLS e Asaas já presentes no repositório.
- [x] Migration nova `supabase/migrations/202609230001_public_booking_signal.sql` adiciona configurações Pix, estado/prazo do sinal e tokens adicionais de acompanhamento com hash.
- [x] Validação desta revisão: `npm run test` (7 testes), `npm run typecheck`, `npm run lint` (0 erros; avisos não bloqueantes) e `npm run build` (Webpack) passaram; `git diff --check` passou.
- [x] Build da Hostinger corrigido e implantado: `package.json` executa `next build --webpack`; `next.config.ts` foi convertido para `next.config.mjs` para evitar a falha ao carregar a configuração TypeScript no ambiente de build da hospedagem.
- [x] Capacidade simultânea por serviço adicionada à configuração do serviço, com ajuste posterior por serviço e verificação de capacidade nos horários públicos.
- [x] Confirmação explícita do WhatsApp adicionada ao fluxo da cliente antes de transmitir a solicitação; é uma confirmação visual do número digitado, não uma verificação por código/SMS.
- [x] Configuração do horizonte público adicionada: mês atual ou até o fim do ano atual, conforme fuso horário do negócio.
- [x] Migration `202609280001_shared_service_capacity_booking_window.sql` executada no Supabase conforme confirmação do usuário; inclui colunas, regras concorrentes, capacidade e janela de datas.
- [x] Portfólio agora associa imagens a serviços, aceita foto de exemplo ao criar serviço e exibe a galeria de cada serviço na página pública; o usuário confirmou que aplicou `202609280002_portfolio_service_gallery.sql` no Supabase.
- [x] Validação de origem das APIs atualizada para funcionar atrás do proxy da Hostinger; detalhes de erros do fluxo de agendamento agora são registrados no servidor e mensagens conhecidas ficam claras para a cliente.
- [x] Falha real de sinal reproduzida no Supabase: `gen_random_bytes` estava em `extensions`, fora do `search_path` da função. Migration `202609280003_signal_crypto_and_capacity.sql` aplicada no projeto, com teste transacional que desfaz o pedido. O Pix da conta afetada já estava configurado.
- [x] Aceitar proposta no acompanhamento não confirma nem reserva automaticamente o atendimento: o pedido volta para `under_review` para a profissional solicitar o sinal. Migration `202609290001_proposal_acceptance_requires_signal.sql` validada em transação com rollback, testada com dados de QA também revertidos e aplicada no Supabase.
- [x] A consulta do acompanhamento retorna o ID do serviço; isso habilita a consulta correta de horários alternativos. Migration do acompanhamento testada em transação com rollback e aplicada no Supabase, sem inserir dados persistentes.
- [x] A lista de horários alternativos no acompanhamento agora usa o token temporário e preserva a duração real do pedido, inclusive os adicionais das respostas. A RPC `get_public_booking_slots` foi aplicada ao Supabase e testada com dados temporários revertidos.
- [x] Duração do novo serviço e da proposta profissional usam `hh:mm` na interface e convertem para minutos no contrato interno da API/banco.
- [x] Testes unitários adicionados para conversão, validação e adicionais de duração. Na validação de 29/09/2026, `npm run test` (4 testes), `npm run typecheck`, `npm run lint` (0 erros; 22 avisos não bloqueantes) e `npm run build` passaram.
- [x] Jornada local de demonstração exercitada até solicitação da cliente e visualização pela profissional; o pedido de QA foi local e não foi enviado pelo WhatsApp.
- [x] Conta técnica `teste@gmail.com` criada e confirmada; login e publicação de espaço de teste validados na Hostinger. O espaço de teste usa o slug `espaco-teste-qa-20260928` e deve permanecer identificado como demonstração.
- [x] URL principal do Supabase Auth atualizada de `localhost` para `https://tamarcado.ygsystems.com.br`; callbacks de produção e desenvolvimento continuam na lista permitida.
- [x] Página pública corrigida para mostrar o nome do negócio. Navegação móvel passa a incluir todas as seções; cartões de solicitações e botões receberam ajuste de leitura e toque.
- [x] Navegação móvel compartilhada por todas as páginas do painel, inclusive Início, Serviços e Portfólio; removidas iniciais decorativas remanescentes dos cartões do painel.
- [x] A logo principal tem fundo transparente e foi otimizada como WebP; o favicon Next.js está em `src/app/icon.png` e é vinculado também nos metadados.

“Código preparado” não significa que o ambiente remoto esteja configurado: ainda é preciso aplicar e testar as migrations no projeto Supabase, conferir variáveis secretas, webhooks e permissões.

## Hospedagem e GitHub Pages

- [x] Aplicação Next.js implantada com sucesso na Hostinger após usar Webpack e configuração `next.config.mjs`.
- [ ] Abrir e validar o app implantado no domínio `tamarcado.ygsystems.com.br` (páginas, navegação, APIs e logs); sucesso no deploy não confirma que Supabase/Asaas já estejam configurados.
- [ ] Confirmar DNS, HTTPS e variáveis de ambiente do domínio de produção.

- [x] Prévia de apresentação estática em `index.html` na raiz do repositório; ela substituiu o README na página inicial do GitHub Pages.
- [x] A prévia avisa que login, APIs, banco, WhatsApp e cobranças não funcionam nela.
- [x] Após o push, abrir `https://guedesyc.github.io/tamarcado/` e confirmar que o `index.html` está publicado.

GitHub Pages só serve arquivos estáticos e aqui serve como prévia. O sistema completo usa `proxy.ts`, APIs e lógica de servidor. O app Next.js já foi implantado na Hostinger; login, agenda conectada e links reais dependem também da configuração e validação do Supabase e das variáveis de ambiente.

## Próximas etapas recomendadas

### Antes de usar com profissionais/clientes reais

- [ ] Revisar a prévia Pages em desktop e celular; ela não é o ambiente de produção.
- [ ] Completar teste ponta a ponta da jornada: proposta, aceite/recusa, sinal, expiração, cancelamento e confirmação no WhatsApp. A solicitação e a chegada ao painel foram exercitadas localmente; proposta e sinal tiveram validação SQL transacional, mas o WhatsApp não foi enviado no teste.
- [x] Chamada de solicitar sinal reproduzida no banco, corrigida e verificada com reversão de transação; nenhum atendimento real foi modificado pelo teste.
- [x] Fluxo de banco completo testado com espaço técnico, sem persistir dados: solicitação pública → pedido de sinal → aviso de Pix da cliente → conferência pela profissional → registro financeiro. O retorno `QA_ROLLBACK_SUCCESS` confirmou todas as etapas; envio da mensagem no WhatsApp ainda depende de ação na interface.
- [ ] Validar concorrência de horários, cancelamento durante sinal pendente, liberação após expiração e consistência entre agenda e clientes.
- [ ] Definir política operacional para cancelamento pela profissional e devolução/uso do sinal; o pagamento Pix é direto entre as partes.
- [ ] Revisar notificações: hoje as integrações `wa.me` preparam mensagens para envio; não são disparos automáticos.
- [ ] Completar estados de falta/no-show, atendimento concluído, lembretes e lista de espera.
- [ ] Ampliar testes automatizados para preço, disponibilidade, transições de estado, tokens, isolamento RLS e concorrência; revisar acessibilidade e comportamento em aparelhos móveis reais.
- [ ] Revisar texto jurídico, privacidade, retenção de dados, suporte e política de cancelamento com assessoria apropriada antes do lançamento.

### Para ativar o aplicativo conectado

- [ ] Configurar Supabase, aplicar todas as migrations na ordem, testar RLS e isolamento entre negócios.
- [x] Migration `202609280001_shared_service_capacity_booking_window.sql` executada no Supabase conforme confirmação do usuário. Ainda falta testar concorrência real e limites de mês/ano de ponta a ponta.
- [x] Migration `202609280002_portfolio_service_gallery.sql` executada no Supabase conforme confirmação do usuário.
- [x] Hostinger aceitou e compilou o app Next.js com Node 22.x e `npm run build` (Webpack).
- [ ] Confirmar DNS/HTTPS de `tamarcado.ygsystems.com.br` e variáveis do app com segurança.
- [ ] Configurar variáveis de ambiente e autenticação/e-mail; nunca versionar chaves privadas.
- [ ] Configurar Asaas em sandbox, validar checkout recorrente de R$ 49,99, webhooks idempotentes e cancelamento; só então habilitar produção.
- [ ] Testar uploads, segurança, backups, logs, rate limiting e recuperação de falhas.

## Como testar localmente

1. Rodar `npm run dev`.
2. Abrir `http://localhost:3000/demo` para o painel e `http://localhost:3000/demo/fluxo` para o laboratório cliente ↔ profissional.
3. Os dados de demonstração pertencem ao navegador atual; não são sincronizados entre dispositivos nem devem conter dados reais.

## Referências

- Prompt para continuar o trabalho: `docs/PROMPT-CONTINUACAO-LOCAL-FIRST.md`.
- Fonte versionada: repositório GitHub, branch `main`.
- Prévia GitHub Pages: `index.html` na raiz do repositório.
- Domínio planejado do app de produção: `tamarcado.ygsystems.com.br` na Hostinger.
