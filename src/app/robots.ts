import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
 return { rules: [{ userAgent: "*", allow: ["/", "/precos", "/ajuda"], disallow: ["/app", "/entrar", "/cadastro", "/r/", "/api/"] }], sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://tamarcado.com.br"}/sitemap.xml` };
}
