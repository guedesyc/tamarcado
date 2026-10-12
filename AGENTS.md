# Instruções do repositório Tá Marcado

## Encontrar o projeto e retomar o trabalho

- A raiz deste repositório é a pasta que contém este arquivo, `.git`, `package.json`, `src/` e `supabase/`. Não assuma que o caminho local é igual em outro computador; confirme com `git rev-parse --show-toplevel`.
- Antes de alterar arquivos, confira `git status --short --branch`, `git remote -v` e `git log -5 --oneline`. Se houver rede e a árvore estiver segura, faça `git fetch origin` e compare com `origin/main`. Preserve qualquer alteração local; nunca apague, sobrescreva ou descarte trabalho do usuário sem pedido explícito.
- `main` é a branch de trabalho e publicação autorizada pelo usuário. Ao concluir uma alteração solicitada, revise o diff, rode as verificações apropriadas ao pedido, crie um commit claro e envie com `git push origin main`. Não use `--force`, reset destrutivo ou rebase que descarte commits.
- Se o push falhar por autenticação, mantenha o commit local e peça ao usuário para autenticar no GitHub CLI com `gh auth login -h github.com`, `gh auth setup-git` e verificar `gh auth status -h github.com`. Depois que a autenticação for renovada, tente o push pendente; não peça tokens ou senhas no chat.
- O usuário costuma usar PowerShell para autenticar e pode ter outro checkout em uma pasta diferente. Peça ou descubra o caminho atual com `git rev-parse --show-toplevel`; não presuma que a pasta aberta no terminal antigo é a raiz correta.

## Segurança e produção

- Nunca coloque chaves, tokens, senhas, dados pessoais ou valores de `.env.local` no código, commits, logs, documentação versionada ou respostas. `.env.local` é ignorado pelo Git; use `.env.example` apenas com nomes e valores vazios/de exemplo.
- Não altere recursos remotos do Supabase, Stripe, Hostinger, domínio, nem execute/aplique migrations de produção sem autorização explícita. Um commit/push para GitHub não significa que houve deploy na Hostinger.
- Confira migrations existentes antes de propor outra. Prefira mudanças aditivas e preserve dados; nunca suponha que uma migration foi aplicada sem confirmação ou evidência.
- A prévia do GitHub Pages é estática; o produto completo usa Next.js, Supabase e APIs hospedadas. Não confunda preview local, GitHub Pages e produção.
- Mensagens de WhatsApp são preparadas para envio manual quando o fluxo assim indicar; não afirme que foram enviadas automaticamente.

## Aplicação

- Stack: Next.js App Router, React, TypeScript, Supabase/PostgreSQL/Auth/Storage e Stripe Billing. Use Node.js 20.9+; o ambiente Hostinger reportado usa Node 22.x.
- Leia `README.md` para setup local, `docs/STATUS-LOCAL-FIRST.md` para o estado conhecido do produto, e os documentos específicos em `docs/` para Stripe, contas de cliente e privacidade. Datas, hashes e pendências desses documentos são registros históricos: confirme sempre o estado atual do Git e não trate um item como pendente/concluído sem verificar.
- Mantenha `docs/STATUS-LOCAL-FIRST.md` atualizado quando um comportamento, migration, validação ou estado de deploy mudar. Diferencie o que foi implementado, o que foi enviado ao GitHub, o que foi implantado e o que foi confirmado no serviço remoto.
- Use `npm ci` para instalar dependências reproduzíveis. Comandos disponíveis: `npm run dev`, `npm run typecheck`, `npm test`, `npm run lint` e `npm run build` (Webpack). Só execute testes/build quando solicitado ou quando forem necessários para validar a mudança; explique verificações não executadas.
- Preserve a identidade visual existente e priorize acessibilidade, mensagens simples, desempenho e responsividade móvel.
