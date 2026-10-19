import { env } from "@/lib/env";

/** Email de contacto para pedidos de privacidade (PRIVACY_CONTACT_EMAIL). */
export function LegalContact() {
  const email = env.privacyEmail();
  return email
    ? <a href={`mailto:${email}`}>{email}</a>
    : <span>o email de contacto da {env.legalEntity()}</span>;
}

export const LAST_UPDATED = "19 de outubro de 2026";
