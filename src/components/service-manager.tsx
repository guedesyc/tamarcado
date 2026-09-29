"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Scissors, Trash2 } from "lucide-react";
import { durationDeltaToMinutes, durationToMinutes } from "@/lib/duration";

type Option = { key: string; label: string; priceDelta: string; durationDelta: string };
type Question = { key: string; label: string; type: string; required: boolean; options: Option[] };
const choices = new Set(["single_choice", "multiple_choice"]);
const newOption = (): Option => ({ key: crypto.randomUUID(), label: "", priceDelta: "0", durationDelta: "+00:00" });
const newQuestion = (): Question => ({ key: crypto.randomUUID(), label: "", type: "single_choice", required: false, options: [newOption()] });

export function ServiceManager() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);

  function changeQuestion(key: string, update: Partial<Question>) {
    setQuestions(current => current.map(question => question.key === key ? { ...question, ...update } : question));
  }
  function changeOption(questionKey: string, optionKey: string, update: Partial<Option>) {
    setQuestions(current => current.map(question => question.key === questionKey ? { ...question, options: question.options.map(option => option.key === optionKey ? { ...option, ...update } : option) } : question));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const duration = form.get("duration");
    const durationMinutes = duration ? durationToMinutes(String(duration)) : null;
    if (duration && durationMinutes === null) {
      setError("Informe a duração entre 00:01 e 23:59.");
      return;
    }
    const bufferValue = String(form.get("buffer") ?? "00:00");
    const bufferMinutes = durationDeltaToMinutes(bufferValue);
    if (bufferMinutes === null || bufferMinutes < 0 || bufferMinutes > 240) {
      setError("Informe o intervalo entre 00:00 e 04:00.");
      return;
    }
    const options = questions.map(question => question.options.map(option => ({
      ...option,
      durationDelta: durationDeltaToMinutes(option.durationDelta),
    })));
    if (options.some(group => group.some(option => option.durationDelta === null))) {
      setError("Informe os adicionais de duração no formato hh:mm, por exemplo +00:30 ou -00:15.");
      return;
    }
    setSaving(true);
    let serviceCreated = false;
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"), description: form.get("description"),
          price: form.get("price") || null, duration: durationMinutes,
          buffer: bufferMinutes, simultaneousCapacity: form.get("simultaneousCapacity") || 1,
          mode: form.get("mode"),
          questions: questions.map(question => ({
            label: question.label, type: question.type, required: question.required,
            options: question.options.map(option => ({ label: option.label, priceDelta: option.priceDelta || 0, durationDelta: durationDeltaToMinutes(option.durationDelta) ?? 0 })),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      serviceCreated = true;

      const image = form.get("image");
      if (image instanceof File && image.size > 0) {
        const imageForm = new FormData();
        imageForm.set("image", image);
        imageForm.set("serviceId", String(result.id));
        imageForm.set("alt", String(form.get("name") ?? ""));
        const uploadResponse = await fetch("/api/portfolio", { method: "POST", body: imageForm });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(`Serviço salvo, mas a foto não foi adicionada: ${uploadResult.error ?? "tente novamente pelo Portfólio."}`);
      }
      setOpen(false);
      setQuestions([]);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o serviço.");
      if (serviceCreated) {
        setOpen(false);
        setQuestions([]);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button className="btn" onClick={() => { setOpen(!open); setError(""); }}><Plus size={15}/>{open ? "Fechar" : "Novo serviço"}</button>
    {error && !open && <p className="form-error" role="alert">{error}</p>}
    {open && <form className="panel" style={{ marginTop: 16 }} onSubmit={save}>
      <div className="panel-title"><Scissors size={17}/> Detalhes do serviço</div>
      <div className="form-field"><label htmlFor="service-name">Nome</label><input id="service-name" name="name" minLength={2} maxLength={120} required placeholder="Ex.: Box braids"/></div>
      <div className="form-field"><label htmlFor="service-description">Descrição</label><textarea id="service-description" name="description" rows={3} maxLength={1000}/></div>
      <div className="form-field"><label htmlFor="service-image">Foto de exemplo (opcional) · JPG, PNG ou WebP até 5 MB</label><input id="service-image" name="image" type="file" accept="image/jpeg,image/png,image/webp"/></div>
      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="form-field"><label htmlFor="service-price">Preço base (R$)</label><input id="service-price" name="price" type="number" min="0" step="0.01" placeholder="Deixe vazio para combinar"/></div>
        <div className="form-field"><label htmlFor="service-duration">Duração (hh:mm)</label><input id="service-duration" name="duration" type="time" step="60"/><small>Deixe vazio para avaliar com a cliente.</small></div>
      </div>
      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="form-field"><label htmlFor="service-buffer">Intervalo/preparação (hh:mm)</label><input id="service-buffer" name="buffer" type="time" step="60" defaultValue="00:00"/><small>Máximo: 04:00.</small></div>
        <div className="form-field"><label htmlFor="service-capacity">Quantos atendimentos deste serviço podem acontecer no mesmo horário?</label><input id="service-capacity" name="simultaneousCapacity" type="number" min="1" max="50" defaultValue="1" required/><small>Use 1 se só houver uma profissional disponível para este serviço. Este limite é independente por serviço.</small></div>
        <div className="form-field"><label htmlFor="service-mode">Como funciona o agendamento?</label><select id="service-mode" name="mode"><option value="approval">Confirmo cada solicitação</option><option value="instant">Confirmação automática</option><option value="evaluation">Avalio antes de combinar</option></select></div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title"><span>Perguntas para personalizar</span><button type="button" className="pill" onClick={() => setQuestions(current => [...current, newQuestion()])}><Plus size={13}/> Adicionar pergunta</button></div>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>As opções podem alterar o preço e o tempo. O cálculo final acontece no sistema.</p>
        {questions.map((question, index) => <article key={question.key} style={{ padding: "15px 0", borderTop: "1px solid var(--line)" }}>
          <div className="panel-title"><span>Pergunta {index + 1}</span><button type="button" aria-label="Remover pergunta" className="pill" onClick={() => setQuestions(current => current.filter(item => item.key !== question.key))}><Trash2 size={13}/></button></div>
          <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="form-field"><label>Pergunta</label><input value={question.label} maxLength={200} onChange={event => changeQuestion(question.key, { label: event.target.value })} placeholder="Ex.: Qual comprimento você prefere?" required/></div>
            <div className="form-field"><label>Tipo de resposta</label><select value={question.type} onChange={event => changeQuestion(question.key, { type: event.target.value, options: choices.has(event.target.value) ? question.options : [] })}><option value="single_choice">Escolha uma opção</option><option value="multiple_choice">Escolha várias</option><option value="text">Texto</option><option value="number">Número</option><option value="boolean">Sim ou não</option><option value="note">Observação</option></select></div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, margin: "8px 0 12px" }}><input type="checkbox" checked={question.required} onChange={event => changeQuestion(question.key, { required: event.target.checked })}/> Resposta obrigatória</label>
          {choices.has(question.type) && <div style={{ paddingLeft: 12, borderLeft: "2px solid var(--line)" }}>
            {question.options.map((option, optionIndex) => <div key={option.key} className="option-row"><input aria-label={`Opção ${optionIndex + 1}`} value={option.label} onChange={event => changeOption(question.key, option.key, { label: event.target.value })} placeholder={`Opção ${optionIndex + 1}`} required/><input aria-label="Adicional de preço em reais" type="number" step="0.01" value={option.priceDelta} onChange={event => changeOption(question.key, option.key, { priceDelta: event.target.value })} placeholder="+ R$"/><input aria-label="Adicional de duração no formato hh:mm" type="text" inputMode="text" pattern="[+-]?\\d{2}:\\d{2}" value={option.durationDelta} onChange={event => changeOption(question.key, option.key, { durationDelta: event.target.value })} placeholder="+00:30"/></div>)}
            <button type="button" className="btn secondary small" onClick={() => changeQuestion(question.key, { options: [...question.options, newOption()] })}>Adicionar opção</button>
          </div>}
        </article>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn" style={{ marginTop: 14 }} disabled={saving}>{saving ? "Salvando…" : "Salvar serviço"}</button>
    </form>}
  </>;
}
