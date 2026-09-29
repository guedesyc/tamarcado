"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkspaceMobileNav } from "@/components/workspace-mobile-nav";

export function BackButton() {
  const router = useRouter();
  return <button type="button" className="workspace-back-button" onClick={() => {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin && history.length > 1) router.back();
    else router.push("/app");
  }}><ArrowLeft size={15}/> Voltar</button>;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const routeKey = pathname;
  const router = useRouter();
  const [active, setActive] = useState(false);
  const previousRoute = useRef(routeKey);
  const currentRoute = useRef(routeKey);
  const pendingRoute = useRef<string | null>(null);
  const safetyTimer = useRef(0);

  useEffect(() => {
    currentRoute.current = routeKey;
    if (previousRoute.current === routeKey) return;
    previousRoute.current = routeKey;
    const startedFromLink = pendingRoute.current !== null;
    pendingRoute.current = null;
    window.clearTimeout(safetyTimer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hideTimer = window.setTimeout(() => setActive(false), startedFromLink ? 180 : 0);
    return () => window.clearTimeout(hideTimer);
  }, [routeKey]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      const nextRoute = target.pathname;
      if (nextRoute === currentRoute.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      pendingRoute.current = nextRoute;
      setActive(true);
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = window.setTimeout(() => {
        pendingRoute.current = null;
        setActive(false);
      }, 15000);
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(safetyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/app/agenda" && pathname !== "/app/solicitacoes") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [pathname, router]);

  return <>
    <div className={active ? "workspace-page-content is-transitioning" : "workspace-page-content"}>
      {pathname !== "/app/clientes" && pathname !== "/app/financeiro" && <div className="workspace-back-bar"><BackButton/></div>}
      {children}
    </div>
    <WorkspaceMobileNav />
    {active && <div className="page-transition-overlay" role="status" aria-label="Carregando página">
      <video src="/page-transition.mp4" autoPlay loop muted playsInline aria-hidden="true"/>
      <span>Carregando…</span>
    </div>}
  </>;
}
