# Auditoria técnica de privacidade e retenção — Tá Marcado

**Revisão do repositório:** 06/10/2026  
**Escopo:** código, migrations e textos versionados. Não houve acesso às configurações administrativas da Hostinger, Supabase ou Stripe, aos contratos desses fornecedores, aos backups nem aos registros de produção. Isto não é parecer jurídico nem certificação de conformidade.

## Atualização da verificação administrativa Supabase — 06/10/2026

Verificação somente de leitura no Dashboard do projeto `ta-marcado`, branch `main` (produção):

- Security Advisor: 0 erros, 61 avisos e 3 sugestões. Avisos observados incluem proteção contra senhas vazadas desativada, várias funções `SECURITY DEFINER` executáveis por `anon` e/ou `authenticated`, e recomendações de otimização do plano de inicialização de auth nas policies. A contagem do Advisor não determina sozinha explorabilidade; revisar cada função, o corpo SQL, `search_path`, grants e validação de associação ao negócio. Algumas funções públicas são intencionais para agendamento sem conta e não devem ter permissões removidas sem análise funcional.
- Database > Policies: botões “Disable RLS” estavam presentes para as tabelas de `public` apresentadas, indicando RLS habilitado. Algumas tabelas internas sem policies aparecem com Data API desativada ou sem retorno via Data API. A interface não foi usada para inspecionar cada expressão de policy; isolamento efetivo e grants continuam pendentes de auditoria aprofundada/testes negativos entre negócios.
- Security > Account: nenhum aplicativo autenticador cadastrado. O MFA da conta administrativa permanece pendente para o responsável ativar; não foi alterado por esta revisão.
- Plano mostrado pelo painel: Free. A página Database Backups informa que backups automáticos não estão incluídos; PITR também não está incluído. O painel indica backups diários com até 7 dias no Pro. Documentação consultada informa logs acessíveis por 1 dia no Free e 7 dias no Pro. O responsável decidiu adiar custo de backup/upgrade até haver renda; trata-se de risco operacional aceito temporariamente, não de controle compensatório nem de segurança resolvida. Avaliar exportação externa e teste de restauração quando possível.

Esta revisão remota altera o escopo da declaração inicial: houve leitura do Dashboard, mas não foram alteradas políticas, MFA, plano ou retenção. As evidências do painel e a decisão de adiar backup devem ser mantidas em `docs/STATUS-LOCAL-FIRST.md`.

## Resumo executivo

O sistema já tem controles relevantes: dados de agenda isolados por negócio via RLS, operações privilegiadas no servidor, tokens de acompanhamento aleatórios guardados como hash no banco, limite de tentativas e exclusão manual de entradas da lista de espera. A criação de contas de clientes está pausada; o agendamento anônimo permanece ativo.

**A política operacional inicial foi definida pelo responsável do produto:** solicitações e dados pessoais associados poderão ser mantidos por até 13 meses, conforme as regras abaixo; links de acompanhamento vencem separadamente e isso não apaga o pedido. O CEO da YG Systems monitora `contato@ygsystems.com.br` e atende solicitações de titulares. Isso documenta uma decisão operacional, não é parecer jurídico; obrigações específicas podem exigir conservação mínima e devem ser confirmadas juridicamente. A aplicação automática do prazo ainda não está implementada.

Correções técnicas feitas nesta revisão local:

- Novos webhooks Stripe passam a guardar apenas ID, tipo, status de processamento e um objeto vazio, não o corpo integral que pode conter dados de cobrança.
- Migration aditiva `202610060008_minimize_stripe_webhook_payload.sql` aplicada no Supabase conforme confirmação do responsável; limpa payloads de eventos Stripe processados sem apagar linhas, IDs ou dados de assinatura.
- Contato de suporte/privacidade informado: `contato@ygsystems.com.br`, exibido no rodapé global e nos Termos/Política.
- E-mail financeiro separado removido do produto; o Stripe usa o e-mail de acesso autenticado. Migration `202610060010` limpa valores anteriores e preserva a coluna legada para evitar mudança destrutiva de schema.
- Migration aditiva `202610060009_tracking_link_expires_after_appointment_day.sql` aplicada no Supabase conforme confirmação do responsável; links vencem no início do dia seguinte à data acordada pelo fuso do negócio e acompanham remarcações. Isso não exclui o atendimento.
- Uploads de JPG, PNG e WebP passam a remover segmentos/campos comuns de EXIF, XMP e texto que podem carregar localização ou identificação, sem reencodar a imagem.
- Logs de falha de transições, ações públicas de acompanhamento e Stripe deixaram de registrar mensagens brutas dos provedores/banco. A resposta funcional ao usuário não mudou.
- Política pública e Termos serão alinhados ao comportamento observado e manterão explícitas as pendências de contato e retenção, sem inventar prazos/canais.

