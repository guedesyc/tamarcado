import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
 const base=process.env.NEXT_PUBLIC_SITE_URL??"https://tamarcado.com.br";
 return ["", "/precos", "/ajuda", "/termos", "/privacidade", "/ana-trancas"].map((path)=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:path===""?"weekly":"monthly",priority:path===""?1:0.6}));
}
