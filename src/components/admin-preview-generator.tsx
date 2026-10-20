"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { BatteryFull, Download, Eraser, Link2, Plus, Signal, Trash2, Wifi } from "lucide-react";
import { PublicProfileView } from "@/components/public-profile-view";
import { MAX_PREVIEW_SERVICES, buildPreviewProfile, slugify, type PreviewServiceInput } from "@/lib/preview-profile";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1200;
// The exported poster is 600×1067 CSS px rendered at 1.8× → 1080×1920 (9:16, phone/Stories format).
const POSTER_WIDTH = 600;
const POSTER_HEIGHT = 1067;
const EXPORT_PIXEL_RATIO = 1080 / POSTER_WIDTH;
const fieldStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "#fff" } as const;
const labelStyle = { display: "grid", gap: 5, fontSize: 12, fontWeight: 700 } as const;
const hintStyle = { fontSize: 11, fontWeight: 400, color: "var(--muted)" } as const;

const newService = (): PreviewServiceInput => ({ id: crypto.randomUUID(), name: "", price: "", duration: "", photo: null });

/**
 * Reads a local photo into a downscaled data URL. The object URL lives only while the
 * image decodes and is revoked right after; nothing leaves the browser. A data URL (not
 * a blob: URL) is kept because html-to-image would have to fetch blob: URLs, which the
 * site's CSP connect-src does not allow.
 */
