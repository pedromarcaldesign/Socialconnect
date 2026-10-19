# Social Purepixel

Gestor de redes sociais da Purepixel. Cada **marca** (ex.: Hotel 1) tem as suas contas de Instagram e
Facebook, a sua biblioteca de fotos e o seu calendário. Uma publicação escreve-se uma vez, ajusta-se por
rede e publica-se já ou agenda-se para todas as redes da marca. A IA (Claude) descreve as fotos, escreve
legendas na voz de cada marca, reescreve e traduz.

Substitui a SocialConnect (Express + SQLite), que fica no histórico do git. Planeamento em `replica/`.

## O que faz

- Marcas com perfil, fuso horário e voz (tom, público, palavras-chave, regras, posts de exemplo); o
  perfil pode ser preenchido pela IA a partir do site da marca.
- Ligação à Meta através de uma app própria e de um System User: a app lê todas as Páginas e contas de
  Instagram do Business Manager e cada uma é atribuída a uma marca.
- Biblioteca de fotos por marca: upload direto para o storage, miniaturas, descrição e etiquetas pela IA.
- Compositor: várias contas de uma vez, texto por rede, primeiro comentário, feed/carrossel/story no
  Instagram, recortes 4:5, 1:1 e 1.91:1, validação dos limites de cada rede, pré-visualização.
- Publicar já, agendar (hora local da marca) ou guardar rascunho. Repetições automáticas, publicação
  parcial quando uma rede falha, botão para tentar outra vez, contas marcadas "a religar" quando a Meta
  recusa o token.
- Planner com vista de mês (arrastar para reagendar), lista e rascunhos. Duplicar para outra marca.
- Equipa por convite (dono, administradores, membros).

Ainda não: vídeo/Reels, Google Business Profile, LinkedIn, TikTok, aprovação por clientes, análise de
resultados. A ordem está em `replica/architecture.md`.

## Tecnologia

Next.js 16 (App Router) + TypeScript, Tailwind 4 com os tokens de `replica/design/tokens.json`,
Postgres (Supabase) com Drizzle, Supabase Auth e Storage, Inngest para os agendamentos, Graph API oficial
da Meta, Claude (`claude-opus-5-5`, com fallback do servidor em caso de recusa). Alojamento no Netlify.

## Configuração (uma vez)

### 1. Supabase

1. Cria um projeto em supabase.com, na região **Europa** (ex.: Frankfurt). Guarda a password da base de dados.
2. **Connect** (botão no topo do projeto):
   - *Transaction pooler* (porta 6543) → `DATABASE_URL` (usada pela app);
   - *Session pooler* (porta 5432) → `MIGRATION_DATABASE_URL` (usada pelas migrações).
   Substitui `[YOUR-PASSWORD]` pela password do passo 1.
3. **Project Settings > API Keys**: a chave *publishable* (ou a *anon*, nas chaves antigas) →
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`; a chave *secret* (ou *service_role*) → `SUPABASE_SERVICE_ROLE_KEY`;
   o *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`. A chave secreta nunca vai para o browser.
4. **Authentication > URL Configuration**: *Site URL* = `APP_URL`; em *Redirect URLs* junta
   `APP_URL/auth/callback` (e `http://localhost:3000/auth/callback` para desenvolvimento).
5. **Authentication > Emails > SMTP Settings**: liga um SMTP próprio (Resend, Brevo, o email da Purepixel).
   O SMTP de origem do Supabase só envia para membros da equipa do projeto e tem um limite muito baixo
   por hora, por isso os links de login não chegam aos outros colegas sem isto.
6. (Opcional) **Authentication > Sign In / Providers > Google**: liga com um OAuth client da Purepixel
   na Google Cloud; o *callback URL* que o Supabase mostra vai para esse OAuth client.
7. **Storage > New bucket**: nome `media`, **privado** (Public desligado), limite de 25 MB,
   tipos permitidos `image/jpeg, image/png, image/webp`.
8. As tabelas são criadas pelas migrações (`npm run db:migrate`, que o Netlify corre em cada deploy).
   O painel do Supabase avisa "RLS enabled, no policies": é intencional, a app acede só pelo servidor.

