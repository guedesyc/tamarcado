# Prompt para continuar o Tá Marcado

Copie o texto abaixo para continuar o desenvolvimento em outra conversa:

---

Você está continuando o desenvolvimento do **Tá Marcado** neste repositório: `https://github.com/guedesyc/tamarcado`.

## Objetivo e ordem obrigatória

Quero primeiro uma V1 coerente e utilizável localmente. **Não configure banco remoto, hospedagem, domínio, cobrança ou serviços externos nesta fase.** O Supabase/Asaas e as migrations já preparados são contexto para uma etapa futura; preserve-os, mas concentre as próximas mudanças em fluxos locais e dados fictícios no navegador. Só migre para banco e hospedagem quando eu pedir explicitamente.

Priorize, nesta ordem: fluxo cliente–profissional; integridade de agenda e negociação; simplicidade mobile; acessibilidade; manutenção. Antes de alterar, leia o código e `docs/STATUS-LOCAL-FIRST.md`, confira a branch e as mudanças existentes e preserve trabalho do usuário.

## Estado atual

- Aplicação em Next.js App Router, React, TypeScript strict, Tailwind 4, Zod e ícones Lucide. `npm run typecheck` passou após os ajustes mais recentes. Build de produção não foi revalidado nesta rodada.
- Landing page, páginas legais iniciais, cadastro/login/recuperação, onboarding, painel e APIs preparados para Supabase. Esses fluxos de produção dependem de Supabase configurado; não são o caminho da demonstração sem banco.
- Há uma prévia pública fictícia em `/exemplo-trancista`. A marca usa logo própria e paleta blush/rose gold com ameixa escura.
- `/demo` contém o painel demonstrativo de Ana Tranças; dados são gravados em `localStorage`.
- `/demo/fluxo` é o laboratório local. Tem perguntas de Box braids (comprimento, tamanho, material e foto de referência), permite criar perguntas (escolha única/múltipla, texto, número, sim/não e foto), calcula estimativa de preço/duração, apresenta horários segundo expediente e atendimentos confirmados, recebe pedido da cliente e mostra-o à profissional. A profissional pode confirmar, recusar ou propor outro horário, preço, duração e mensagem. A cliente pode aceitar, escolher outro horário ou cancelar. Há histórico e calendário mensal para selecionar data e horários no fluxo da cliente. O painel `/demo` também usa calendário mensal para agenda profissional e agendamento. A aba Calendário dentro de `/demo/fluxo` ainda está semanal e precisa ser convertida para visão mensal.
- Esse modo é uma simulação local, não produção: estado no mesmo perfil de navegador/abas, sem autenticação, sem sincronização entre dispositivos e sem envio real. Painel e fluxo usam chaves distintas no `localStorage` para evitar conflitos entre seus formatos; dados antigos do fluxo na chave anterior não são migrados automaticamente. Campo de foto guarda somente o nome escolhido; financeiro e parte do painel ainda são ilustrativos. O editor informa claramente os adicionais de preço e duração (zero significa sem adicional) e tem botão compacto para remover opção.
- Checklist vivo: `docs/STATUS-LOCAL-FIRST.md`.

## Próximos passos locais

1. **Validar e corrigir o percurso completo** `/demo/fluxo`: opções obrigatórias e opcionais; uma/múltiplas respostas; modificadores de preço e duração; slot que respeita duração total; proposta de dia/horário/preço/duração; aceite; recusa; remarcação pedida pela cliente; cancelamento; calendário atualizado. Teste em desktop e celular, com atenção às abas Profissional: responder e Cliente: acompanhar e ao calendário mensal. Não considere apenas o typecheck/build como teste funcional.
2. **Terminar editor local de serviços/perguntas:** editar serviço, preço base, duração, intervalo e ativo; tornar pergunta opcional; editar/reordenar/remover perguntas e opções e seus modificadores depois de criados; manter templates opcionais por categoria.
3. **Terminar agenda local:** converter a aba Calendário de `/demo/fluxo` para visão mensal com detalhe do dia; concluir criação manual, edição/cancelamento, bloqueios de horário/dia, férias e exceções. O painel `/demo` já tem calendário mensal; conferir fluxos e responsividade. Reservas pendentes não bloqueiam; pedidos confirmados devem bloquear o intervalo completo, incluindo duração e preparação.
4. **Completar dados locais relacionados:** clientes e histórico derivados de pedidos; financeiro editável com previsto/recebido/status/forma; perfil e link refletindo as configurações; portfólio com arquivos locais de demonstração e validações apropriadas.
5. Implementar estados vazios/erro/loading, permitir restaurar dados fictícios, tratar estado inválido no `localStorage`, melhorar o histórico e validar navegação teclado/contraste/mobile.
6. Criar testes locais automatizados para preço/duração, slots e conflitos, transições, trial e persistência; fazer uma rodada manual E2E da jornada completa. Resolver erros de lint sem desativar regras.
7. Atualizar `docs/STATUS-LOCAL-FIRST.md` à medida que cada item realmente ficar pronto. Distinguir claramente simulação local de funcionalidade real. Ao final, reportar o que foi validado e o que continua pendente.

Quando todos os fluxos locais forem aceitos, pare antes de conectar Supabase/Asaas ou publicar. A etapa seguinte será planejar e executar essa migração comigo.

---
