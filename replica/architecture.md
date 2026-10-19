# Architecture: Social Purepixel (reconstrução das funcionalidades principais do Metricool)

Corte 1: ferramenta interna da Purepixel, só **Instagram + Facebook** através de uma app Meta
própria. A app usa acesso Standard, está em modo Live e publica com um token de System User do
Business Manager. Inclui marcas, biblioteca de media por marca, compositor multi-rede,
agendar/publicar, calendário e IA de texto e de imagem.
Fontes: `replica/recon.md`, `replica/features.csv`. SQL: `replica/schema.sql`, testado em
Postgres 16: aplica sem erros e o RLS isola workspaces.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | server actions para escritas validadas, um só projeto para UI e API |
| styling | Tailwind + tokens do `/replica-design` | |
| database | Postgres no Supabase | RLS, Auth e Storage no mesmo sítio, grátis para começar |
| ORM | Drizzle | SQL explícito, migrações em ficheiros, tipos gerados |
| auth | Supabase Auth (Google + magic link), **só por convite** | ferramenta interna: ninguém de fora cria conta |
| payments | nenhum no corte 1 | uso interno; o Stripe entra se um dia for vendida |
| email | Resend | avisos de falha, convites |
| jobs | Inngest | `sleepUntil` à hora exata, retries por passo, idempotência por evento, funciona em qualquer host |
| files | Supabase Storage (bucket privado `media`) + `sharp` para converter imagens | a Meta lê a media por URL: usamos signed URLs de curta duração |
| AI texto | Claude (API Anthropic), Sonnet para gerar e Haiku para ações rápidas (encurtar, traduzir) | bom em PT-PT e a seguir a voz da marca |
| AI imagem | interface `ImageProvider`, por defeito um modelo da OpenAI ou da Google que aceite imagem de referência (escolher no build) | o Claude não gera imagens; editar a partir de fotos reais do hotel vale mais do que gerar do zero |
| hosting | Netlify (já ligado a esta conta) | Next.js suportado; o Inngest chama `/api/inngest` em passos curtos, por isso os limites de tempo das funções não incomodam |
| redes | Meta Graph API (versão fixada em env, ex.: `META_GRAPH_VERSION`) | só APIs oficiais, com as chaves da Purepixel |

Uma base de dados, um projeto Next.js, sem microserviços.

### Setup Meta (feito uma vez, fora do código)

1. Criar uma app do tipo **Business** em developers.facebook.com, ligada ao Business Manager da Purepixel.
2. Produtos: Facebook Login for Business + Instagram Graph API (Instagram API com login do Facebook).
3. Permissões (acesso Standard): `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`, `business_management`. Adicionar
   `instagram_manage_comments` para o primeiro comentário.
4. Política de privacidade, URL de eliminação de dados e ícone. Depois **mudar para Live**: em
   Development os posts só são visíveis para quem tem papel na app.
5. Business Manager → System Users → criar um de nível admin → atribuir-lhe as Páginas (e as contas
   IG) dos hotéis → gerar token para a app com as permissões acima. Esse token não expira.
6. Guardar em env: `META_APP_ID`, `META_APP_SECRET`, `META_SYSTEM_USER_TOKEN`, `META_BUSINESS_ID`.

As contas IG têm de ser Business ou Creator e estar ligadas a uma Página. Uma Página de um cliente
que não pertença ao Business Manager da Purepixel tem de ser partilhada com ele como parceiro.

## Schema

Tables: 16. Access rules: **Postgres RLS**. O browser lê com a sessão do utilizador. As escritas
em posts, targets e post_media passam por server actions que validam e escrevem com a service
role. Os tokens das redes ficam em `social_account_secrets`, cifrados com AES-GCM na app e sem
nenhuma policy, por isso o browser nunca os vê.

```
workspaces ─< workspace_members >─ profiles (auth.users)
workspaces ─< workspace_invites
workspaces ─< brands ─< social_accounts ── social_account_secrets
                     ─< media_assets ─< media_renditions
                     ─< posts ─< post_targets >─ social_accounts
                              ─< post_media >─ media_assets
                              post_targets ─< publish_attempts
                     ── brand_voices
workspaces ─< ai_generations ─> media_assets (imagens geradas)
profiles ─< notifications
```

Restrições importantes:
- `post_targets unique (post_id, social_account_id)`: uma rede não recebe o mesmo post duas vezes.
- `post_media.media_asset_id on delete restrict` e `media_assets.deleted_at` (soft delete): não se
  apaga uma foto que um post agendado ainda vai publicar.
