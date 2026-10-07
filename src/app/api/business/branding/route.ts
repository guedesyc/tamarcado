import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameSiteOrigin } from "@/lib/request-origin";
import { stripImageMetadata } from "@/lib/image-metadata";

function detectedImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!isSameSiteOrigin(request)) return NextResponse.json({ error: "Não foi possível salvar esta imagem deste endereço." }, { status: 403 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (!member) return NextResponse.json({ error: "Somente a pessoa responsável pode alterar a identidade visual." }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Envie uma imagem válida." }, { status: 400 }); }
  const slot = form.get("slot");
  if (slot !== "logo" && slot !== "cover") return NextResponse.json({ error: "Escolha se a imagem é da logo ou da capa." }, { status: 400 });
  const column = slot === "logo" ? "avatar_path" : "cover_path";
  const file = form.get("image");
  const remove = form.get("remove") === "true";
  if (!remove && (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024)) return NextResponse.json({ error: "A imagem deve ter até 5 MB." }, { status: 400 });

  const { data: profile } = await supabase.from("professional_profiles").select("display_name,bio,avatar_path,cover_path").eq("business_id", member.business_id).maybeSingle();
  const previous = profile?.[column] ?? null;
  let path: string | null = null;
  if (!remove && file instanceof File) {
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectedImage(originalBytes);
    if (!mime || mime !== file.type) return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WebP válida." }, { status: 400 });
    let bytes: Uint8Array;
    try { bytes = stripImageMetadata(originalBytes, mime); } catch { return NextResponse.json({ error: "Não foi possível processar a imagem. Tente exportá-la novamente como JPG, PNG ou WebP." }, { status: 400 }); }
    const extension = mime === "image/jpeg" ? "jpg" : mime.slice(6);
    path = `${member.business_id}/branding/${slot}-${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, bytes, { contentType: mime, cacheControl: "3600", upsert: false });
    if (error) return NextResponse.json({ error: "Não foi possível guardar a imagem. Confira o armazenamento e tente novamente." }, { status: 400 });
  }
  const { error } = await supabase.from("professional_profiles").upsert({ business_id: member.business_id, display_name: profile?.display_name ?? user.email ?? "Profissional", bio: profile?.bio ?? "", avatar_path: column === "avatar_path" ? path : profile?.avatar_path ?? null, cover_path: column === "cover_path" ? path : profile?.cover_path ?? null }, { onConflict: "business_id" });
  if (error) {
    if (path) await supabase.storage.from("portfolio").remove([path]);
    return NextResponse.json({ error: "A imagem foi enviada, mas não foi possível associá-la ao perfil." }, { status: 500 });
  }
  if (previous && previous !== path) await supabase.storage.from("portfolio").remove([previous]);
  return NextResponse.json({ ok: true, path }, { headers: { "Cache-Control": "no-store" } });
}