## Inventário observado no código

| Dados | Onde/por quê | Controle observado | Retenção/exclusão observada |
|---|---|---|---|
| Conta profissional: e-mail, nome e sessão | Supabase Auth; login e operação do espaço | Cookies de sessão via Supabase SSR; páginas `/app` passam pelo proxy de sessão | Sem ferramenta de exclusão de conta na aplicação; retenção do Auth/backups depende do Supabase e de processo administrativo |
| Espaço: negócio, contato, região aproximada, serviços, expediente e Pix | Supabase; página pública e agendamento | Perfil público separado do endereço privado; acesso do negócio por membership/RLS | Sem rotina geral de encerramento/expurgo |
| Cliente e atendimento: nome, WhatsApp, data/hora, serviço, respostas, observações, justificativa de cancelamento e estado | Tabelas `clients`, `appointments`, respostas e eventos; organizar o pedido e seu histórico | Escritas públicas passam por RPCs; leituras profissionais restritas ao negócio; link de acompanhamento funciona como credencial temporária | O atendimento não expira junto com o link. Link passa a expirar no início do dia seguinte à data acordada; remarcar altera a validade. Sem prazo automático de retenção nem fluxo de exclusão de pedidos. Respostas e eventos podem estar relacionados a histórico financeiro/auditoria. |
| Token de acompanhamento | URL `/r/[token]`; permitir à cliente consultar/agir no pedido | Token aleatório de 32 bytes; apenas hash é armazenado. Token no navegador é credencial bearer: quem o possui pode acessar o pedido enquanto válido. Cabeçalho `Referrer-Policy` limita envio do caminho a outros domínios | Migration preparada para expiração no dia posterior ao atendimento acordado e atualização ao remarcar. Expiração não elimina o pedido. Logs de acesso da hospedagem podem conter URLs; retenção não foi verificada. |
| Lista de espera: nome, WhatsApp, serviço, data e observação | Supabase; pedido voluntário sem reserva | Opt-in, limite de tentativas e leitura/alteração restritas a membro do negócio | Profissional pode apagar uma entrada individual; mudança para “contatada”, “agendada” ou “encerrada” não a elimina. Sem expurgo automático. |
| Imagens de portfólio/logo/capa | Supabase Storage; apresentação do negócio | Bucket de portfólio é público para imagens associadas a negócios publicados; upload limitado a JPG/PNG/WebP até 5 MB; acesso de escrita por membro | Upload remove metadados comuns de EXIF/XMP/texto sem reencodar. Remover pelo app tenta excluir objeto e referência. Imagens de clientes ainda exigem autorização. |
| Assinatura profissional | Stripe e tabela `subscription_records`; cobrança recorrente | Operações Stripe no servidor; chave administrativa não deve ir ao cliente; Customer Portal autenticado | Ciclo de retenção e descarte no Stripe/Hostinger não foi auditado por falta de acesso aos painéis/contratos. Eventos antigos do webhook podiam guardar o JSON completo; migration de minimização pendente. |
| WhatsApp | Abre aplicativo/site externo com texto preparado | Nenhum envio automático; a pessoa ainda precisa revisar e enviar | Após abrir/enviar, o conteúdo passa a ser tratado pelo WhatsApp segundo as configurações/termos próprios desse serviço. |
| Dados técnicos e limitação de abuso | Logs da aplicação e contadores em memória | Logs de erro identificam a operação e, quando necessário, ID do registro; mensagens brutas foram removidas nas rotas revisadas. Rate limit é local ao processo | Retenção de logs do provedor e backups depende de Hostinger/Supabase e ainda precisa ser confirmada. Rate limit em memória não é compartilhado entre instâncias. |

## Pendências que precisam de decisão antes do lançamento público

