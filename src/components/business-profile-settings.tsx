"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Plus, Trash2 } from "lucide-react";

type Category = { id: string; name: string; slug: string };
type Rule = { id?: string; clientKey: string; weekday: number; start_time: string; end_time: string };
type Settings = { name: string; display_name: string; slug: string; contact_phone: string; neighborhood: string | null; city: string | null; state: string | null; bio: string; email: string; categories: Category[]; category_ids: string[]; rules: Rule[] };
const week = [{ id: 1, name: "Segunda-feira" }, { id: 2, name: "Terça-feira" }, { id: 3, name: "Quarta-feira" }, { id: 4, name: "Quinta-feira" }, { id: 5, name: "Sexta-feira" }, { id: 6, name: "Sábado" }, { id: 0, name: "Domingo" }];
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export function BusinessProfileSettings() {
  const router = useRouter();
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rulesByDay = useMemo(() => week.map(day => ({ ...day, rules: (data?.rules ?? []).filter(rule => rule.weekday === day.id) })), [data?.rules]);

  useEffect(() => {
    let active = true;
    fetch("/api/business/profile", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as configurações.");
      if (active) setData({ ...result, neighborhood: result.public_neighborhood ?? "", city: result.public_city ?? "", state: result.public_state ?? "", rules: (result.rules ?? []).map((rule: Rule) => ({ ...rule, clientKey: rule.id ?? crypto.randomUUID(), start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5) })) });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as configurações."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateRule(clientKey: string, patch: Partial<Rule>) {
    setData(current => current ? { ...current, rules: current.rules.map(rule => rule.clientKey === clientKey ? { ...rule, ...patch } : rule) } : current);
  }

  async function save() {
    if (!data) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/business/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.name, display_name: data.display_name, slug: data.slug, contact_phone: data.contact_phone, neighborhood: data.neighborhood ?? "", city: data.city ?? "", state: data.state ?? "", bio: data.bio, category_ids: data.category_ids, rules: data.rules.map(rule => ({ id: rule.id, weekday: rule.weekday, start_time: rule.start_time, end_time: rule.end_time })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar as configurações.");
      setMessage("Configurações salvas."); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar as configurações."); }
    finally { setSaving(false); }
  }

  if (loading) return <section className="panel settings-loading">Carregando as informações do seu espaço…</section>;
  if (!data) return <section className="panel"><p className="form-error" role="alert">{error || "Não foi possível carregar as configurações."}</p></section>;

  return <section className="panel business-settings">
    <div className="panel-title"><span>Informações do negócio</span></div>
    <p className="settings-intro">Esses dados alimentam sua página pública, o contato e o calendário.</p>
    <div className="settings-fields">
      <div className="form-field"><label htmlFor="settings-business-name">Nome do negócio</label><input id="settings-business-name" value={data.name} onChange={event => setData(current => current ? { ...current, name: event.target.value, slug: slugify(event.target.value) } : current)}/></div>
      <div className="form-field"><label htmlFor="settings-professional-name">Nome profissional</label><input id="settings-professional-name" value={data.display_name} onChange={event => setData(current => current ? { ...current, display_name: event.target.value } : current)}/></div>
      <div className="form-field"><label htmlFor="settings-email">E-mail da conta</label><input id="settings-email" type="email" value={data.email} readOnly/><small>É o e-mail usado para entrar. Para alterá-lo, é necessário confirmar o novo endereço por e-mail.</small></div>
      <div className="form-field"><label htmlFor="settings-phone">WhatsApp com DDD</label><input id="settings-phone" type="tel" value={data.contact_phone} onChange={event => setData(current => current ? { ...current, contact_phone: event.target.value } : current)}/></div>
      <div className="form-field settings-slug-field"><label htmlFor="settings-slug">Link público (gerado pelo nome do negócio)</label><div className="generated-slug"><span>tamarcado.ygsystems.com.br/</span><input id="settings-slug" value={data.slug} readOnly/></div></div>
    </div>
    <h3>Localização pública</h3><p className="settings-help">Mostra a região de atendimento para suas clientes; não publique seu endereço residencial.</p>
    <div className="settings-fields settings-location"><div className="form-field"><label htmlFor="settings-neighborhood">Bairro / região</label><input id="settings-neighborhood" value={data.neighborhood ?? ""} onChange={event => setData(current => current ? { ...current, neighborhood: event.target.value } : current)} placeholder="Ex.: Rio Vermelho"/></div><div className="form-field"><label htmlFor="settings-city">Cidade</label><input id="settings-city" value={data.city ?? ""} onChange={event => setData(current => current ? { ...current, city: event.target.value } : current)} placeholder="Ex.: Salvador"/></div><div className="form-field"><label htmlFor="settings-state">Estado</label><input id="settings-state" value={data.state ?? ""} onChange={event => setData(current => current ? { ...current, state: event.target.value } : current)} placeholder="Ex.: BA"/></div></div>
    <div className="form-field"><label htmlFor="settings-bio">Sobre seu trabalho</label><textarea id="settings-bio" rows={4} maxLength={1000} value={data.bio} onChange={event => setData(current => current ? { ...current, bio: event.target.value } : current)}/></div>
    <div className="form-field"><label>Áreas de atendimento</label><div className="settings-category-list">{data.categories.map(category => <label key={category.id}><input type="checkbox" checked={data.category_ids.includes(category.id)} onChange={event => setData(current => current ? { ...current, category_ids: event.target.checked ? [...current.category_ids, category.id] : current.category_ids.filter(id => id !== category.id) } : current)}/><span>{category.name}</span></label>)}</div></div>
    <div className="settings-schedule-heading"><div><h3>Expediente semanal</h3><p className="settings-help">Os horários disponíveis para clientes seguem estes períodos.</p></div><Clock3 size={19}/></div>
      <div className="settings-week">{rulesByDay.map(day => <section className="settings-weekday" key={day.id}><b>{day.name}</b><div className="settings-intervals">{day.rules.map((rule, index) => <div className="settings-interval" key={rule.clientKey}><input aria-label={`${day.name}, início do intervalo ${index + 1}`} type="time" value={rule.start_time} onChange={event => updateRule(rule.clientKey, { start_time: event.target.value })}/><span>até</span><input aria-label={`${day.name}, fim do intervalo ${index + 1}`} type="time" value={rule.end_time} onChange={event => updateRule(rule.clientKey, { end_time: event.target.value })}/><button type="button" className="pill small" aria-label={`Remover intervalo de ${day.name}`} onClick={() => setData(current => current ? { ...current, rules: current.rules.filter(item => item.clientKey !== rule.clientKey) } : current)}><Trash2 size={13}/></button></div>)}{!day.rules.length && <small className="settings-day-off">Não atende</small>}<button type="button" className="settings-add-interval" onClick={() => setData(current => current ? { ...current, rules: [...current.rules, { clientKey: crypto.randomUUID(), weekday: day.id, start_time: "09:00", end_time: "18:00" }] } : current)}><Plus size={13}/> Adicionar horário</button></div></section>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="settings-success" role="status"><Check size={15}/>{message}</p>}
    <button type="button" className="btn" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button>
  </section>;
}
