"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { INTRO_ATTRIBUTE, claimIntroPlayback, readIntroEnvironment } from "@/lib/intro-session";

// Vídeos pré-renderizados (ver docs/ABERTURA-HOME.md). Cada proporção tem o seu enquadramento.
const SOURCES = {
  wide: { webm: "/intro/ana-intro-wide.webm", mp4: "/intro/ana-intro-wide.mp4" },
  tall: { webm: "/intro/ana-intro-tall.webm", mp4: "/intro/ana-intro-tall.mp4" },
} as const;
const TALL_QUERY = "(max-aspect-ratio: 4/5)";
const START_TIMEOUT_MS = 4500; // se o vídeo não começar nesse tempo, a Home é liberada
const MAX_DURATION_MS = 14000; // trava de segurança: a abertura nunca bloqueia além disso
const EXIT_MS = 450;

// O atributo data-intro do <html> é a fonte da verdade: o script do <head> o define antes da
// primeira pintura, e o CSS usa o mesmo atributo para mostrar a camada e travar a rolagem.
const isPlaying = () => document.documentElement.getAttribute(INTRO_ATTRIBUTE) === "play";
const setPlaying = (on: boolean) => {
  if (on) document.documentElement.setAttribute(INTRO_ATTRIBUTE, "play");
  else document.documentElement.removeAttribute(INTRO_ATTRIBUTE);
};
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [INTRO_ATTRIBUTE] });
  return () => observer.disconnect();
}

export function HomeIntro() {
  // No servidor a camada é sempre renderizada (o CSS a esconde sem o atributo); no navegador
  // ela só permanece enquanto o <html> estiver marcado.
  const playing = useSyncExternalStore(subscribe, isPlaying, () => true);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  // Navegação interna até a Home: o script do <head> não roda de novo, então a sessão é
  // reservada aqui, antes da pintura, para a Home não aparecer por um instante.
  useLayoutEffect(() => {
    if (!isPlaying() && claimIntroPlayback(readIntroEnvironment(window))) setPlaying(true);
  }, []);

  const finish = useCallback(() => {
    if (!isPlaying()) return;
    setPlaying(false); // libera rolagem e interação com a Home já durante o fade
    setLeaving(true);
    window.setTimeout(() => {
      const video = videoRef.current;
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); } // cancela o download
      setLeaving(false);
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (!video) return;
    const src = window.matchMedia(TALL_QUERY).matches ? SOURCES.tall : SOURCES.wide;
    video.src = video.canPlayType('video/webm; codecs="av01.0.08M.08"') ? src.webm : src.mp4;
    video.muted = true;
    let started = false;
    let active = true;
    const onPlaying = () => { started = true; };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", finish);
    video.addEventListener("error", finish);
    // Autoplay recusado libera a Home; uma promessa interrompida por nova carga (AbortError) não.
    video.play().catch((error: unknown) => {
      if (active && !(error instanceof DOMException && error.name === "AbortError")) finish();
    });
    skipRef.current?.focus({ preventScroll: true });
    const startTimer = window.setTimeout(() => { if (!started) finish(); }, START_TIMEOUT_MS);
    const maxTimer = window.setTimeout(finish, MAX_DURATION_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "Tab") { event.preventDefault(); skipRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", finish);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(startTimer);
      window.clearTimeout(maxTimer);
    };
  }, [playing, finish]);

  // Se a Home for desmontada no meio da abertura, não deixa o <html> travado. A checagem
  // adiada ignora a desmontagem simulada do StrictMode, em que a camada continua no DOM.
  useEffect(() => () => {
    window.setTimeout(() => { if (!document.querySelector(".home-intro")) setPlaying(false); }, 0);
  }, []);

  if (!playing && !leaving) return null;
  return (
    <div className={`home-intro${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Abertura do Tá Marcado">
      <video ref={videoRef} className="home-intro-video" muted playsInline preload="auto" aria-hidden="true" />
      <button ref={skipRef} type="button" className="home-intro-skip" onClick={finish}>Pular abertura</button>
    </div>
  );
}
