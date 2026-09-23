import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return <main className="form-wrap"><form className="form-card" action="/api/auth/login" method="post"><Link href="/" style={{fontSize:12,color:"var(--muted)"}}><ArrowLeft size={14}/> Voltar ao início</Link><div style={{marginTop:26}}><span className="eyebrow">Bom ter você por aqui</span><h1>Entre no seu espaço.</h1><p>Acesse sua agenda e continue de onde parou.</p></div><div className="form-field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required/></div><div className="form-field"><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required/><Link href="/esqueci-senha" style={{fontSize:11,color:"var(--green)"}}>Esqueci minha senha</Link></div><button className="btn" style={{width:"100%",marginTop:8}}>Entrar</button><p style={{textAlign:"center",fontSize:12}}>Ainda não tem conta? <Link href="/cadastro" style={{color:"var(--green)",fontWeight:700}}>Criar meu Tá Marcado</Link></p></form></main>;
}
