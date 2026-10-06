import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePassword({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  if (!supabase) redirect("/entrar?erro=config");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha?erro=link");

  return <main className="form-wrap"><form className="form-card" action="/api/auth/update-password" method="post">
    <span className="eyebrow">Acesso protegido</span>
    <h1>Escolha sua nova senha.</h1>
    <p>Use pelo menos 10 caracteres.</p>
    <div className="form-field"><label htmlFor="new-password">Nova senha</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></div>
    <div className="form-field"><label htmlFor="confirm-password">Confirme a nova senha</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></div>
    {erro && <p className="form-error" role="alert">{erro === "update" ? "Não foi possível atualizar a senha. Solicite um novo link e tente novamente." : "As senhas precisam ser iguais e seguir os requisitos exibidos acima."}</p>}
    <button className="btn" style={{width:"100%"}}>Salvar nova senha</button>
  </form></main>;
}
