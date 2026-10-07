"use client";

import { BrandLogo } from "@/components/brand-logo";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";

const categoryOptions = ["Tranças", "Unhas", "Cílios", "Sobrancelhas", "Depilação", "Maquiagem", "Cabelo", "Estética"];
const categorySlugs = ["trancas", "unhas", "cilios", "sobrancelhas", "depilacao", "maquiagem", "cabelo", "estetica"];
const steps = ["Sobre você", "O que você faz", "Seu primeiro serviço", "Quando você atende"];

export function OnboardingForm({ initialName, initialDraft = {}, initialCategories = [] }: { initialName: string; initialDraft?: Record<string, string>; initialCategories?: string[] }) {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(initialDraft);

  function toggle(category: string) {
    setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  }

  function saveCurrentStep() {
    const form = document.getElementById("onboarding-form");
    if (!form) return;
    const values = Object.fromEntries(Array.from(new FormData(form as HTMLFormElement).entries(), ([key, value]) => [key, String(value)]));
    setDraft(current => ({ ...current, ...values }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!categories.length) {
      setError("Escolha ao menos uma categoria.");
      setStep(1);
      return;
    }

    const form = new FormData(event.currentTarget);
    const values = { ...draft, ...Object.fromEntries(form.entries()) };
    setPending(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.business,
          displayName: values.display,
          phone: values.whatsapp,
          categories: categories.map(category => categorySlugs[categoryOptions.indexOf(category)]),
          service: values.service,
          price: values.price,
          duration: values.duration,
          description: values.description ?? "",
          start: values.start,
          end: values.end,
          city: values.city ?? "",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível configurar sua página.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível configurar sua página.");
      setPending(false);
    }
  }

  if (pending) {
    return <section className="form-card onboarding-publishing" role="status" aria-live="polite">
      <video autoPlay loop muted playsInline preload="auto" aria-hidden="true"><source src="/page-transition.mp4" type="video/mp4" /></video>
      <span className="eyebrow">Só mais um instante</span>
      <h1>Estamos configurando sua página!</h1>
      <p>Estamos organizando seu espaço para que suas clientes possam conhecer seus serviços.</p>
    </section>;
  }

  return <form className="form-card" id="onboarding-form" onChange={event => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      setDraft(current => ({ ...current, [target.name]: target.value }));
    }
  }} onSubmit={submit}>
    <Link href="/" className="brand"><BrandLogo /></Link>
    <div style={{ marginTop: 24 }}>
      <span className="eyebrow">Vamos preparar seu espaço · {step + 1}/{steps.length}</span>
      <h1>{steps[step]}</h1>
      <p>Você pode mudar essas informações depois.</p>
    </div>
    <div className="progress-steps">{steps.map((_, index) => <span className={step >= index ? "on" : ""} key={index} />)}</div>

    {step === 0 && <>
      <div className="form-field"><label htmlFor="display">Seu nome profissional</label><input id="display" name="display" defaultValue={draft.display ?? initialName} placeholder="Como suas clientes conhecem você?" required minLength={2} /></div>
      <div className="form-field"><label htmlFor="business">Nome do seu espaço ou negócio</label><input id="business" name="business" defaultValue={draft.business} placeholder="Ex.: Ana Tranças" required minLength={2} /></div>
      <div className="form-field"><label htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" type="tel" defaultValue={draft.whatsapp} placeholder="(71) 99999-9999" required minLength={10} /></div>
    </>}

    {step === 1 && <>
      <p>Marque todas as opções que combinam com seu trabalho.</p>
      <div className="service-chips">{categoryOptions.map(category => <button type="button" className="pill" style={{ background: categories.includes(category) ? "var(--green)" : "#f5e6eb", color: categories.includes(category) ? "white" : "var(--green)" }} onClick={() => toggle(category)} key={category}>{category}</button>)}</div>
    </>}

    {step === 2 && <>
      <div className="form-field"><label htmlFor="service">Qual serviço você oferece?</label><input id="service" name="service" defaultValue={draft.service} placeholder="Ex.: Box braids" required minLength={2} /></div>
      <div className="form-field"><label htmlFor="price">Preço base (R$)</label><input id="price" name="price" type="number" min="0" step="0.01" defaultValue={draft.price} placeholder="220,00" required /></div>
      <div className="form-field"><label htmlFor="duration">Duração aproximada</label><select id="duration" name="duration" defaultValue={draft.duration ?? "240"}><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="180">3 horas</option><option value="240">4 horas</option><option value="300">5 horas</option><option value="360">6 horas</option></select></div>
    </>}

    {step === 3 && <>
      <p>Uma disponibilidade inicial para sua agenda. Você ajusta dia por dia depois.</p>
      <div className="form-field"><label htmlFor="start">Começo do expediente</label><input id="start" name="start" type="time" defaultValue={draft.start ?? "09:00"} required /></div>
      <div className="form-field"><label htmlFor="end">Fim do expediente</label><input id="end" name="end" type="time" defaultValue={draft.end ?? "18:00"} required /></div>
      <div className="form-field"><label htmlFor="city">Cidade ou região atendida</label><input id="city" name="city" defaultValue={draft.city} placeholder="Ex.: Rio Vermelho, Salvador" /></div>
    </>}

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="onboarding-actions">
      {step > 0 && <button type="button" className="btn secondary" onClick={() => { saveCurrentStep(); setError(""); setStep(step - 1); }}><ArrowLeft size={14} /> Voltar</button>}
      {step < steps.length - 1
        ? <button type="button" className="btn" onClick={() => {
          const form = document.getElementById("onboarding-form");
          const requiredFields = step === 0 ? ["display", "business", "whatsapp"] : step === 2 ? ["service", "price"] : [];
          for (const name of requiredFields) {
            const field = form?.querySelector<HTMLInputElement>(`[name=${name}]`);
            if (field && !field.reportValidity()) return;
          }
          if (step === 1 && !categories.length) { setError("Escolha ao menos uma categoria."); return; }
          saveCurrentStep();
          setError("");
          setStep(step + 1);
        }}><span>Continuar</span><ArrowRight size={14} /></button>
        : <button className="btn" disabled={pending}><span>Concluir e configurar minha página</span><Check size={15} /></button>}
    </div>
  </form>;
}
