"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Início", "/app"],
  ["Agenda", "/app/agenda"],
  ["Solicitações", "/app/solicitacoes"],
  ["Clientes", "/app/clientes"],
  ["Serviços", "/app/servicos"],
  ["Perguntas", "/app/perguntas"],
  ["Financeiro", "/app/financeiro"],
  ["Portfólio", "/app/portfolio"],
  ["Minha página", "/app/minha-pagina"],
  ["Configurações", "/app/configuracoes"],
  ["Assinatura", "/app/assinatura"],
] as const;

export function WorkspaceMobileNav() {
  const pathname = usePathname();
  if (pathname === "/app/onboarding") return null;

  return (
    <nav className="mobile-nav workspace-mobile-nav" aria-label="Navegação do espaço">
      {links.map(([label, href]) => (
        <Link href={href} key={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
