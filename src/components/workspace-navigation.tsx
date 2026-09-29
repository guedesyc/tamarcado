"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return <button type="button" className="workspace-back-button" onClick={() => {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin && history.length > 1) router.back();
    else router.push("/app");
  }}><ArrowLeft size={15}/> Voltar</button>;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [active, setActive] = useState(false);
  const startedAt = useRef(0);
  const currentRoute = useRef(routeKey);
  const previousRoute = useRef(routeKey);

  useEffect(() => {
    const didNavigate = previousRoute.current !== routeKey;
    previousRoute.current = routeKey;
    currentRoute.current = routeKey;
    if (didNavigate && !active && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      startedAt.current = Date.now();
      const frame = window.requestAnimationFrame(() => setActive(true));
      return () => window.cancelAnimationFrame(frame);
    }
    if (!active) return;
    const remaining = Math.max(0, 420 - (Date.now() - startedAt.current));
    const timer = window.setTimeout(() => setActive(false), remaining);
    return () => window.clearTimeout(timer);
  }, [routeKey, active]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || `${target.pathname}?${target.searchParams.toString()}` === currentRoute.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      startedAt.current = Date.now();
      setActive(true);
      const safety = window.setTimeout(() => setActive(false), 8000);
      window.setTimeout(() => window.clearTimeout(safety), 8100);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return <>
    <div className={active ? "workspace-page-content is-transitioning" : "workspace-page-content"}>{children}</div>
    {active && <div className="page-transition-overlay" role="status" aria-label="Carregando página">
      <video src="/page-transition.mp4" autoPlay loop muted playsInline aria-hidden="true"/>
      <span>Carregando…</span>
    </div>}
  </>;
}
