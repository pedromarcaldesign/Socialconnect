import Link from "next/link";
import { env } from "@/lib/env";
import { LegalContact, LAST_UPDATED } from "@/components/legal-contact";

export const metadata = { title: "Eliminação de dados" };

export default function DataDeletionPage() {
  const entity = env.legalEntity();
  return (
    <>
      <h1>Eliminação de dados</h1>
      <p className="text-text-muted">Última atualização: {LAST_UPDATED}</p>

      <p>
        A Social Purepixel guarda dados das Páginas de Facebook e contas de Instagram ligadas à app da {entity}: os
        identificadores, nomes e fotografias de perfil das contas, os tokens de acesso (cifrados) e os identificadores
        das publicações feitas. Mais detalhes na <Link href="/privacidade">política de privacidade</Link>.
      </p>

      <h2>Como pedir a eliminação</h2>
      <ol>
        <li>
          <strong>Retirar o acesso da app.</strong> No Facebook, abre <em>Definições e privacidade → Definições →
          Integrações empresariais</em> (ou, no Business Manager, retira a Página ou a conta de Instagram do utilizador
          do sistema da {entity}) e remove a app Social Purepixel. A partir desse momento, a app deixa de conseguir
          publicar ou ler dados dessa conta.
        </li>
        <li>
          <strong>Pedir a eliminação do que ficou guardado.</strong> Envia um email para <LegalContact /> com o assunto
          &quot;Eliminação de dados&quot;, indicando o nome da Página ou da conta de Instagram.
        </li>
      </ol>

      <h2>O que acontece depois</h2>
      <ul>
        <li>Confirmamos a receção do pedido em até 5 dias úteis.</li>
        <li>
          Em até 30 dias apagamos os tokens de acesso e os dados da conta (identificador, nome, fotografia de perfil),
          os identificadores e links das publicações feitas através da app e, se pedires, as fotografias dessa marca na
          biblioteca.
        </li>
        <li>As publicações que já estão no Facebook ou no Instagram não são apagadas por nós: continuam a ser geridas na própria rede.</li>
        <li>Quando terminarmos, enviamos uma confirmação por email.</li>
      </ul>
    </>
  );
}
