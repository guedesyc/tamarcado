export const PASSWORD_HINT = "Use 10 ou mais caracteres, com letra maiúscula, minúscula, número e caractere especial.";

export function hasStrongPassword(value: string) {
  return value.length >= 10
    && value.length <= 128
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}
