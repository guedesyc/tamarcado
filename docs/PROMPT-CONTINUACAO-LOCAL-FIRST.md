# Prompt para continuar o Tá Marcado

Você está continuando o projeto `https://github.com/guedesyc/tamarcado`. Leia primeiro `docs/STATUS-LOCAL-FIRST.md`, confira `git status`, a branch e o histórico antes de editar. Preserve mudanças locais existentes.

## Objetivo

Construir e validar uma V1 confiável para profissionais autônomas de beleza. O fluxo principal deve ser simples para a cliente (sem cadastro) e reduzir trabalho manual da profissional. Mantenha sempre distinta a demonstração local, a prévia estática e o produto conectado.

## Estado atual

- Next.js App Router/React/TypeScript com módulos de painel, agenda, solicitações, clientes, serviços, portfólio, página pública, configurações e assinatura.
- `/demo` e `/demo/fluxo` são laboratórios locais; dados fictícios ficam no `localStorage` do navegador.
- O fluxo ligado ao backend já tem acompanhamento por token, preparo de mensagens de WhatsApp com link individual e lógica de sinal Pix com prazo de uma hora e confirmação manual da profissional. Não prometa detecção automática de pagamento.
- O preço do plano é R$ 49,99/mês nos textos e no valor do checkout Asaas.
- A migration `202609230001_public_booking_signal.sql` foi criada, mas deve ser aplicada e validada no Supabase antes do fluxo de sinal funcionar no ambiente conectado.
- A pasta `site/` contém uma página `index.html` independente para GitHub Pages. O workflow `.github/workflows/pages.yml` publica apenas essa prévia estática. Pages não executa o aplicativo Next.js, `proxy.ts`, APIs ou lógica de servidor; não tente habilitar `output: "export"` no app inteiro sem antes resolver as incompatibilidades e definir o escopo estático.
- A publicação depende de Pages configurado para GitHub Actions em Settings → Pages e de confirmação da execução após o push.
- Verificações locais recentes: `npm run typecheck`, `npm run build` e `git diff --check` passaram antes das últimas mudanças de documentação/publicação; rode-as novamente após mudanças.

## Próximos passos

1. Confirmar o workflow do GitHub Pages, abrir a URL publicada e revisar visualmente em celular/desktop. Corrigir somente problemas do site estático sem sugerir que o backend está conectado.
2. Testar E2E as transições pedido → proposta → resposta → sinal → verificação → confirmação, incluindo expiração, cancelamento, horários concorrentes e atualizações da agenda/clientes.
3. Definir junto ao usuário a política de cancelamento pela profissional e o tratamento do sinal, que é Pix direto entre cliente e profissional.
4. Completar lembretes, estado de falta/no-show, lista de espera e notificações. Hoje `wa.me` apenas abre uma mensagem preparada para envio manual.
5. Aprimorar testes automatizados para disponibilidade, cálculo de duração/preço, transições e tokens; revisar acessibilidade, responsividade e lint.
6. Quando o usuário autorizar a etapa de produção, configurar Supabase e Asaas em sandbox, aplicar/testar migrations e RLS, validar webhooks, configurar hospedagem com runtime Next.js, domínio, segredos, monitoramento e backup. GitHub Pages não hospeda o backend.
7. Atualizar `docs/STATUS-LOCAL-FIRST.md` somente quando o item tiver sido realmente implementado e verificado.

Não presuma que um botão do WhatsApp enviou a mensagem; o app só prepara o texto/link. Não publique dados reais nem exponha chaves. Não altere banco remoto, domínio ou infraestrutura de produção sem autorização explícita.
