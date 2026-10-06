import Link from "next/link";

const errors: Record<string, string> = { email: "Informe um e-mail válido.", limit: "Aguarde alguns minutos para pedir outro link.", config: "O acesso está indisponível no momento." };
export default async function CustomerForgotPassword({ searchParams }: { searchParams: Promise<{ enviado?: string; erro?: string }> }) {
  const { enviado, erro } = await searchParams;
  return <main className="form-wrap"><form className="form-card customer-auth-card" action="/api/customer/forgot-password" method="post">
    <Link href="/cliente/entrar" className="customer-back-link">← Voltar para entrar</Link><div className="customer-auth-heading"><span className="eyebrow">Conta de cliente</span><h1>Recupere sua senha.</h1></div>
    {enviado ? <p>Se este e-mail estiver cadastrado como cliente, você receberá um link seguro para criar uma nova senha.</p> : <><p>Informe seu e-mail e enviaremos um link para a sua agenda.</p><div className="form-field"><label htmlFor="customer-reset-email">E-mail</label><input id="customer-reset-email" name="email" type="email" autoComplete="email" required/></div><button className="btn" style={{ width: "100%" }}>Enviar link</button></>}
    {erro && <p className="form-error">{errors[erro] ?? "Não foi possível enviar o link."}</p>}
  </form></main>;
}
