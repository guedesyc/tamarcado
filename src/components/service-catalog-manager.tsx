"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Clock3, Scissors } from "lucide-react";
import { ServiceCapacityEditor } from "@/components/service-capacity-editor";
import { ServiceActions } from "@/components/service-actions";

type Service = { id: string; name: string; description: string | null; base_price_cents: number | null; base_duration_minutes: number | null; buffer_minutes: number; booking_mode: string; active: boolean; simultaneous_capacity: number; photos: { id: string; storage_path: string; alt_text: string }[] };
const duration = (minutes: number | null) => minutes == null ? "A combinar" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function ServiceCatalogManager({ services, storageBaseUrl }: { services: Service[]; storageBaseUrl: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!services.length) return <section className="panel service-empty"><Scissors size={25}/><h2>Seu primeiro serviço</h2><p>Adicione um serviço para que as clientes saibam como marcar com você.</p></section>;
  return <div className="service-catalog-list">{services.map(service => {
    const isOpen = expanded === service.id;
    const photo = service.photos[0];
    const imageUrl = photo ? `${storageBaseUrl}/storage/v1/object/public/portfolio/${photo.storage_path}` : "";
    return <article className={`service-catalog-card${isOpen ? " is-open" : ""}`} key={service.id}>
      <button type="button" className="service-catalog-summary" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : service.id)}>
        <span className="service-catalog-thumb">{imageUrl ? <Image src={imageUrl} alt={photo.alt_text || service.name} width={88} height={88} unoptimized/> : <Scissors size={22}/>}</span>
        <span className="service-catalog-title"><b>{service.name}</b></span>
        {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
      </button>
      {isOpen && <div className="service-catalog-details">
        <div className="service-detail-top"><span className={`status${service.active ? " service-active" : " service-inactive"}`}>{service.active ? "Ativo" : "Inativo"}</span><b>{service.base_price_cents == null ? "A combinar" : `R$ ${(service.base_price_cents / 100).toFixed(2).replace(".", ",")}`}</b></div>
        {!!service.photos.length && <div className="service-catalog-gallery">{service.photos.map(item => <figure key={item.id}><Image src={`${storageBaseUrl}/storage/v1/object/public/portfolio/${item.storage_path}`} alt={item.alt_text || service.name} width={240} height={240} unoptimized/><figcaption>{item.alt_text || service.name}</figcaption></figure>)}</div>}
        <p>{service.description?.trim() || "Sem descrição cadastrada."}</p>
        <div className="service-detail-facts"><span><Clock3 size={14}/> Duração: {duration(service.base_duration_minutes)}{service.buffer_minutes ? ` + intervalo ${duration(service.buffer_minutes)}` : ""}</span><span>Modo: {service.booking_mode === "instant" ? "Confirmação automática" : service.booking_mode === "evaluation" ? "Avaliação" : "Aprovação manual"}</span></div>
        <ServiceCapacityEditor serviceId={service.id} initialCapacity={service.simultaneous_capacity ?? 1}/>
        <ServiceActions serviceId={service.id} active={service.active}/>
      </div>}
    </article>;
  })}</div>;
}
