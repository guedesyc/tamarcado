import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarCheck2, Check, CheckCheck, ChevronDown, Instagram, MapPin, MessageCircle, Scissors, ShieldCheck, Sparkles, Star, Users, WalletCards } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { BookingPreview, MarketingHeader, ScrollReveal, SpecialtyRail, StorySection } from "@/components/marketing-home";
import "./marketing.css";

export const metadata: Metadata = {
  title: "Tá Marcado — sua agenda, do seu jeito",
  description: "Uma página profissional para mostrar seu trabalho, receber pedidos e organizar sua agenda. Experimente seus primeiros 5 atendimentos sem pagar.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tá Marcado — sua agenda, do seu jeito",
    description: "Mostre seu trabalho, receba pedidos de horário e organize sua rotina em um só lugar.",
    url: "/",
    type: "website",
  },
};

const faqs = [
  ["Preciso de cartão para começar?", "Não. Você começa sem cadastrar cartão e pode experimentar seus primeiros 5 atendimentos públicos."],
  ["Quanto custa depois?", "Um único plano de R$ 49,99 por mês, sem comissão sobre os seus atendimentos."],
  ["Minha cliente precisa criar conta?", "Não. Ela solicita e acompanha o atendimento por um link seguro."],
  ["Posso cadastrar diferentes tipos de serviço?", "Sim. Você define os serviços, preços, durações e as perguntas que fazem sentido para cada atendimento."],
  ["O que acontece depois dos 5 atendimentos?", "Seus dados e sua agenda continuam acessíveis. Novos agendamentos pela página pausam até ativar a assinatura."],
  ["Posso cancelar quando quiser?", "Sim. A assinatura é mensal e pode ser cancelada quando você decidir."],
];

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <span className="mh-kicker"><span aria-hidden="true" />{children}</span>;
}

function FloralArtwork({ variant = "rose" }: { variant?: "rose" | "nail" | "braid" | "lash" | "skin" }) {
  return <div className={`mh-artwork mh-artwork-${variant}`} aria-hidden="true">
    <div className="mh-artwork-orbit" />
    <div className="mh-artwork-shape"><span /><span /><span /><span /><i /></div>
    <div className="mh-artwork-caption">{variant === "nail" ? "cor & cuidado" : variant === "braid" ? "feito à mão" : variant === "lash" ? "olhar leve" : variant === "skin" ? "seu momento" : "beleza com intenção"}</div>
  </div>;
}

const testimonials = [
  { quote: "Agora minhas clientes escolhem o horário com calma. E eu paro de responder mensagem no meio do atendimento.", initial: "A", name: "Ana Martins", role: "Trancista · Salvador, BA" },
  { quote: "Ficou muito mais fácil apresentar meus serviços e explicar o que cada atendimento inclui.", initial: "L", name: "Larissa Rocha", role: "Nail designer · Campinas, SP" },
  { quote: "Consigo ver meus pedidos e organizar os horários sem me perder nas conversas.", initial: "B", name: "Bruna Lima", role: "Lash designer · Recife, PE" },
  { quote: "Minhas clientes encontram as informações e pedem um horário no tempo delas.", initial: "C", name: "Camila Alves", role: "Maquiadora · Rio de Janeiro, RJ" },
  { quote: "Ter os detalhes do serviço junto com a solicitação deixa tudo mais tranquilo.", initial: "J", name: "Jéssica Santos", role: "Trancista · Belo Horizonte, MG" },
  { quote: "Minha rotina ficou mais clara. Abro a agenda e sei o que tenho para fazer.", initial: "P", name: "Paula Nunes", role: "Designer de sobrancelhas · Goiânia, GO" },
];

function QuoteCard({ quote, initial, name, role, duplicate = false }: typeof testimonials[number] & { duplicate?: boolean }) {
  return <article className="mh-quote-card" aria-hidden={duplicate || undefined}><div className="mh-quote-stars" aria-label="5 de 5 estrelas"><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/></div><blockquote>“{quote}”</blockquote><div className="mh-person"><span className="mh-person-avatar">{initial}</span><span><b>{name}</b><small>{role}</small></span><CheckCheck size={17}/></div></article>;
}

