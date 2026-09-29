# Tá Marcado — andamento e próximos passos

Atualizado em 29/09/2026. O repositório GitHub (`main`) é a fonte de versionamento do código. GitHub Pages mantém apenas uma prévia estática; o aplicativo Next.js foi implantado com sucesso na Hostinger. Ainda falta validar publicamente o domínio e configurar/confirmar os serviços de produção.

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
- [x] `npm run typecheck`, `npm run build` e `git diff --check` passaram na última validação local.
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