async function readPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) throw new Error("invalid");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    // PNG logos keep their transparency; photos become JPEG to stay light.
    const keepAlpha = file.type === "image/png" || file.type === "image/webp";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AdminPreviewGenerator({ siteHost, reservedSlugs }: { siteHost: string; reservedSlugs: string[] }) {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [services, setServices] = useState<PreviewServiceInput[]>([newService()]);
  const [inputsKey, setInputsKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [captureOffset, setCaptureOffset] = useState<number | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const screenScrollRef = useRef<HTMLDivElement>(null);

  const profile = useMemo(() => buildPreviewProfile({ name, specialty, slug, description, logo, cover, services }), [name, specialty, slug, description, logo, cover, services]);
  const slugReserved = reservedSlugs.includes(profile.slug);
  const capturing = captureOffset !== null;

  // Shrinks the poster to fit narrow screens. Only the wrapper is scaled, so the export keeps full size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageScale(Math.min(1, entry.contentRect.width / POSTER_WIDTH)));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const updateService = (id: string, patch: Partial<PreviewServiceInput>) => setServices(current => current.map(service => (service.id === id ? { ...service, ...patch } : service)));

  async function pickPhoto(file: File | undefined, apply: (value: string) => void) {
    if (!file) return;
    setMessage(null);
    try { apply(await readPhoto(file)); } catch { setMessage("Use uma imagem JPG, PNG ou WebP de até 15 MB."); }
  }

  async function download() {
    const screen = screenScrollRef.current;
    if (!posterRef.current || !screen) return;
    setMessage(null);
    // The exported copy does not keep scroll positions, so the visible part is shifted with a transform instead.
    const offset = screen.scrollTop;
    screen.scrollTop = 0;
    setCaptureOffset(offset);
    try {
      await new Promise(resolve => setTimeout(resolve, 60));
      // next/image answers JPEG (no transparency) unless the request accepts WebP/AVIF, as browsers do.
      const dataUrl = await toPng(posterRef.current, { pixelRatio: EXPORT_PIXEL_RATIO, width: POSTER_WIDTH, height: POSTER_HEIGHT, fetchRequestInit: { headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" } } });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `previa-${profile.slug}.png`;
      link.click();
    } catch {
      setMessage("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setCaptureOffset(null);
      requestAnimationFrame(() => { if (screenScrollRef.current) screenScrollRef.current.scrollTop = offset; });
    }
  }

  function clear() {
    // Dropping the data URLs from state is all it takes to release the photos.
    setName(""); setSpecialty(""); setSlug(""); setSlugEdited(false); setDescription(""); setLogo(null); setCover(null);
    setServices([newService()]); setMessage(null); setInputsKey(key => key + 1);
    if (screenScrollRef.current) screenScrollRef.current.scrollTop = 0;
  }

  return <div className="admin-preview-layout">
    <form className="panel" onSubmit={event => event.preventDefault()} style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div className="panel-title">Dados da profissional</div>
      <label style={labelStyle}>Nome da profissional ou do espaço
        <input style={fieldStyle} value={name} maxLength={120} placeholder="Ana Tranças" onChange={event => { setName(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }}/>
      </label>
      <label style={labelStyle}>Especialidade e cidade
        <input style={fieldStyle} value={specialty} maxLength={80} placeholder="Trancista · Salvador" onChange={event => setSpecialty(event.target.value)}/>
      </label>
      <label style={labelStyle}>Endereço da página (slug)
        <input style={fieldStyle} value={slug} maxLength={40} placeholder="ana-trancas" onChange={event => { setSlugEdited(true); setSlug(event.target.value); }} onBlur={() => setSlug(slugify(slug))}/>
      </label>
      {slugReserved && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#8a2f45" }}>Esse endereço é reservado pelo sistema e não poderia ser usado de verdade.</p>}
      <label style={labelStyle}>Descrição curta (opcional)
        <textarea style={{ ...fieldStyle, minHeight: 70 }} value={description} maxLength={300} placeholder="Tranças com acabamento leve e duradouro." onChange={event => setDescription(event.target.value)}/>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <label style={labelStyle}>Logomarca (opcional)
          <span style={hintStyle}>Aparece no círculo sobre o cartão. Quadrada fica melhor; PNG mantém o fundo transparente.</span>
          <input key={`logo-${inputsKey}`} type="file" accept="image/*" onChange={event => pickPhoto(event.target.files?.[0], setLogo)}/>
          {logo && <button type="button" className="btn small secondary" style={{ justifySelf: "start" }} onClick={() => { setLogo(null); setInputsKey(key => key + 1); }}>Remover logomarca</button>}
        </label>
        <label style={labelStyle}>Foto de capa (opcional)
          <span style={hintStyle}>Fica no topo da página. Sem capa, aparece o fundo padrão do Tá Marcado.</span>
          <input key={`cover-${inputsKey}`} type="file" accept="image/*" onChange={event => pickPhoto(event.target.files?.[0], setCover)}/>
          {cover && <button type="button" className="btn small secondary" style={{ justifySelf: "start" }} onClick={() => { setCover(null); setInputsKey(key => key + 1); }}>Remover capa</button>}
        </label>
      </div>

      <div className="panel-title" style={{ marginTop: 8 }}>Serviços ({services.length}/{MAX_PREVIEW_SERVICES})</div>
      {services.map((service, index) => <fieldset key={service.id} style={{ display: "grid", gap: 8, border: "1px solid var(--line)", borderRadius: 14, padding: 12, margin: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 12, fontWeight: 700, padding: "0 6px" }}>Serviço {index + 1}</legend>
        <input style={fieldStyle} aria-label={`Nome do serviço ${index + 1}`} value={service.name} maxLength={120} placeholder="Box braids" onChange={event => updateService(service.id, { name: event.target.value })}/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input style={fieldStyle} aria-label={`Preço do serviço ${index + 1} em reais`} inputMode="decimal" value={service.price} placeholder="Preço (R$)" onChange={event => updateService(service.id, { price: event.target.value })}/>
          <input style={fieldStyle} aria-label={`Duração do serviço ${index + 1} em minutos`} inputMode="numeric" value={service.duration} placeholder="Duração (min)" onChange={event => updateService(service.id, { duration: event.target.value.replace(/\D/g, "") })}/>
        </div>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Foto do serviço
          <input key={`photo-${service.id}-${inputsKey}`} type="file" accept="image/*" onChange={event => pickPhoto(event.target.files?.[0], photo => updateService(service.id, { photo }))}/>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {service.photo && <button type="button" className="btn small secondary" onClick={() => updateService(service.id, { photo: null })}>Remover foto</button>}
          {services.length > 1 && <button type="button" className="btn small secondary" onClick={() => setServices(current => current.filter(item => item.id !== service.id))}><Trash2 size={14}/> Remover serviço</button>}
        </div>
      </fieldset>)}
      {services.length < MAX_PREVIEW_SERVICES && <button type="button" className="btn small secondary" style={{ justifySelf: "start" }} onClick={() => setServices(current => [...current, newService()])}><Plus size={14}/> Adicionar serviço</button>}
      {message && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#8a2f45" }}>{message}</p>}
    </form>

    <div className="admin-preview-side">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="btn small" onClick={download} disabled={capturing}><Download size={14}/> {capturing ? "Gerando…" : "Baixar imagem"}</button>
        <button type="button" className="btn small secondary" onClick={clear}><Eraser size={14}/> Limpar</button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Role a tela do celular para escolher o trecho que vai na imagem (1080×1920).</p>
      <div ref={stageRef} className="admin-preview-stage" style={{ height: POSTER_HEIGHT * stageScale }}>
        <div style={{ width: POSTER_WIDTH, transform: `scale(${stageScale})`, transformOrigin: "top left" }}>
          <div ref={posterRef} className="admin-preview-poster" style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
            <div className="admin-preview-poster-head">
              <span className="eyebrow">Prévia feita para você</span>
              <b className="serif">Sua página no Tá Marcado</b>
            </div>
            <div className="admin-preview-phone" aria-label="Prévia da página pública">
              <div className="admin-preview-phone-screen">
                <div className="admin-preview-statusbar" aria-hidden="true">
                  <span>9:41</span>
                  <span className="admin-preview-island"/>
                  <span className="admin-preview-status-icons"><Signal size={15} strokeWidth={2.4}/><Wifi size={15} strokeWidth={2.4}/><BatteryFull size={19} strokeWidth={2}/></span>
                </div>
                <div ref={screenScrollRef} className="admin-preview-phone-scroll" style={capturing ? { overflow: "hidden" } : undefined}>
                  <div inert style={capturing ? { transform: `translateY(-${captureOffset}px)` } : undefined}><PublicProfileView profile={profile} imageBaseUrl="" preview/></div>
                </div>
                <span className="admin-preview-home-indicator" aria-hidden="true"/>
              </div>
            </div>
            <div className="admin-preview-poster-link"><Link2 size={16}/> {siteHost}/{profile.slug}</div>
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>Prévia apenas visual: nada é salvo nem publicado, e as fotos ficam só neste navegador.</p>
    </div>
  </div>;
}
