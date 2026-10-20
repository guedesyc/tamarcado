"use client";

import { useState } from "react";

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function AdminMfa({ hasVerifiedFactor }: { hasVerifiedFactor: boolean }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnrollment() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/mfa/enroll", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.factorId) { setError("Não foi possível iniciar o 2FA. Tente novamente."); return; }
      setEnrollment(body);
    } finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, factorId: enrollment?.factorId }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "Não foi possível verificar o código. Tente de novo.");
        return;
      }
      window.location.reload();
    } finally { setBusy(false); }
  }

  const needsEnrollment = !hasVerifiedFactor && !enrollment;
  return <section className="form-card" style={{ maxWidth: 420 }}>
    <span className="eyebrow">Verificação em duas etapas</span>
    <h1 className="serif" style={{ fontSize: 30, margin: "10px 0" }}>Confirme que é você</h1>
    {needsEnrollment ? <>
      <p>O painel da plataforma exige um app autenticador (Google Authenticator, 1Password, Authy…).</p>
      <button className="btn" type="button" onClick={startEnrollment} disabled={busy}>Configurar 2FA</button>
    </> : <form onSubmit={verify}>
      {enrollment && <>
        <p>Escaneie o QR code no app autenticador e digite o código de 6 dígitos.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="QR code para o app autenticador" width={180} height={180} style={{ display: "block", margin: "10px auto", background: "#fff" }}/>
        <p style={{ fontSize: 12, overflowWrap: "anywhere" }}>Ou digite a chave: <code>{enrollment.secret}</code></p>
      </>}
      {!enrollment && <p>Digite o código de 6 dígitos do seu app autenticador.</p>}
      <div className="form-field">
        <label htmlFor="admin-mfa-code">Código de 6 dígitos</label>
        <input id="admin-mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} style={{ fontSize: 20, letterSpacing: 6, textAlign: "center" }}/>
      </div>
      <button className="btn" type="submit" disabled={busy || code.length !== 6}>Verificar</button>
    </form>}
    {error && <p role="alert" style={{ color: "#a33" }}>{error}</p>}
  </section>;
}
