import Image from "next/image";

export function BrandLogo({ className = "brand-logo" }: { className?: string }) {
  return <Image src="/ta-marcado-logo.webp" alt="Tá Marcado" width={5488} height={1880} className={className} />;
}