1. **Canal e responsável:** `contato@ygsystems.com.br` é monitorado pelo CEO da YG Systems, conforme definição do responsável. Não o identificar como encarregado formal sem designação específica.
2. **Retenção de solicitações:** política aprovada: até 13 meses após conclusão/cancelamento; para solicitações abandonadas, até 13 meses desde a última atividade relevante. A abertura do link não reinicia o prazo. Ao atingir o prazo, a política prevê anonimizar ou remover dados identificadores (nome, telefone, respostas e observações), podendo preservar dados agregados sem identificação. O registro do pedido não precisa ser apagado apenas porque o link expirou. Dados sujeitos a obrigação legal/financeira específica podem ser mantidos separadamente, minimizados e com acesso restrito, após validação da base e prazo aplicáveis.
3. **Atendimento a direitos:** receber pedidos pelo canal publicado; verificar profissionais pelo e-mail já associado à conta e clientes pela referência/link do pedido ou confirmação via contato já cadastrado. Não solicitar documentos de identidade por padrão; usar verificação proporcional somente diante de dúvida razoável. Registrar data, categoria, referência mínima, providências e resposta, sem manter cópias de documentos. Atender imediatamente quando viável; para declaração completa de acesso, observar o prazo legal aplicável (até 15 dias conforme art. 19, II); se não puder atender de imediato, responder com a situação e os motivos. A política prevê manter esse registro mínimo por até 13 meses após encerramento, salvo obrigação específica.
4. **Implementação pendente:** a política de 13 meses está documentada, mas o código não executa automaticamente anonimização/expurgo. Antes de automatizar, revisar dependências entre pedidos, respostas, eventos e dados financeiros e validar com assessoria jurídica; não excluir registros em cascata nem aplicar limpeza automática sem testes e salvaguardas.
5. **Fornecedores e transferências:** confirmar região de hospedagem, acordos/termos de tratamento, retenção de logs/backups e suboperadores de Supabase, Hostinger, Stripe e WhatsApp. O código não revela essas configurações contratuais/administrativas.
6. **Imagens:** uploads agora removem metadados comuns; confirmar consentimento/autorização de pessoas identificáveis nas fotos. O bucket continua público para os itens publicados.
7. **Documentos jurídicos e papéis:** advogado deve revisar controlador(es), bases legais por finalidade, avisos, contratos com profissionais, transferência internacional, prazos fiscais/consumeristas e política de cancelamento. A aplicação atende negócios profissionais diferentes, então papéis e responsabilidades precisam ser definidos juridicamente.
8. **Incidentes e acesso operacional:** documentar quem pode acessar dados de produção, como revogar credenciais, investigar incidente, preservar evidências e comunicar titulares/autoridades quando aplicável. Confirmar MFA e menor privilégio nos painéis de fornecedores.

## Proposta para decidir a matriz de retenção

O prazo operacional de 13 meses foi aprovado pelo responsável, mas não é um prazo mínimo ou prazo definido pela LGPD. Não implementar expurgo automático antes da revisão jurídica e da análise das relações de dados. Regra documentada:

- manter pedidos ativos enquanto necessários à prestação do serviço;
- pedidos concluídos/cancelados: contar até 13 meses a partir do encerramento; pedidos abandonados: até 13 meses desde a última atividade relevante, sem reinício por simples abertura do link;
- no vencimento, anonimizar/remover identificadores e preservar somente o que tiver finalidade/base documentada; separar registros financeiros cuja conservação seja necessária;
- tratar lista de espera, contas, logs, backups e eventos Stripe com regras próprias, limitadas por suas finalidades e pelos períodos disponíveis/contratuais dos fornecedores;
- conservar o mínimo de metadados de eventos Stripe necessário à idempotência/auditoria, sem payload pessoal;
- definir retenção separada para backups e logs com os fornecedores.

## Fontes de referência

- Lei nº 13.709/2018 (LGPD), em especial princípios, término/conservação e direitos dos titulares: [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
- [Perguntas frequentes da ANPD sobre direitos dos titulares](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes).
- [Orientação da ANPD sobre Relatório de Impacto](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd).

## Resultado

**Status: política inicial de retenção e fluxo de atendimento documentados; controles técnicos parciais.** As migrations `202610060008` e `202610060009` foram confirmadas como aplicadas no Supabase. A regra operacional de 13 meses ainda não é aplicada automaticamente pelo sistema. Permanecem pendentes a confirmação de configurações/retenção de fornecedores e a revisão jurídica. Nenhuma dessas duas migrations exclui tabelas ou atendimentos.
