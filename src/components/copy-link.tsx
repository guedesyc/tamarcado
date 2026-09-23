"use client";

import { useState } from "react";

export function CopyLink({value}:{value:string}){
 const [copied,setCopied]=useState(false);
 return <button type="button" className="pill" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setCopied(false)}}}>{copied?"Copiado!":"Copiar link"}</button>;
}