No plano gratuito o Supabase pausa projetos sem atividade durante uma semana; com o Inngest a correr a
varredura a cada 5 minutos isso não acontece, mas para produção o plano Pro dá backups diários.

### 2. Meta

1. Em developers.facebook.com cria uma app do tipo **Business**, ligada ao Business Manager da Purepixel.
2. Junta os produtos **Facebook Login for Business** e **Instagram Graph API**.
3. Permissões (acesso *Standard*, sem App Review): `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`,
   `business_management`.
4. Preenche política de privacidade, URL de eliminação de dados e ícone, e **muda a app para Live**.
   Em modo Development os posts só são visíveis para quem tem papel na app.
5. Business Manager > Utilizadores > **Utilizadores do sistema**: cria um admin, atribui-lhe as Páginas
   (e as contas de Instagram) dos hotéis com controlo total, e gera um token para a app com as
   permissões acima. Esse token não expira: é o `META_SYSTEM_USER_TOKEN`.
6. `META_APP_SECRET` = segredo da app (Definições > Básicas).

As contas de Instagram têm de ser profissionais (Business ou Creator) e estar ligadas a uma Página.
Páginas de clientes que não sejam da Purepixel têm de ser partilhadas com o Business Manager como parceiro.

Na app: **Ligações > Sincronizar com a Meta**, depois atribui cada conta a uma marca.

### 3. Inngest (agendamento)

1. Cria uma conta em inngest.com e copia `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY`.
2. Depois do primeiro deploy, em Inngest > Apps > Sync, regista `APP_URL/api/inngest`.

Inclui: publicação à hora marcada, repetições, verificação diária dos tokens às 07:00 e uma varredura a
cada 5 minutos que apanha posts atrasados. Sem Inngest, um cron externo pode chamar
`POST /api/cron/due` com `authorization: Bearer $CRON_SECRET`.

### 4. Netlify

1. Novo site a partir deste repositório. O `netlify.toml` corre as migrações e a build.
2. Variáveis de ambiente: as de `.env.example` (sem as de desenvolvimento).
3. Domínio próprio e `APP_URL` igual a ele.

### 5. IA

`ANTHROPIC_API_KEY` da consola da Anthropic. O modelo por omissão é `claude-opus-5-5`; muda com
`AI_MODEL` se quiseres outro custo/qualidade. Os pedidos ficam registados na tabela `ai_generations`
(tokens por marca e por utilizador).

## Desenvolvimento

```bash
npm install
cp .env.example .env.local     # preenche DATABASE_URL, APP_SECRET, DEV_AUTH_EMAIL, STORAGE_DRIVER=local
npm run db:migrate
npm run dev
```

Com `DEV_AUTH_EMAIL` entra-se sem Supabase. Com `STORAGE_DRIVER=local` os ficheiros ficam em `.data/`.
Sem `INNGEST_EVENT_KEY` os agendamentos correm dentro do processo do `next dev`.

## Testes

```bash
npm test                        # unitários (fusos horários, regras das redes)
npm run typecheck
```

E2E (Playwright) com a Meta e o Claude simulados, sem custos:

```bash
node tests/e2e/mock-graph.mjs &        # Graph API simulada em :4010
node tests/e2e/mock-anthropic.mjs &    # API do Claude simulada em :4020
# .env.local com: DEV_AUTH_EMAIL, STORAGE_DRIVER=local, META_GRAPH_BASE=http://localhost:4010,
#   META_SYSTEM_USER_TOKEN=test, ANTHROPIC_API_KEY=test, AI_BASE_URL=http://localhost:4020, CRON_SECRET=test-cron-secret
npm run dev &
DATABASE_URL=... npx playwright test   # apaga os dados da base indicada antes de correr
```

Cobre: criar marca, sincronizar e atribuir contas, upload, publicar já em IG + FB, carrossel agendado
com primeiro comentário, falha parcial com conta a religar, publicação à hora marcada sem duplicados,
análise de fotos, legendas e reescrita com IA, e a proteção do "ler site" contra endereços internos.
