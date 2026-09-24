# Tá Marcado — andamento e próximos passos

Atualizado em 24/09/2026. Este documento diferencia a demonstração local, a prévia estática do GitHub Pages e os recursos conectados que ainda dependem de infraestrutura.

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

“Código preparado” não significa que o ambiente remoto esteja configurado: ainda é preciso aplicar e testar as migrations no projeto Supabase, conferir variáveis secretas, webhooks e permissões.

## GitHub Pages

- [x] Prévia de apresentação estática em `index.html` na raiz do repositório; ela substitui o README como página inicial do GitHub Pages quando a origem atual é a branch `main`.
- [x] A prévia avisa que login, APIs, banco, WhatsApp e cobranças não funcionam nela.
- [ ] Após o push, confirmar que a atualização da branch chegou ao Pages e abrir `https://guedesyc.github.io/tamarcado/` para validar o `index.html` (o navegador de verificação está sem sessão autenticada no GitHub para consultar o painel de Pages).

GitHub Pages só serve arquivos estáticos. O sistema completo usa `proxy.ts`, APIs e lógica de servidor; por isso esta prévia não substitui a hospedagem do aplicativo. A documentação do Next.js lista recursos de servidor/API como incompatíveis com export estático. Para login, agenda conectada e links reais de acompanhamento será necessário um host com runtime Next.js, além de Supabase configurado.

## Próximas etapas recomendadas

### Antes de usar com profissionais/clientes reais

- [ ] Confirmar a publicação da prévia Pages e revisar o site em desktop e celular.
- [ ] Revisar e testar a jornada inteira: solicitação, proposta, aceite/recusa, sinal, expiração, cancelamento e confirmação.
- [ ] Validar concorrência de horários, cancelamento durante sinal pendente, liberação após expiração e consistência entre agenda e clientes.
- [ ] Definir política operacional para cancelamento pela profissional e devolução/uso do sinal; o pagamento Pix é direto entre as partes.
- [ ] Revisar notificações: hoje as integrações `wa.me` preparam mensagens para envio; não são disparos automáticos.
- [ ] Completar estados de falta/no-show, atendimento concluído, lembretes e lista de espera.
- [ ] Melhorar testes automatizados de regras de duração/preço, disponibilidade, transições e tokens; revisar acessibilidade, lint e comportamento mobile.
- [ ] Revisar texto jurídico, privacidade, retenção de dados, suporte e política de cancelamento com assessoria apropriada antes do lançamento.

### Para ativar o aplicativo conectado

- [ ] Configurar Supabase, aplicar todas as migrations na ordem, testar RLS e isolamento entre negócios.
- [ ] Configurar domínio e hospedagem com suporte a Next.js (a prévia GitHub Pages não executa o servidor).
- [ ] Configurar variáveis de ambiente e autenticação/e-mail; nunca versionar chaves privadas.
- [ ] Configurar Asaas em sandbox, validar checkout recorrente de R$ 49,99, webhooks idempotentes e cancelamento; só então habilitar produção.
- [ ] Testar uploads, segurança, backups, logs, rate limiting e recuperação de falhas.

## Como testar localmente

1. Rodar `npm run dev`.
2. Abrir `http://localhost:3000/demo` para o painel e `http://localhost:3000/demo/fluxo` para o laboratório cliente ↔ profissional.
3. Os dados de demonstração pertencem ao navegador atual; não são sincronizados entre dispositivos nem devem conter dados reais.

## Referências

- Prompt para continuar o trabalho: `docs/PROMPT-CONTINUACAO-LOCAL-FIRST.md`.
- Entrada do GitHub Pages: `index.html` na raiz do repositório.
