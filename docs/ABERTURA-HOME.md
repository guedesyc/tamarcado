# Abertura da Home com a Ana

Vídeo de 8 s, sem áudio, exibido em tela cheia **somente na Home (`/`)**, uma vez por sessão de navegação:
Ana olha o celular → toque visto de dentro da tela ("Quero marcar!" + ✓) → a câmera sai do celular → Ana levanta o olhar e sorri → a luz do celular abre a logo oficial → a camada se dissolve sobre a Home.

## Como funciona no site

| Peça | Arquivo | Papel |
| --- | --- | --- |
| Regra de sessão | `src/lib/intro-session.ts` | `claimIntroPlayback` reserva a abertura uma vez por sessão (`sessionStorage`, chave `tm:intro-home`, valor `"1"`; nenhum dado pessoal). `INTRO_BOOT_SCRIPT` faz o mesmo antes da primeira pintura. |
| Script de inicialização | `src/app/layout.tsx` (`<head>`) | Em carregamentos completos de `/`, marca `<html data-intro="play">` antes da primeira pintura. Fora da Home retorna sem fazer nada e não consome a sessão. |
| Camada | `src/components/home-intro.tsx` | Escolhe o vídeo (vertical se a tela for `≤ 4:5`), toca mudo, mostra **Pular abertura**, libera a Home ao terminar, em erro, se não começar em 4,5 s ou após 14 s. Em navegação interna até a Home, faz a reserva da sessão no `useLayoutEffect`. |
| Estilos | `src/app/marketing.css` (final) | Mostra a camada e trava a rolagem só com `html[data-intro=play]`; poster por proporção; botão com área de toque de 44 px e áreas seguras. |
| Montagem | `src/app/page.tsx` | `<HomeIntro/>` antes do conteúdo. Nenhuma outra rota usa o componente. |
| Vídeos | `public/intro/` | `ana-intro-{wide,tall}.webm` (AV1), `.mp4` (H.264, fallback) e `-poster.webp`. |

Regras atendidas: o vídeo começa automaticamente e mudo; o atributo é marcado no **início** da abertura (atualizar ou voltar à Home não repete); uma nova aba/sessão pode exibir de novo (navegadores que restauram ou duplicam abas preservam o `sessionStorage`, então nesses casos a abertura não volta — não há detecção perfeita de fechamento). Com `prefers-reduced-motion: reduce`, economia de dados (`Save-Data`) ou rede 2G a abertura não toca e a sessão não é consumida. `Esc` também pula; o foco fica no botão durante a abertura. Ao sair, o `src` do vídeo é removido para cancelar o download.

## Como trocar o vídeo ou mudar a duração

- **Trocar o vídeo:** substitua os seis arquivos em `public/intro/` mantendo os nomes. O último quadro deve terminar no fundo da marca (`#fbf8f4`) para a dissolução sobre a Home ficar invisível.
- **Duração:** o componente segue o evento `ended` do próprio vídeo, então basta renderizar um vídeo mais curto/longo. Se passar de ~13 s, aumente `MAX_DURATION_MS` em `home-intro.tsx`.
- **Desativar:** remova `<HomeIntro/>` de `src/app/page.tsx` **e** o `<script>` do `<head>` em `src/app/layout.tsx` (sem o componente, o atributo marcado pelo script travaria a rolagem da Home).

## Produção do vídeo (fora do site)

Produção feita localmente, sem serviços pagos, na pasta de produção `E:\tamarcado-intro` (kit de scripts copiado para `video-home/`, não versionado):

1. **Quadros-chave** — Qwen-Image-Edit-2511 (Apache 2.0) a partir da imagem oficial da Ana (`ref/ana.jpg`): Ana olhando o celular, sorrindo para a câmera, visão de dentro da tela e o dedo tocando a lente.
2. **Movimento** — Wan 2.2 Image-to-Video 14B (Apache 2.0) + LoRA Lightx2v 4 passos, em ComfyUI (`E:\ComfyUI`). Planos com quadro inicial **e final** travados (reação e toque) para preservar a identidade e a continuidade. O afastamento do dedo é a aproximação invertida.
3. **Interpolação** — RIFE ×2 (16 → 32 fps).
4. **Composição** — Remotion (`comp/`), 30 fps: `timeline.ts` concentra os tempos e todos os efeitos usam o instante de contato `TOUCH`; `Intro.tsx` tem `TouchTransition` (brilho, anéis, ✓ e "Quero marcar!"), as transições de entrar/sair do celular e `BrandReveal` com a logo oficial `ta-marcado-logo.webp`.
5. **Codificação** — `scripts/encode.sh`: AV1 (SVT-AV1) + H.264 + poster WebP.

Para renderizar de novo após mudar a composição:

```bash
cd E:/tamarcado-intro/comp
npx remotion render src/index.ts IntroWide ../out/master_wide.mp4 --codec=h264 --crf=10
npx remotion render src/index.ts IntroTall ../out/master_tall.mp4 --codec=h264 --crf=10
bash ../scripts/encode.sh ../out/master_wide.mp4 ../out/web ana-intro-wide
bash ../scripts/encode.sh ../out/master_tall.mp4 ../out/web ana-intro-tall
```

Licenças: Wan 2.2 e Qwen-Image-Edit são Apache 2.0 (uso comercial permitido). Remotion é gratuito para pessoas físicas e empresas com até 3 funcionários; acima disso exige licença da Remotion.