function QuoteRail() {
  return <section className="mh-testimonials" data-scroll-reveal aria-label="Comentários de profissionais"><div className="mh-testimonial-rail" tabIndex={0} aria-label="Comentários em movimento horizontal"><div className="mh-testimonial-track"><div className="mh-testimonial-group">{testimonials.map(testimonial => <QuoteCard key={testimonial.name} {...testimonial}/>)}</div><div className="mh-testimonial-group" aria-hidden="true">{testimonials.map(testimonial => <QuoteCard key={testimonial.name} {...testimonial} duplicate/>)}</div></div></div></section>;
}

export default function Home() {
  return <ScrollReveal><div className="marketing-home">
    <MarketingHeader />
    <main>
      <section className="mh-hero" data-scroll-reveal>
        <div className="mh-wrap mh-hero-grid">
          <div className="mh-hero-copy">
            <SectionKicker>Seu talento merece um espaço só seu</SectionKicker>
            <h1>Sua agenda, seu trabalho, <em>do seu jeito.</em></h1>
            <p>Uma página profissional para mostrar o que você faz, receber pedidos de horário e cuidar da sua rotina com mais tranquilidade.</p>
            <div className="mh-actions"><Link className="mh-button mh-button-dark" href="/cadastro">Começar grátis <ArrowRight size={17}/></Link><a className="mh-button mh-button-quiet" href="#conheca"><ArrowDown size={16}/> Conheça o Tá Marcado</a></div>
            <div className="mh-trust"><span><Check size={14}/> 5 atendimentos grátis</span><i/><span>Sem cartão</span><i/><span>Sem comissão</span></div>
          </div>
          <div className="mh-hero-visual" data-scroll-reveal><BrandLogo className="mh-hero-logo"/></div>
        </div>
        <a className="mh-scroll-hint" href="#conheca"><span>Role para conhecer</span><ArrowDown size={15}/></a>
      </section>

      <section className="mh-specialties" data-scroll-reveal id="especialidades"><div className="mh-wrap"><div className="mh-specialty-head"><div><SectionKicker>Seu talento tem muitas formas</SectionKicker><h2>Um espaço para quem <em>cuida.</em></h2></div></div><SpecialtyRail/></div></section>

      <StorySection />



      <section className="mh-booking" data-scroll-reveal id="demonstracao"><div className="mh-wrap mh-booking-grid"><div className="mh-booking-copy"><SectionKicker>Experimente por aqui</SectionKicker><h2>Marcar um horário pode ser <em>tão simples.</em></h2><p>Escolha um serviço, um dia e um horário. Essa demonstração é só uma prévia — seus dados não são enviados nem salvos.</p><ul><li><Check size={16}/> Sem criar conta</li><li><Check size={16}/> Sem enviar uma solicitação real</li><li><Check size={16}/> Você escolhe o dia e o horário</li></ul><span className="mh-local-note"><ShieldCheck size={15}/> Demonstração local e segura</span></div><BookingPreview/></div></section>

      <section className="mh-control" data-scroll-reveal><div className="mh-wrap mh-control-grid"><div className="mh-control-copy"><SectionKicker>Seu espaço de trabalho</SectionKicker><h2>A profissional por trás do <em>talento.</em></h2><p>Por trás de cada horário, há uma profissional organizando o próprio negócio. O painel reúne o que você precisa para conduzir o dia com confiança.</p><div className="mh-control-items"><span><CalendarCheck2/>Agenda mensal e horários</span><span><Users/>Clientes e histórico</span><span><WalletCards/>Solicitações e valores</span></div><Link href="/demo" className="mh-text-link">Conheça a demonstração completa <ArrowRight size={15}/></Link></div><div className="mh-dashboard"><div className="mh-dash-top"><span className="mh-dash-brand"><BrandLogo/></span><span className="mh-dash-greeting">Bom dia, Ana <Sparkles size={14}/></span><span className="mh-dash-avatar">A</span></div><div className="mh-dash-body"><div className="mh-dash-title"><span><small>QUINTA-FEIRA, 8 DE OUTUBRO</small><b>Seu dia, no seu ritmo.</b></span><span className="mh-dash-button">Ver agenda <ArrowRight size={13}/></span></div><div className="mh-dash-stats"><div><small>Hoje</small><b>3 <i>atendimentos</i></b></div><div><small>Solicitações novas</small><b>2 <i>para revisar</i></b></div><div><small>Este mês</small><b>12 <i>clientes</i></b></div></div><div className="mh-dash-calendar"><div className="mh-dash-month"><b>Outubro 2026</b><span>‹ &nbsp; ›</span></div><div className="mh-dash-week">{["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map((day,i)=><span key={day} className={i===3?"active":""}><small>{day}</small><b>{[21,22,23,24,25,26,27][i]}</b><i/></span>)}</div></div><div className="mh-dash-appointment"><span className="mh-dash-time">09:00</span><span className="mh-dash-color"/><span><b>Mariana Costa</b><small>Box braids · 4 horas</small></span><span className="mh-confirmed">Confirmado</span></div><div className="mh-dash-appointment"><span className="mh-dash-time">14:30</span><span className="mh-dash-color pending"/><span><b>Júlia Santos</b><small>Manutenção · 1h 30min</small></span><span className="mh-pending">Pendente</span></div></div><div className="mh-dash-foot"><span><CheckCircleIcon/> Tudo organizado para você</span><span>Seu espaço profissional</span></div></div></div></section>

      <section className="mh-product" data-scroll-reveal><div className="mh-wrap mh-product-grid"><div className="mh-product-copy"><SectionKicker>Organizado, de verdade</SectionKicker><h2>Da primeira mensagem ao atendimento <em>concluído.</em></h2><p>Os pedidos chegam com as informações que você precisa. Você acompanha o que está pendente, o que foi confirmado e quem já atendeu.</p><div className="mh-product-checks"><span><Check size={15}/> Respostas da cliente junto do pedido</span><span><Check size={15}/> Horários organizados na agenda</span><span><Check size={15}/> Histórico para reconhecer suas clientes</span></div></div><div className="mh-request-mock"><div className="mh-request-top"><span>Solicitações</span><span className="mh-request-count">2 novas</span></div><div className="mh-request-tabs"><span className="selected">Em andamento <i>2</i></span><span>Aprovadas</span><span>Canceladas</span></div><div className="mh-request-card"><div className="mh-request-avatar">M</div><div className="mh-request-main"><div><b>Mariana Costa</b><span className="mh-new">Nova</span></div><small>Box braids · 10 out. · 11:00</small><span className="mh-answer"><Check size={12}/> Comprimento: média · Material: profissional</span></div><button aria-label="Abrir detalhes" type="button"><ArrowUpRight size={15}/></button></div><div className="mh-request-card"><div className="mh-request-avatar soft">J</div><div className="mh-request-main"><div><b>Júlia Santos</b><span className="mh-pending">Aguardando</span></div><small>Unha em gel · 26 set. · 14:30</small><span className="mh-answer"><Check size={12}/> Cor: vinho · Alongamento: sim</span></div><button aria-label="Abrir detalhes" type="button"><ArrowUpRight size={15}/></button></div><div className="mh-request-foot"><span><ShieldCheck size={14}/> Você está no controle dos seus horários.</span></div></div></div></section>

      <section className="mh-problem" data-scroll-reveal><div className="mh-wrap mh-problem-grid"><div><SectionKicker>Conhece essa conversa?</SectionKicker><h2>“Que dia mesmo? E quanto ficava?”</h2><p>Entre uma cliente e outra, sua caixa de mensagens vira agenda, catálogo e bloco de notas ao mesmo tempo.</p><div className="mh-problem-list"><span><Check size={15}/> Conversas que se perdem</span><span><Check size={15}/> Horários difíceis de conciliar</span><span><Check size={15}/> As mesmas perguntas, todo dia</span></div></div><div className="mh-chat-wrap"><div className="mh-chat-top"><span className="mh-chat-avatar">M</span><span><b>Mariana</b><small>cliente · hoje</small></span><MessageCircle size={18}/></div><div className="mh-chat-body"><div className="mh-chat-bubble">Oi, você tem horário essa semana? E quanto fica a unha em gel? <small>09:12</small></div><div className="mh-chat-bubble mh-chat-bubble-out">Oi! Deixa eu ver minha agenda e já te mando os valores 😊<small>09:18 <CheckCheck size={12}/></small></div><div className="mh-chat-bubble">Ah, e posso te mandar uma foto de inspiração? <small>09:20</small></div><div className="mh-chat-typing"><i/><i/><i/></div></div><div className="mh-chat-fade"><span>Enquanto isso, outra cliente chama…</span><div><MessageCircle size={15}/> +4 mensagens</div></div><div className="mh-chat-solution"><span><CalendarCheck2 size={17}/></span><b>Com Tá Marcado, cada coisa encontra seu lugar.</b><ArrowRight size={15}/></div></div></div></section>

      <section className="mh-transformation" data-scroll-reveal><div className="mh-wrap"><div className="mh-trans-head"><SectionKicker>Da correria à clareza</SectionKicker><h2>Uma rotina com mais <em>respiro.</em></h2></div><div className="mh-transform-grid"><article className="mh-transform-before"><span className="mh-transform-label">ANTES <span>tudo misturado</span></span><div className="mh-scribble">WhatsApp <i>preços</i> horários? <b>fotos</b> remarcação <i>clientes</i> <span>áudios</span> pagamento</div><p>Você cuida de tudo, mas precisa lembrar de tudo também.</p></article><div className="mh-transform-arrow"><ArrowRight size={25}/></div><article className="mh-transform-after"><span className="mh-transform-label">DEPOIS <span>cada coisa no seu lugar</span></span><div className="mh-organized-list"><div><span><CalendarCheck2 size={17}/></span><b>Agenda</b><small>os horários do dia</small><Check size={16}/></div><div><span><Users size={17}/></span><b>Clientes</b><small>seus atendimentos</small><Check size={16}/></div><div><span><WalletCards size={17}/></span><b>Serviços</b><small>preços e detalhes</small><Check size={16}/></div></div><p>Mais clareza para você. Uma experiência fácil para sua cliente.</p></article></div></div></section>

      <section className="mh-link-section" data-scroll-reveal><div className="mh-wrap mh-link-grid"><div className="mh-link-visual"><div className="mh-share-card"><Image src="/tamarcado-share-preview.png" alt="Prévia da página de serviços Tá Marcado" fill sizes="(max-width: 760px) 88vw, 390px" className="mh-share-screen"/></div><div className="mh-share-tag"><span><Scissors size={15}/></span>Seu link para compartilhar<small>tamarcado.com.br/ana-trancas</small></div></div><div className="mh-link-copy"><SectionKicker>Seu trabalho, bem apresentado</SectionKicker><h2>Uma página bonita e simples de <em>compartilhar.</em></h2><p>Coloque seu link na bio, envie no WhatsApp ou imprima um QR Code. Sua cliente conhece seu trabalho e encontra o caminho para pedir um horário.</p><div className="mh-link-points"><span><CheckCheck size={17}/> Serviços com valores e detalhes</span><span><CheckCheck size={17}/> Fotos para mostrar seu trabalho</span><span><CheckCheck size={17}/> Um link para usar em todo lugar</span></div><Link href="/cadastro" className="mh-text-link">Quero criar minha página <ArrowRight size={15}/></Link></div></div></section>











      <section className="mh-offer" data-scroll-reveal id="preco"><div className="mh-wrap mh-offer-grid"><div className="mh-offer-art"><div className="mh-offer-circle"><span>5</span><small>atendimentos<br/>para começar</small></div><div className="mh-offer-spark"><Sparkles size={22}/></div><span className="mh-offer-caption">Seu próximo capítulo começa aqui.</span></div><div className="mh-offer-copy"><SectionKicker>Comece com calma</SectionKicker><h2>Primeiros 5 atendimentos, <em>por nossa conta.</em></h2><p>Experimente sua página e conheça a rotina com tudo mais organizado. Sem cartão para começar e sem comissão pelos seus atendimentos.</p><div className="mh-offer-includes"><span><Check size={16}/> Página profissional</span><span><Check size={16}/> Agenda e solicitações</span><span><Check size={16}/> Cadastro de clientes e serviços</span></div><Link className="mh-button mh-button-dark" href="/cadastro">Criar meu espaço grátis <ArrowRight size={17}/></Link><small className="mh-price-note">Depois, se fizer sentido para você, R$ 49,99 por mês.</small></div></div></section>

      <section className="mh-price" data-scroll-reveal><div className="mh-wrap mh-price-inner"><div><SectionKicker>Quando estiver pronta</SectionKicker><h2>Um plano. <em>Sem surpresas.</em></h2><p>O mesmo preço, sem comissão sobre cada atendimento.</p></div><div className="mh-price-card"><span>Plano profissional</span><div>R$ <b>49</b><sup>,99</sup><small>/ mês</small></div><span><Check size={14}/> Sem comissão · cancele quando quiser</span><Link href="/cadastro">Começar grátis <ArrowRight size={15}/></Link></div></div></section>

      <section className="mh-market" data-scroll-reveal><div className="mh-market-copy"><span className="mh-market-label"><Sparkles size={13}/> UM PRÓXIMO PASSO</span><h2>Mais perto de quem procura.<br/><em>Um dia, quem sabe.</em></h2><p>Estamos imaginando novas formas de aproximar clientes e profissionais da beleza. Por enquanto, seu link é a melhor maneira de ser encontrada.</p><span className="mh-market-note">Uma ideia para o futuro · sem data anunciada</span></div><div className="mh-market-art" aria-hidden="true"><div className="mh-market-ring ring-one"/><div className="mh-market-ring ring-two"/><div className="mh-map-dots">{Array.from({length:28},(_,i)=><i key={i}/>)}</div><span className="mh-map-pin pin-one"><MapPin size={19}/></span><span className="mh-map-pin pin-two"><MapPin size={18}/></span><span className="mh-map-pin pin-three"><MapPin size={17}/></span><span className="mh-market-heart">♡</span></div></section>

      <section className="mh-faq" data-scroll-reveal id="duvidas"><div className="mh-wrap mh-faq-grid"><div><SectionKicker>Quer saber mais?</SectionKicker><h2>Dúvidas que podem <em>aparecer.</em></h2><p>Se ficou alguma pergunta, talvez encontre a resposta por aqui.</p><Link href="/ajuda" className="mh-text-link">Acessar a central de ajuda <ArrowRight size={15}/></Link></div><div className="mh-faq-list">{faqs.map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={17}/></summary><p>{answer}</p></details>)}</div></div></section>

      <QuoteRail />

      <section className="mh-final" data-scroll-reveal><div className="mh-final-flower"><FloralArtwork variant="rose"/></div><a className="mh-final-social" href="https://instagram.com/tamarcado_app" aria-label="Instagram Tá Marcado"><Instagram size={21}/></a><div className="mh-final-content"><SectionKicker>Seu próximo passo</SectionKicker><h2>Seu trabalho merece um espaço <em>só seu.</em></h2><p>Comece sem pressa. Organize a agenda no seu ritmo.</p><Link className="mh-button mh-button-light" href="/cadastro">Criar meu Tá Marcado <ArrowRight size={17}/></Link><span>5 atendimentos grátis · Sem cartão</span></div><div className="mh-final-mark" aria-hidden="true">tm</div></section>
    </main>

  </div></ScrollReveal>;
}

function CheckCircleIcon(){return <span className="mh-check-circle"><Check size={11}/></span>}
