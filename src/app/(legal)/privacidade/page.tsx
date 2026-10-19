import Link from "next/link";
import { env } from "@/lib/env";
import { LegalContact, LAST_UPDATED } from "@/components/legal-contact";

export const metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  const entity = env.legalEntity();
  return (
    <>
      <h1>Política de privacidade</h1>
      <p className="text-text-muted">Última atualização: {LAST_UPDATED}</p>

      <p>
        A Social Purepixel é uma ferramenta interna da {entity} para planear, criar e publicar conteúdo nas redes
        sociais das marcas que gere (por exemplo, hotéis). Esta política explica que dados a ferramenta trata, porquê,
        com quem os partilha e como podes exercer os teus direitos.
      </p>

      <h2>Quem é o responsável</h2>
      <p>
        O responsável pelo tratamento é a {entity}. Para qualquer questão sobre privacidade, contacta <LegalContact />.
      </p>

      <h2>Que dados tratamos</h2>
      <ul>
        <li><strong>Equipa:</strong> email, nome e fotografia de perfil de quem entra na ferramenta, e o registo das ações feitas (publicações criadas, agendadas e publicadas).</li>
        <li><strong>Contas da Meta:</strong> identificadores, nomes e fotografias de perfil das Páginas de Facebook e contas profissionais de Instagram das marcas, e os tokens de acesso dessas contas, guardados cifrados.</li>
        <li><strong>Conteúdo:</strong> fotografias carregadas para a biblioteca de cada marca, textos das publicações e os identificadores e links das publicações feitas no Facebook e no Instagram.</li>
        <li><strong>Utilização da IA:</strong> número de pedidos e de tokens usados por marca e por utilizador.</li>
      </ul>
      <p>
        A ferramenta não recolhe dados dos seguidores das marcas, não lê mensagens privadas e não usa os dados da Meta
        para publicidade nem para criar perfis de pessoas.
      </p>

      <h2>Para que usamos os dados</h2>
      <ul>
        <li>Publicar e agendar conteúdo nas Páginas de Facebook e contas de Instagram das marcas, a pedido da equipa.</li>
        <li>Mostrar o estado de cada publicação e avisar quando uma conta precisa de ser religada.</li>
        <li>Descrever fotografias e sugerir legendas com inteligência artificial, sempre revistas por uma pessoa antes de publicar.</li>
        <li>Controlar o acesso à ferramenta e manter a segurança.</li>
      </ul>
      <p>
        A base legal é a execução dos serviços contratados pelas marcas à {entity} e o interesse legítimo da {entity}{" "}
        em gerir esses serviços de forma segura.
      </p>

      <h2>Com quem partilhamos</h2>
      <p>Usamos estes fornecedores, que tratam os dados só por nossa conta:</p>
      <ul>
        <li><strong>Meta Platforms</strong> (Facebook e Instagram): para publicar o conteúdo, através da API oficial.</li>
        <li><strong>Supabase</strong>: base de dados, autenticação e armazenamento das fotografias, alojados na União Europeia.</li>
        <li><strong>Netlify</strong>: alojamento da aplicação.</li>
        <li><strong>Inngest</strong>: execução das publicações agendadas.</li>
        <li><strong>Anthropic</strong>: modelo de IA (Claude) que recebe as fotografias e textos necessários para gerar descrições e legendas.</li>
        <li>O fornecedor de email usado para enviar os links de acesso.</li>
      </ul>
      <p>
        Alguns destes fornecedores podem tratar dados fora do Espaço Económico Europeu. Nesses casos, as transferências
        são feitas com as garantias previstas no RGPD, como as cláusulas contratuais-tipo da Comissão Europeia.
        Não vendemos dados a ninguém.
      </p>

      <h2>Durante quanto tempo</h2>
      <ul>
        <li>Os tokens de acesso da Meta são apagados quando uma conta é removida, ou quando a ligação à Meta é retirada.</li>
        <li>Fotografias apagadas da biblioteca são removidas definitivamente até 30 dias depois.</li>
        <li>Os dados de uma pessoa da equipa são apagados quando deixa de ter acesso, exceto o que for preciso manter por obrigação legal.</li>
      </ul>

      <h2>Segurança</h2>
      <p>
        O acesso é só por convite. Os tokens da Meta são cifrados e nunca são enviados para o browser. As fotografias
        ficam num armazenamento privado e só são acessíveis através de links temporários.
      </p>

      <h2>Os teus direitos</h2>
      <p>
        Podes pedir o acesso, a retificação, a eliminação, a limitação ou a portabilidade dos teus dados, e opor-te ao
        seu tratamento, contactando <LegalContact />. Respondemos no prazo de 30 dias. Podes também apresentar queixa à
        Comissão Nacional de Proteção de Dados (<a href="https://www.cnpd.pt" target="_blank" rel="noreferrer">cnpd.pt</a>).
      </p>
      <p>
        Para pedir a eliminação dos dados obtidos através do Facebook ou do Instagram, segue as instruções em{" "}
        <Link href="/eliminacao-de-dados">Eliminação de dados</Link>.
      </p>

      <h2>Alterações</h2>
      <p>Se esta política mudar, a data no topo é atualizada.</p>
    </>
  );
}
