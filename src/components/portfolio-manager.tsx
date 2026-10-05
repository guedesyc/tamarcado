"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";

type Item = { id: string; storage_path: string; alt_text: string; service_id: string | null };
type Service = { id: string; name: string };

export function PortfolioManager({ items, services, baseUrl }: { items: Item[]; services: Service[]; baseUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const servicesById = useMemo(() => new Map(services.map(service => [service.id, service.name])), [services]);
  const visibleItems = useMemo(
    () => selectedServiceId ? items.filter(item => item.service_id === selectedServiceId) : items,
    [items, selectedServiceId],
  );

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await fetch("/api/portfolio", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const serviceId = String(form.get("serviceId") ?? "");
      formElement.reset();
      setSelectedServiceId(serviceId);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover esta imagem do seu portfólio?")) return;
    setError("");
    const response = await fetch("/api/portfolio", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (!response.ok) {
      const result = await response.json();
      setError(result.error ?? "Não foi possível remover.");
      return;
    }
    router.refresh();
  }

  return <>
    <form className="panel" onSubmit={upload} style={{ marginBottom: 20 }}>
      <div className="panel-title"><ImagePlus size={18} /> Adicione uma foto do seu trabalho</div>
      <div className="form-field"><label htmlFor="portfolio-image">JPG, PNG ou WebP · até 5 MB</label><input id="portfolio-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
      <div className="form-field"><label htmlFor="portfolio-service">Serviço relacionado</label><select id="portfolio-service" name="serviceId" defaultValue="" required disabled={!services.length}><option value="" disabled>Selecione um serviço</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select>{!services.length && <small>Cadastre um serviço antes de adicionar fotos ao portfólio.</small>}</div>
      <div className="form-field"><label htmlFor="portfolio-alt">Descrição da imagem</label><input id="portfolio-alt" name="alt" maxLength={200} placeholder="Ex.: Box braids longas em tom castanho" /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn" disabled={busy || !services.length}>{busy ? "Enviando…" : "Adicionar ao portfólio"}</button>
      <p style={{ fontSize: 11, color: "var(--muted)" }}>Publique apenas imagens que você tem autorização para compartilhar.</p>
    </form>
    <section aria-label="Fotos do portfólio">
      <div className="form-field" style={{ maxWidth: 420 }}>
        <label htmlFor="portfolio-filter-service">Ver fotos do serviço</label>
        <select id="portfolio-filter-service" value={selectedServiceId} onChange={event => setSelectedServiceId(event.target.value)}>
          <option value="">Todos os serviços</option>
          {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
      </div>
      {visibleItems.length ? <div className="portfolio-grid">{visibleItems.map(item => <article className="panel portfolio-item" key={item.id}>
        <img src={`${baseUrl}/storage/v1/object/public/portfolio/${item.storage_path}`} alt={item.alt_text || "Foto do portfólio"} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.alt_text || "Sem descrição"}</span>
          <button aria-label="Remover foto" className="pill" onClick={() => remove(item.id)}><Trash2 size={14} /></button>
        </div>
        <small className="pill" style={{ justifySelf: "start" }}>{item.service_id ? servicesById.get(item.service_id) ?? "Serviço removido" : "Sem serviço associado"}</small>
      </article>)}</div> : <div className="panel" style={{ textAlign: "center", padding: 35, color: "var(--muted)", fontSize: 13 }}>{items.length ? "Este serviço ainda não tem fotos no portfólio." : "As fotos que você adicionar aparecem aqui e na sua página pública."}</div>}
    </section>
  </>;
}
