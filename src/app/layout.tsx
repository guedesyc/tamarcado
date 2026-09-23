import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tamarcado.com.br"),
  title: { default: "Tá Marcado — Seu trabalho. Seus horários.", template: "%s | Tá Marcado" },
  description: "Crie sua página, organize seus horários e deixe suas clientes marcarem com você.",
  openGraph: { title: "Tá Marcado", description: "Seu trabalho merece mais que uma agenda no WhatsApp.", type: "website", locale: "pt_BR" },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
