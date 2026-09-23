import Image from "next/image";

export function BrandLogo({ className = "brand-logo" }: { className?: string }) {
  return <Image src="/ta-marcado-logo.webp" alt="Tá Marcado" width={1800} height={581} className={className} />;
}
