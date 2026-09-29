"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { durationDeltaToMinutes, formatDurationDelta } from "@/lib/duration";

type Option = { id?: string; label: string; price_delta_cents: number; duration_delta_minutes: number; durationText?: string; priceText?: string };
type Question = { id?: string; label: string; field_type: string; required: boolean; options: Option[] };
type Service = { id: string; name: string; questions: Question[] };
const choiceTypes = new Set(["single_choice", "multiple_choice"]);
const newQuestion = (): Question => ({ label: "", field_type: "single_choice", required: false, options: [{ label: "", price_delta_cents: 0, duration_delta_minutes: 0, priceText: "0,00", durationText: "+00:00" }] });
const newOption = (): Option => ({ label: "", price_delta_cents: 0, duration_delta_minutes: 0, priceText: "0,00", durationText: "+00:00" });

export function QuestionManager({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [selectedId, setSelectedId] = useState(initialServices[0]?.id ?? "");
  const [questions, setQuestions] = useState(initialServices[0]?.questions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selected = services.find(service => service.id === selectedId);

  function chooseService(id: string) { setServices(current => current.map(service => service.id === selectedId ? { ...service, questions } : service)); setSelectedId(id); setQuestions(services.find(service => service.id === id)?.questions ?? []); setError(""); setSuccess(""); }
  function updateQuestion(index: number, patch: Partial<Question>) { setQuestions(current => current.map((question, i) => i === index ? { ...question, ...patch } : question)); }
  function updateOption(questionIndex: number, optionIndex: number, patch: Partial<Option>) { setQuestions(current => current.map((question, qi) => qi === questionIndex ? { ...question, options: question.options.map((option, oi) => oi === optionIndex ? { ...option, ...patch } : option) } : question)); }

  async function save() {
    if (!selected) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const normalized = questions.map(question => ({ ...question, options: question.options.map(option => {
        const duration = durationDeltaToMinutes(option.durationText ?? formatDurationDelta(option.duration_delta_minutes));
        if (duration === null) throw new Error("Use o formato hh:mm para acréscimos de tempo, por exemplo +00:30 ou -00:15.");
        const price = option.priceText === undefined ? option.price_delta_cents / 100 : Number(option.priceText.replace(",", "."));
        if (!Number.isFinite(price)) throw new Error("Confira os acréscimos de preço.");
        return { id: option.id, label: option.label, price_delta_cents: Math.round(price * 100), duration_delta_minutes: duration };
      }) }));
      const response = await fetch(`/api/services/${selected.id}/questions`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ questions: normalized }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar as perguntas.");
      setServices(current => current.map(service => service.id === selected.id ? { ...service, questions: normalized.map(question => ({ ...question, options: question.options.map(option => ({ ...option, durationText: undefined, priceText: undefined })) })) } : service));
      setSuccess("Perguntas atualizadas. Atualizando os identificadores salvos…");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar as perguntas."); }
    finally { setSaving(false); }
  }

  return <section className="panel question-manager">
    <div className="panel-title">Perguntas para clientes</div>
    <p className="settings-intro">Cada serviço pode ter perguntas próprias. As respostas ficam guardadas junto da solicitação para consulta depois.</p>
    {!services.length ? <p className="trial-box">Cadastre um serviço antes de configurar as perguntas que a cliente responderá.</p> : <>
      <div className="form-field"><label htmlFor="question-service">Serviço relacionado</label><select id="question-service" value={selectedId} onChange={event => chooseService(event.target.value)}>{services.map(service => <option value={service.id} key={service.id}>{service.name}</option>)}</select></div>
      {questions.map((question, index) => <article className="question-config-card" key={question.id ?? `new-${index}`}>
        <div className="panel-title"><b>Pergunta {index + 1}</b><button type="button" className="pill" aria-label={`Remover pergunta ${index + 1}`} onClick={() => setQuestions(current => current.filter((_, i) => i !== index))}><Trash2 size={14}/></button></div>
        <div className="settings-fields"><div className="form-field"><label>Pergunta</label><input value={question.label} maxLength={200} placeholder="Ex.: Qual comprimento você prefere?" onChange={event => updateQuestion(index, { label: event.target.value })}/></div><div className="form-field"><label>Tipo de resposta</label><select value={question.field_type} onChange={event => updateQuestion(index, { field_type: event.target.value, options: choiceTypes.has(event.target.value) ? question.options.length ? question.options : [newOption()] : [] })}><option value="single_choice">Escolha única</option><option value="multiple_choice">Múltipla escolha</option><option value="text">Texto</option><option value="number">Número</option><option value="boolean">Sim ou não</option><option value="note">Observação</option></select></div></div>
        <label className="settings-inline-check"><input type="checkbox" checked={question.required} onChange={event => updateQuestion(index, { required: event.target.checked })}/> Resposta obrigatória</label>
        {choiceTypes.has(question.field_type) && <div className="question-config-options"><div className="question-config-head"><span>Opção</span><span>Acréscimo (R$)</span><span>Tempo extra (hh:mm)</span><span/></div>{question.options.map((option, optionIndex) => <div className="question-config-row" key={option.id ?? `${index}-${optionIndex}`}><input aria-label={`Texto da opção ${optionIndex + 1}`} value={option.label} maxLength={120} placeholder="Ex.: Longa" onChange={event => updateOption(index, optionIndex, { label: event.target.value })}/><input aria-label={`Preço extra da opção ${optionIndex + 1}`} inputMode="decimal" value={option.priceText ?? (option.price_delta_cents / 100).toFixed(2).replace(".", ",")} onChange={event => updateOption(index, optionIndex, { priceText: event.target.value })}/><input aria-label={`Tempo extra da opção ${optionIndex + 1}`} value={option.durationText ?? formatDurationDelta(option.duration_delta_minutes)} pattern="[+-]?\d{2}:\d{2}" onChange={event => updateOption(index, optionIndex, { durationText: event.target.value })}/><button type="button" className="pill" aria-label={`Excluir opção ${optionIndex + 1}`} onClick={() => updateQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })}><Trash2 size={13}/></button></div>)}<button type="button" className="btn secondary small" onClick={() => updateQuestion(index, { options: [...question.options, newOption()] })}><Plus size={14}/> Adicionar opção</button></div>}
      </article>)}
      <button type="button" className="btn secondary" onClick={() => setQuestions(current => [...current, newQuestion()])}><Plus size={14}/> Nova pergunta</button>
      <p className="question-config-note">Opções podem ajustar preço e duração do serviço. Exemplos: comprimento escolhido, material ou estilo.</p>
      {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="settings-success" role="status">{success}</p>}
      <button type="button" className="btn" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar perguntas"}</button>
    </>}
  </section>;
}
