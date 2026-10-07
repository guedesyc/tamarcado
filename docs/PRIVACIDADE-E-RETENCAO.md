# Auditoria técnica de privacidade e retenção — Tá Marcado

**Revisão do repositório:** 06/10/2026  
**Escopo:** código, migrations e textos versionados. Não houve acesso às configurações administrativas da Hostinger, Supabase ou Stripe, aos contratos desses fornecedores, aos backups nem aos registros de produção. Isto não é parecer jurídico nem certificação de conformidade.

## Resumo executivo

O sistema já tem controles relevantes: dados de agenda isolados por negócio via RLS, operações privilegiadas no servidor, tokens de acompanhamento aleatórios guardados como hash no banco, limite de tentativas e exclusão manual de entradas da lista de espera. A criação de contas de clientes está pausada; o agendamento anônimo permanece ativo.

**Ainda não considero a frente de privacidade pronta para lançamento público.** O canal de contato informado pelo responsável é `contato@ygsystems.com.br`; faltam formalizar prazos de retenção por categoria, processo operacional para pedidos de direitos e revisão jurídica. Pedidos e histórico de clientes não são apagados automaticamente: o vencimento do link bloqueia o acesso por aquele token, mas não elimina os registros. Isso é intencional por enquanto: o histórico pode ser necessário para prestar o serviço, suporte e conciliação financeira; não se deve apagar pedidos junto com a credencial do link nem inventar um prazo sem avaliar obrigações aplicáveis. A exclusão de conta do cliente não é oferecida pela interface.

Correções técnicas feitas nesta revisão local:

- Novos webhooks Stripe passam a guardar apenas ID, tipo, status de processamento e um objeto vazio, não o corpo integral que pode conter dados de cobrança.
- Migration aditiva `202610060008_minimize_stripe_webhook_payload.sql` preparada para esvaziar os corpos de eventos antigos, preservando as linhas e os IDs necessários à idempotência. **Ainda precisa ser aplicada no Supabase**; não foi executada remotamente.
- Migration `202610060008` limpa somente payloads de eventos Stripe já processados; eventos não processados permanecem intactos. Não exclui linhas, assinaturas, cobranças ou outros dados financeiros.
- Contato de suporte/privacidade informado: `contato@ygsystems.com.br`, exibido no rodapé global e nos Termos/Política.
- Migration aditiva `202610060009_tracking_link_expires_after_appointment_day.sql` preparada para expirar links no início do dia seguinte à data acordada, pelo fuso do negócio; ao remarcar, a validade dos links existentes acompanha a data. Isso não exclui o atendimento. **Precisa ser aplicada no Supabase**.
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

1. **Canal de privacidade e suporte:** endereço informado `contato@ygsystems.com.br` e exibido no site. Ainda cabe definir responsáveis, triagem, prazos de resposta e verificação de identidade antes de alterar/excluir dados.
2. **Matriz de retenção:** aprovar prazos e finalidades por categoria (solicitação abandonada/expirada, concluída/cancelada, lista de espera, perfil, logs, eventos Stripe e backups), incluindo exceções legais/contábeis e o que será anonimizado. O vencimento do link é controle de acesso, não prazo de exclusão dos dados; nenhum prazo arbitrário foi aplicado.
3. **Processo de direitos e exclusão:** estabelecer autenticação do solicitante, atendimento, exportação/correção e exclusão ou anonimização seletiva. Hoje apagar uma entrada da lista de espera é possível, mas não cobre todos os dados; apagar a conta Auth não deve ser usado como política de retenção porque o resultado em cascata depende do papel e pode apagar o espaço profissional.
4. **Fornecedores e transferências:** confirmar região de hospedagem, acordos/termos de tratamento, retenção de logs/backups e suboperadores de Supabase, Hostinger, Stripe e WhatsApp. O código não revela essas configurações contratuais/administrativas.
5. **Imagens:** uploads agora removem metadados comuns; confirmar consentimento/autorização de pessoas identificáveis nas fotos. O bucket continua público para os itens publicados.
6. **Documentos jurídicos e papéis:** advogado deve revisar controlador(es), bases legais por finalidade, avisos, contratos com profissionais, transferência internacional, prazos fiscais/consumeristas e política de cancelamento. A aplicação atende negócios profissionais diferentes, então papéis e responsabilidades precisam ser definidos juridicamente.
7. **Incidentes e acesso operacional:** documentar quem pode acessar dados de produção, como revogar credenciais, investigar incidente, preservar evidências e comunicar titulares/autoridades quando aplicável. Confirmar MFA e menor privilégio nos painéis de fornecedores.

## Proposta para decidir a matriz de retenção

Não definir/aplicar limpeza automática até haver aprovação dos responsáveis e revisão jurídica. Como base de discussão (não como prazo legal):

- manter pedidos ativos enquanto necessários à prestação do serviço;
- para pedidos encerrados, decidir prazo operacional/contábil e então apagar ou anonimizar nome, telefone, respostas e notas, preservando somente dados estritamente necessários;
- remover entradas de lista de espera quando a cliente retirar o pedido ou após um prazo curto aprovado;
- conservar o mínimo de metadados de eventos Stripe necessário à idempotência/auditoria, sem payload pessoal;
- definir retenção separada para backups e logs com os fornecedores.

## Fontes de referência

- Lei nº 13.709/2018 (LGPD), em especial princípios, término/conservação e direitos dos titulares: [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
- [Perguntas frequentes da ANPD sobre direitos dos titulares](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes).
- [Orientação da ANPD sobre Relatório de Impacto](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd).

## Resultado

**Status: revisão técnica realizada; lançamento público ainda condicionado.** Contato definido e controles técnicos preparados. Ainda faltam formalizar retenção e fluxo de direitos/exclusão, confirmar fornecedores/backups/logs e aplicar as migrations `202610060008` (limpeza apenas de payloads Stripe processados) e `202610060009` (expiração dos links por dia do atendimento). Revisão jurídica continua recomendada. Nenhuma tabela ou registro de atendimento será excluído por essas migrations.
