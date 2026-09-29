"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";

type Slot = "logo" | "cover";
export function BusinessBrandingManager({ logoPath, coverPath, baseUrl }: { logoPath: string | null; coverPath: string | null; baseUrl: string }) {
  const router = useRouter();
  const [paths, setPaths] = useState({ logo: logoPath, cover: coverPath });
  const [busy, setBusy] = useState<Slot | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(slot: Slot, image?: File, remove = false) {
    setBusy(slot); setError(""); setMessage("");
    const form = new FormData(); form.set("slot", slot); if (image) form.set("image", image); if (remove) form.set("remove", "true");
    try {
      const response = await fetch("/api/business/branding", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar a imagem.");
      setPaths(current => ({ ...current, [slot]: result.path }));
      setMessage(slot === "logo" ? "Logo atualizada." : "Capa atualizada.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a imagem."); }
    finally { setBusy(""); }
  }

  function imageUrl(path: string | null) { return path ? `${baseUrl}/storage/v1/object/public/portfolio/${path}` : ""; }
  return <section className="panel" style={{ marginBottom: 20 }}>
    <div className="panel-title"><ImagePlus size={18}/> Logo e capa da empresa</div>
    <p className="settings-intro">Essas imagens aparecem na sua página pública. JPG, PNG ou WebP, até 5 MB cada.</p>
    <div className="branding-upload-grid">
      {(["logo", "cover"] as const).map(slot => <div className="form-field" key={slot}>
        <label htmlFor={`branding-${slot}`}>{slot === "logo" ? "Imagem da logo" : "Imagem da capa"}</label>
        {paths[slot] ? <img className={`brand-image-preview ${slot === "logo" ? "logo-preview" : "cover-preview"}`} src={imageUrl(paths[slot])} alt={slot === "logo" ? "Logo atual da empresa" : "Capa atual da empresa"}/> : <div className={`branding-placeholder ${slot}`} aria-hidden="true">{slot === "logo" ? "Logo" : "Prévia da capa"}</div>}
        <input id={`branding-${slot}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; if (file) void save(slot, file); event.currentTarget.value = ""; }}/>
        {paths[slot] && <button type="button" className="btn small secondary" disabled={Boolean(busy)} onClick={() => void save(slot, undefined, true)}><Trash2 size={13}/> Remover {slot === "logo" ? "logo" : "capa"}</button>}
      </div>)}
    </div>
    {busy && <p role="status" className="settings-help">Salvando imagem…</p>}{message && <p role="status" className="settings-success">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
  </section>;
}
