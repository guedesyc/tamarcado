"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Scissors } from "lucide-react";

type Photo = { path: string; alt: string };

export function ServicePhotoCarousel({ images, baseUrl }: { images: Photo[]; baseUrl: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % images.length), 3000);
    return () => window.clearInterval(timer);
  }, [images.length]);

  if (!images.length) return <span className="service-thumb"><Scissors size={23}/></span>;
  const currentIndex = index % images.length;
  const photo = images[currentIndex];
  return <span className="service-thumb service-photo-carousel">
    <img src={`${baseUrl}/${photo.path}`} alt={photo.alt || "Exemplo do serviço"} loading="lazy"/>
    {images.length > 1 && <>
      <button type="button" className="service-photo-nav previous" aria-label="Foto anterior" onClick={() => setIndex((currentIndex - 1 + images.length) % images.length)}><ChevronLeft size={15}/></button>
      <button type="button" className="service-photo-nav next" aria-label="Próxima foto" onClick={() => setIndex((currentIndex + 1) % images.length)}><ChevronRight size={15}/></button>
    </>}
  </span>;
}