- `post_targets.social_account_id on delete restrict`: remover uma conta com posts exige
  cancelá-los primeiro.
- `posts.schedule_version`: o job de publicação só avança se a versão for a mesma de quando foi
  agendado. É assim que um reagendamento ou cancelamento anula o job antigo.
- `check (status <> 'scheduled' or scheduled_at is not null)`.

## API

Escritas como **server actions** (`app/(app)/.../actions.ts`), leituras com o cliente Supabase sob
RLS. Rotas HTTP só onde algo de fora chama.

### F01 Criar marca e associar contas

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createBrand` | cria marca + brand_voice vazia | member | name, timezone, language, logo? | brand | F01 |
| action `updateBrand` / `archiveBrand` | edita / arquiva | member | brand_id, campos | brand | F01 |
| action `syncMetaAccounts` | lê do Graph `/{business_id}/owned_pages` e `client_pages` com `instagram_business_account`, faz upsert em social_accounts e guarda tokens de página cifrados | admin | — | lista de contas | F01 |
| action `assignAccount` | atribui ou retira uma conta a uma marca | admin | social_account_id, brand_id \| null | conta | F01 |
| job `accounts.healthcheck` | diário: `GET /debug_token` e `/{id}?fields=id`; marca `needs_reconnect` e notifica | sistema | — | — | F07 |

Em vez do OAuth por marca do Metricool (S05), o ecrã S04 mostra **todas as Páginas e contas IG do
Business Manager** e o admin atribui cada uma a uma marca. Fica mais simples para uso interno.

### F02 Biblioteca de media

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createUpload` | valida tipo e tamanho, cria media_asset `processing` e devolve signed upload URL (TUS resumível para vídeo) | member | brand_id, filename, mime, size | asset_id, upload_url | F02 |
| action `completeUpload` | dispara `media.process` | member | asset_id | — | F02 |
| job `media.process` | lê dimensões e duração, gera thumbnail, valida specs (vídeo: MP4/MOV, H.264, AAC) e marca `ready` ou `failed` | sistema | asset_id | — | F02 |
| action `getRendition` | gera (ou reutiliza) JPEG no preset e recorte pedidos (`ig_feed_4x5`, `ig_square`, `story_9x16`...) | member | asset_id, preset, crop | rendition | F03 |
| action `updateAsset` / `deleteAsset` | tags / soft delete | member | asset_id | — | F02 |

HEIC: converter **no browser** antes do upload (`heic2any`), porque o `sharp` pré-compilado não lê
HEIC. Vídeo: no corte 1 só se valida e não se transcodifica; um vídeo fora das specs é rejeitado
com uma mensagem clara.

### F03, F06 Compor, agendar, publicar

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `saveDraft` | cria ou atualiza post `draft`, targets e media | member | post | post | F03 |
| action `validatePost` | regras por rede (ver abaixo); devolve erros por target | member | post | errors[] | F03 |
| action `schedulePost` | valida, converte a hora local da marca para UTC, `status=scheduled`, `schedule_version+1`, envia evento `post.scheduled` | member | post_id, local_datetime | post | F03 |
| action `publishNow` | igual, com `scheduled_at=now()` | member | post_id | post | F06 |
| action `reschedulePost` / `cancelPost` | `schedule_version+1` e novo evento / `cancelled` | member | post_id | post | F03 |
| action `retryTarget` | volta a pôr um target `failed` em `pending` e envia `target.publish` | member | target_id | target | F06 |
| action `duplicatePost` | copia para a mesma ou outra marca, em rascunho (should) | member | post_id, brand_id | post | — |
| job `post.publish` | `sleepUntil(scheduled_at)`; confirma `schedule_version`; `status=publishing`; envia um `target.publish` por target | sistema | post_id, version | — | F03 |
| job `target.publish` | publica num target (passos abaixo); no fim recalcula o estado do post (published / partial / failed) e notifica falhas | sistema | target_id | — | F03, F06 |
| job `story.reminder` | para `story` sem API utilizável, envia push/email com media e texto (should) | sistema | target_id | — | F09 |

**Passos do `target.publish`** (cada passo é um `step.run` do Inngest, com retry próprio):

Instagram (`/{ig-user-id}`):
1. imagem → `POST /media {image_url, caption, alt_text}`; carrossel → um container por item com
   `is_carousel_item=true`, depois `POST /media {media_type: CAROUSEL, children, caption}`; reel →
   `{media_type: REELS, video_url, caption, share_to_feed, cover_url|thumb_offset}`; story →
   `{media_type: STORIES, image_url|video_url}`. Guardar `container_id`.
