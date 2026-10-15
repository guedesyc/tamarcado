"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordField({ id, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return <div className="password-input-wrap">
    <input {...props} id={id} type={visible ? "text" : "password"} />
    <button
      type="button"
      className="password-visibility-button"
      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      aria-pressed={visible}
      aria-controls={id}
      onClick={() => setVisible(value => !value)}
    >{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
  </div>;
}
