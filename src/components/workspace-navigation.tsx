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
  const [active, setActive] = useState(false);
  const previousRoute = useRef(routeKey);

  useEffect(() => {
    if (previousRoute.current === routeKey) return;
    previousRoute.current = routeKey;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let hideTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      setActive(true);
      hideTimer = window.setTimeout(() => setActive(false), 360);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer);
    };
  }, [routeKey]);

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
