import { CustomerLoginForm } from "@/components/customer-login-form";

export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; cadastro?: string }> }) {
  const { erro, cadastro } = await searchParams;
  return <main className="form-wrap"><CustomerLoginForm error={erro}/>{cadastro === "confirme-email" && <p className="customer-auth-notice" role="status">Enviamos um link de confirmação para seu e-mail. Abra-o para entrar na sua agenda.</p>}</main>;
}