2. vídeo: `GET /{container_id}?fields=status_code` até `FINISHED`, com `step.sleep('20s')` entre
   tentativas e no máximo 15 minutos.
3. `POST /media_publish {creation_id}` → `external_post_id`; ler o `permalink`.
4. primeiro comentário: `POST /{media_id}/comments`.
- Antes do passo 1: `GET /content_publishing_limit`. Se a quota estiver esgotada, adiar.

Facebook (`/{page-id}`, com token de página):
1. só texto ou texto e link → `POST /feed {message, link}`.
2. uma foto → `POST /photos {url, caption}`; várias → cada uma `POST /photos {url, published:false}`
   e depois `POST /feed {message, attached_media:[{media_fbid}]}`.
3. vídeo → `POST /videos {file_url, description}`; reel → fluxo `video_reels`
   (start → upload por URL → finish).
4. primeiro comentário: `POST /{post_id}/comments`.

A media é enviada à Meta por **signed URL do Supabase válida 1 hora**. Usamos o nosso agendador e
não o `scheduled_publish_time` da Meta, para os dois lados se comportarem igual.

**Validação por rede** (em `lib/networks/{instagram,facebook}.ts`, partilhada entre UI e servidor):

| regra | Instagram | Facebook |
| --- | --- | --- |
| texto | ≤ 2 200 car., ≤ 30 hashtags, ≤ 20 menções | ≤ 63 206 |
| feed imagem | JPEG, proporção 4:5 a 1.91:1, ≤ 8 MB | JPEG/PNG |
| carrossel | 2–10 itens | até ~10 fotos por post |
| reel | MP4/MOV, 3 s – 15 min, 9:16 recomendado | reels: 3–90 s |
| story | 9:16, imagem ou vídeo ≤ 60 s | não incluído no corte 1 |

Confirmar os números contra a documentação oficial da Meta no momento do build e guardá-los num só
ficheiro.

### F04, F05 IA

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| route `POST /api/ai/text` (stream) | gera N propostas com brand_voice + limites da rede no prompt; regista em ai_generations e debita créditos | member | brand_id, topic, tone?, language(s), network?, action (generate \| shorter \| longer \| hashtags \| cta \| translate), text? | stream de propostas | F04 |
| action `generateImage` | envia evento `ai.image` e devolve o `generation_id` | member | brand_id, prompt, aspect, reference_asset_id? | generation_id | F05 |
| job `ai.image` | chama o provider, grava em Storage como media_asset `source=ai`, `ready` | sistema | generation_id | — | F05 |
| action `updateBrandVoice` | guarda a voz da marca | member | brand_id, campos | brand_voice | F04 |

Créditos: a subtração é atómica, com `update workspaces set ai_credits_balance = ai_credits_balance - $n
where id = $ws and ai_credits_balance >= $n returning ...`. Se nenhuma linha for devolvida, não há
créditos.

### Equipa e notificações

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `inviteMember` | cria convite e envia email (Resend) | admin | email, role | invite | — |
| route `GET /auth/callback` | sessão Supabase; aceita convite pendente; recusa emails sem convite | público | code | redirect | — |
| action `markNotificationsRead` | — | self | ids | — | — |

Webhooks in: `POST /api/inngest` (Inngest). Webhooks da Meta não são precisos no corte 1.
Webhooks out: nenhum.
Jobs: `post.publish` e `target.publish` (por evento), `media.process` (por evento), `ai.image`
(por evento), `accounts.healthcheck` (diário às 07:00 Europe/Lisbon), `media.cleanup` (semanal:
apaga do Storage os assets com soft delete há mais de 30 dias que nenhum post usa).

## The parts that bite

- **time zones:** cada marca tem o seu fuso (IANA). O compositor mostra e recebe a hora local da
  marca, e o servidor converte para UTC com essa zona, não com a do browser. Na mudança de hora, uma
  hora local que não existe (ex.: 01:30 no último domingo de março em Lisboa) é rejeitada; uma hora
  ambígua (outubro) usa a primeira ocorrência. Tudo em `timestamptz`.
- **idempotency:** o `media_publish` do IG e o `POST /feed` não são idempotentes. Antes de cada
  passo confirma-se `post_targets.status` e `external_post_id`. O `container_id` é guardado e
  reutilizado. Se houver timeout depois do `media_publish`, lêem-se os media recentes da conta antes
  de repetir. Os eventos do Inngest têm id `target:{id}:v{version}`.
