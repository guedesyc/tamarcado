"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isExternalWorkspaceLink, workspaceLinks } from "@/lib/workspace-links";

export function WorkspaceMobileNav() {
  const pathname = usePathname();
  if (pathname === "/app/onboarding") return null;

  return (
    <nav className="mobile-nav workspace-mobile-nav" aria-label="Navegação do espaço">
      {workspaceLinks.map(([label, href]) => isExternalWorkspaceLink(href)
        ? <a href={href} key={href} target="_blank" rel="noopener noreferrer" aria-label="Treinamento (abre em nova aba no Google Drive)">{label}</a>
        : <Link href={href} key={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
      )}
    </nav>
  );
}
