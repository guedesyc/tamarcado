import Link from "next/link";

export function SupportFooter() {
  return <footer className="support-footer">
    <span>Precisa de ajuda?</span>
    <Link href="mailto:contato@ygsystems.com.br">Fale com o suporte: contato@ygsystems.com.br</Link>
  </footer>;
}
