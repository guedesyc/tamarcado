import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_HINT } from "@/lib/password-policy";

export default async function CustomerNewPassword({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/cliente/entrar?erro=callback");
  return <main className="form-wrap"><form className="form-card customer-auth-card" action="/api/customer/update-password" method="post"><span className="eyebrow">Conta de cliente</span><h1>Escolha sua nova senha.</h1><p>{PASSWORD_HINT}</p><div className="form-field"><label htmlFor="customer-new-password">Nova senha</label><input id="customer-new-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></div><div className="form-field"><label htmlFor="customer-confirm-password">Confirme a nova senha</label><input id="customer-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></div>{erro && <p className="form-error">Confira a senha e tente novamente.</p>}<button className="btn" style={{ width: "100%" }}>Salvar nova senha</button></form></main>;
}