- **races:** a passagem `scheduled → publishing` é um `update ... where status='scheduled' and
  schedule_version=$v`; se afetar 0 linhas, o job termina. Editar um post `publishing` ou
  `published` é bloqueado no servidor.
- **rate limits:** limite de publicações por dia em cada conta IG (via `content_publishing_limit`) e
  limites de chamadas da app Meta. Concorrência do Inngest por `social_account_id` = 1, e backoff
  exponencial quando a Meta devolve um erro de rate limit.
- **file size limits:** imagem ≤ 25 MB e vídeo ≤ 1 GB no upload (TUS); o IG aceita imagens ≤ 8 MB e
  as renditions JPEG ficam abaixo disso. Validar no browser e no servidor.
- **tokens:** o token do System User não expira, mas é revogado se a Página sair do Business Manager
  ou se a permissão for retirada. O `accounts.healthcheck` deteta isso, e cada erro 190 da Graph
  API marca a conta `needs_reconnect`.
- **multi-tenancy:** RLS por workspace, com o helper `brand_workspace()`. A service role só é usada
  em código de servidor, depois de um `assertMember(brand_id)` explícito.
- **media URLs públicas:** a Meta precisa de baixar a media. As signed URLs duram 1 hora e só são
  criadas no momento de publicar, nunca guardadas.
- **IA:** nunca publicar texto gerado sem revisão humana (a IA só preenche o compositor). As imagens
  geradas ficam marcadas `source=ai`. Pessoas reais e logótipos de terceiros não entram nos prompts.
- **GDPR:** apagar um utilizador apaga o profile e os membros; posts e media ficam na marca
  (`created_by` vira null). Apagar uma marca apaga em cascata media, posts e contas. A Meta exige
  um URL de eliminação de dados para a app.
- **search:** a pesquisa na biblioteca é por tags (GIN) e nome do ficheiro; não é preciso full-text
  no corte 1.
- **realtime:** Supabase Realtime em `post_targets` para o estado no S13 e no calendário mudar sem
  refresh (should).

## Build order

1. **Vertical slice**: uma marca, uma Página FB e uma conta IG, uma foto e um post publicado já.
   - Screens: S01, S02 (mínimo), S04, S07 (só texto + 1 foto, IG + FB), S13.
   - Tables: todas criadas pela migração; usadas: workspaces, profiles, workspace_members, brands,
     social_accounts, social_account_secrets, media_assets, media_renditions, posts, post_targets,
     post_media, publish_attempts.
   - Routes: `createBrand`, `syncMetaAccounts`, `assignAccount`, `createUpload`, `completeUpload`,
     `media.process`, `getRendition`, `saveDraft`, `publishNow`, `target.publish`, `/api/inngest`,
     `/auth/callback`.
   - Prova: a app Meta Live e o token de System User funcionam, e o post aparece publicamente nas duas redes.

2. **Must-haves** (`features.csv`):
   - **Marcas:** S02 completo, S03, brand switcher.
   - **Biblioteca:** S08, S09 com upload múltiplo, progresso, HEIC e recortes por proporção.
   - **Compositor:** S07 completo com texto por rede, validação, pré-visualização IG/FB, carrossel
     e reel, `schedulePost`, `reschedulePost`, `cancelPost`.
   - **Publicação:** `post.publish` com versão e estados parciais, `retryTarget`, S13.
   - **Planner:** S06 com mês, semana e lista, rascunhos e filtros.
   - **IA texto:** S10, `/api/ai/text`, créditos.
   - **Ligações:** S04 com estado e `accounts.healthcheck`.

3. **Should-haves**:
   - **IA:** imagem (S11, `ai.image`), voz da marca (S12), ações de reescrita e tradução PT/EN.
   - **Conteúdo e calendário:** primeiro comentário, arrastar para reagendar, duplicar para outra marca.
   - **Equipa e avisos:** convites e equipa (S15), notificações (S16) e emails de falha, lembrete de
     story, Realtime.
   - Ficam para o corte 2: aprovações por cliente (S14) e papéis por marca. Exigem novas tabelas
     (`review_requests`, `brand_members`).

4. **Could-haves / corte 2**: Google Business Profile (pedir acesso à API **já**), LinkedIn, TikTok,
   CSV (S18), autolists, pastas na biblioteca, Google Drive e Canva, melhores horas.

5. **Fixes from replica-entrepreneur**: depois de correr `/replica-entrepreneur` sobre as reviews
   do Metricool.
