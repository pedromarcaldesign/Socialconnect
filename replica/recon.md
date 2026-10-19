# Recon map: Metricool → Social Purepixel (web)

Scope: o núcleo de planeamento e publicação do Metricool. Marcas (ex.: "Hotel 1"),
cada uma com as suas redes sociais ligadas e a sua biblioteca de fotos e vídeos.
Um post é escrito uma vez e publicado ou agendado em todas as redes da marca, com
geração de conteúdo por IA (texto e imagem). Ficam de fora a analítica, os
anúncios, os concorrentes e os relatórios do Metricool (ver "Out of scope").
For: Purepixel. Ferramenta interna para gerir as marcas dos clientes (hotéis e
outros). Pode vir a ser vendida a outras agências mais tarde (assumido, a confirmar).
Date: 2026-10-19

> **Como foi feito.** Só com fontes públicas: help center, blog/tutoriais do
> Metricool e análises de terceiros, lidos através de pesquisa web. O domínio
> metricool.com está bloqueado pela rede deste ambiente cloud e não houve acesso
> à conta do utilizador. Por isso a coluna "states" diz **o que temos de
> construir** e não o que foi visto. Os IDs de ecrã são nossos e as rotas são
> propostas para a Social Purepixel, não as do Metricool. Antes do
> `/replica-design`, convém juntar capturas de ecrã da conta real do utilizador
> em `replica/screens/`.
>
> **Termos.** Confirmar se os termos de utilização do Metricool proíbem usar uma
> conta para construir um produto concorrente. Se proibirem, trabalha-se só com
> fontes públicas.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing: planner | https://metricool.com/planner/ | multi-rede, adaptação por rede, aprovações, CSV, Canva/Drive |
| 2 | tutorial oficial | https://metricool.com/metricool-mega-tutorial/ | marca = contentor, fluxo Planning → +, primeiro comentário por rede, best times, autolists, config IA por marca |
| 3 | guia de agendamento | https://metricool.com/planning-social-media-content-with-metricool/ | texto base + personalização por rede, tabela do primeiro comentário |
| 4 | help: opções por rede | https://help.metricool.com/scheduling-and-posting-options-by-social-network-cwmb3 | limites de media e de caracteres por rede |
| 5 | help: limitações de API | https://help.metricool.com/api-limitations-per-social-network-n7zlr | o que as APIs não deixam fazer |
| 6 | help: agendar no calendário | https://help.metricool.com/en/article/puu2z4 | redes agendáveis |
| 7 | help: CSV em lote | https://help.metricool.com/en/article/how-to-schedule-posts-in-batch-with-a-csv-file-in-metricool-3wihqx/ | importação em massa |
| 8 | help: gerador de texto IA | https://help.metricool.com/how-to-create-posts-with-metricools-ai-text-generator-sv0j8 | tema + tom + idioma + rede → proposta; créditos por tokens |
| 9 | marketing: assistente IA | https://metricool.com/ai-social-media-assistant-metricool/ | assistente IA |
| 10 | help: utilizadores e papéis | https://help.metricool.com/user-management-team-roles-and-permissions-in-metricool-ovjqe | Analyst, Editor, Manager, Content Creator, Client; papel por marca |
| 11 | help: partilhar calendário | https://help.metricool.com/how-to-share-your-content-calendar-with-clients-or-collaborators-sy0yt | partilha com clientes |
| 12 | marketing: aprovações | https://metricool.com/social-media-approval-tool/ | revisores externos por email, sem conta |
| 13 | pricing (via terceiros) | https://heymark.ai/en/compare/metricool-pricing/ , https://outfeed.ai/blog/metricool-pricing/ | Free 1 marca e 20 posts/mês; Starter 5–10 marcas; Advanced 15–50 marcas + equipa |
| 14 | reels | https://metricool.com/schedule-reels-with-metricool/ | Reels pelo Planner |
| 15 | conta do utilizador | — | **não usada**: sem acesso ao browser a partir da cloud |

## Core loop

Escolher uma marca → carregar ou gerar fotos e texto → escrever o post uma vez,
ajustá-lo por rede → publicar já ou agendar em todas as redes dessa marca.

## Screens

| ID | screen | route / how to reach | purpose | key components | states to build |
| --- | --- | --- | --- | --- | --- |
| S01 | Login / registo | `/login`, `/signup` | entrar com email ou Google | form, botão OAuth Google | default, erro, loading |
| S02 | Lista de marcas | `/brands` (seletor de marca no topo, sempre visível) | ver e trocar de marca | brand card (logo, nome, ícones das redes, alertas), brand switcher, pesquisa | vazio ("cria a tua primeira marca"), cheio, marca com ligação expirada |
| S03 | Criar / editar marca | modal a partir de S02 | nome, logo, fuso horário, idioma | form, upload de logo, select de fuso | novo, edição, erro de validação |
| S04 | Ligações da marca | `/b/:brand/settings/connections` | ligar e desligar redes | linha por rede (ícone, conta, estado, botão Ligar/Reconectar/Desligar) | nenhuma ligada, ligada, token expirado, permissões em falta, erro OAuth |
| S05 | Escolher página / conta | passo após OAuth (Meta, LinkedIn, Google) | escolher que página FB, conta IG, página LinkedIn ou local GBP fica nesta marca | lista com radio, avatar | uma conta, várias, nenhuma elegível (ex.: IG não profissional) |
| S06 | Planner / calendário | `/b/:brand/planner` | ver posts agendados, publicados e falhados por dia | vistas mês/semana/lista, post chip (ícones das redes, miniatura, estado), filtros por rede/estado, slots de melhor hora sombreados, botão + | vazio, cheio, a carregar, falhas em destaque |
| S07 | Compositor de post | modal/painel a partir de S06 (+ ou clique num dia) | criar um post para várias redes | seletor de redes (chips), editor de texto base, separadores por rede com texto próprio, media picker, contadores de caracteres por rede, primeiro comentário, formato (feed/reel/story/carrossel), data e hora, pré-visualização por rede, Publicar agora / Agendar / Rascunho / Enviar para aprovação | novo, edição, validação por rede (texto longo demais, media inválida), a guardar, erro |
| S08 | Biblioteca de media da marca | `/b/:brand/media` | todas as fotos e vídeos de uma marca | grelha, upload drag & drop, pastas/tags, pesquisa, filtro foto/vídeo, ver onde foi usado | vazia, a carregar upload (progresso), cheia, ficheiro rejeitado |
| S09 | Upload / importar | modal a partir de S07 ou S08 | trazer ficheiros | dropzone, progresso por ficheiro, fontes: computador, Google Drive, Canva (could) | idle, a carregar, sucesso, erro de tamanho/formato |
| S10 | Assistente IA de texto | painel lateral em S07 | gerar ou reescrever o texto | input de tema, tom, idioma, rede, botões (gerar, encurtar, alongar, + hashtags, + CTA, fio), lista de propostas, inserir | vazio, a gerar, propostas, sem créditos, erro |
| S11 | Gerador de imagem IA | separador em S09/S08 | gerar imagem a partir de prompt (e variações de uma foto da marca) | prompt, formato (1:1, 4:5, 9:16), estilo, grelha de resultados, guardar na biblioteca | vazio, a gerar, resultados, sem créditos, bloqueado por política |
| S12 | Voz da marca / config IA | `/b/:brand/settings/ai` | tom, idioma, regras e exemplos por marca e por rede | textarea, selects, exemplos de posts | vazio, preenchido |
| S13 | Detalhe do post | clique num post em S06 | estado por rede, link para o post publicado, erro e repetir | linha por rede com estado e link, botão Repetir, Duplicar, Apagar | agendado, a publicar, publicado, parcial (algumas redes falharam), falhado |
| S14 | Revisão / aprovação (externa) | `/review/:token` (sem login) | cliente aprova ou rejeita | pré-visualização, botões Aprovar/Rejeitar, comentário | pendente, aprovado, rejeitado, link expirado |
| S15 | Equipa e permissões | `/settings/team` | convidar pessoas, papel por marca | tabela de utilizadores, convite por email, matriz marca × papel | só eu, vários, convite pendente |
| S16 | Notificações | sino no topo + email/push | falhas, tokens a expirar, lembretes de story manual, pedidos de aprovação | lista de notificações | vazia, não lidas |
| S17 | Conta e faturação | `/settings/account` | perfil, plano, créditos IA | form, uso de créditos | — |
| S18 | Importar CSV | modal em S06 | agendar em lote | upload, mapeamento de colunas, pré-visualização, erros por linha | válido, linhas com erro |

## Flows

```
F01 Criar uma marca e ligar as redes
    S02 -> S03 (nome "Hotel 1", logo, fuso) -> S04 -> OAuth da rede -> S05 escolher página/conta -> S04 (ligada)
    happy path clicks: ~4 + ~3 por rede
    edge: conta IG pessoal (precisa de ser Business/Creator ligada a uma Página FB), utilizador sem
          permissão de admin na página, mesma conta ligada a duas marcas, OAuth cancelado, scopes recusados

F02 Carregar fotos para a biblioteca da marca
    S08 -> S09 (arrastar 20 fotos) -> S08 (fotos com tags)
    happy path clicks: 3
    edge: HEIC do iPhone, vídeo grande (upload resumível), ficheiro duplicado, sem espaço na quota

F03 Escrever um post e agendar em todas as redes da marca          <- o loop principal
    S06 -> + -> S07 (todas as redes pré-selecionadas, texto base, escolher fotos de S08)
        -> ajustar texto do X/LinkedIn nos separadores -> data/hora -> Agendar -> S06
    happy path clicks: ~7 (número a bater)
    edge: texto acima do limite de uma rede, 12 fotos para o IG (máx. 10), vídeo vertical para o LinkedIn,
          fuso da marca diferente do utilizador, data no passado, uma rede falha e as outras publicam

F04 Gerar o texto com IA
    S07 -> S10 (tema "jantar de verão no terraço", tom, PT) -> Gerar -> escolher proposta -> Inserir -> S07
    happy path clicks: 4
    edge: sem créditos, voz da marca vazia, pedido em vários idiomas (hotéis: PT + EN), texto gerado acima do limite

F05 Gerar uma imagem com IA
    S08 -> S11 (prompt, 4:5) -> Gerar -> Guardar na biblioteca -> usar em S07
    happy path clicks: 4
    edge: prompt recusado, pessoas/marcas reais na imagem, resolução baixa para o formato

F06 Publicar agora e tratar uma falha
    S07 -> Publicar agora -> S13 (IG ok, FB ok, LinkedIn falhou) -> Repetir só o LinkedIn
    edge: token expirado a meio, limite de rate da API, media rejeitada pela rede depois do upload

F07 Reconectar uma rede expirada
    S16 (aviso) -> S04 -> Reconectar -> OAuth -> S04
    edge: posts agendados nessa rede ficam em espera até reconectar

F08 Aprovação pelo cliente (should)
    S07 -> Enviar para aprovação (email do cliente) -> S14 Aprovar -> post passa a agendado
    edge: rejeitado com comentário, aprovado depois da hora marcada, vários revisores (um / todos)

F09 Story do Instagram ou TikTok semiautomático (should)
    S07 (formato story) -> à hora marcada S16 envia notificação push/email com media + texto -> o utilizador publica na app da rede
    edge: utilizador não vê a notificação

F10 Agendar em lote por CSV (could)
    S06 -> S18 -> mapear colunas -> confirmar -> S06
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, hover, focus, disabled, loading | todos |
| Brand switcher | dropdown no topo com pesquisa | fechado, aberto, marca com alerta | todos |
| Brand card | — | ok, ligação expirada | S02 |
| Network icon / chip | por rede (IG, FB, LinkedIn, X, TikTok, YouTube, Pinterest, Threads, Bluesky, GBP) | selecionado, não selecionado, desligado, erro | S04, S06, S07, S13 |
| Connection row | — | ligada, expirada, a ligar, erro | S04 |
| Calendar | mês, semana, lista | hoje, slot de melhor hora, drag-over | S06 |
| Post chip | miniatura + ícones + hora | rascunho, pendente de aprovação, agendado, publicado, parcial, falhado | S06 |
| Rich text editor | base, por rede | contador ok, perto do limite, acima do limite | S07, S10 |
| Character counter | por rede | ok, aviso, erro | S07 |
| Network tabs | — | herdado do base, personalizado | S07 |
| Post preview | IG feed, IG reel/story, FB, LinkedIn, X, TikTok | — | S07, S14 |
| Media grid | grelha, seleção múltipla | vazia, a carregar, selecionado | S07, S08 |
| Dropzone | — | idle, drag-over, a carregar, erro | S09 |
| Upload progress row | — | a carregar, feito, falhou | S09 |
| Date-time picker | com fuso da marca | — | S07, S18 |
| AI panel | texto, imagem | vazio, a gerar, resultado, sem créditos | S07, S10, S11 |
| Modal | small, large, full-screen (compositor) | — | S03, S07, S09, S18 |
| Toast | success, error, info | — | todos |
| Status badge | draft, pending, scheduled, publishing, published, partial, failed | — | S06, S13 |
| Empty state | por ecrã | — | S02, S04, S06, S08 |
| Table | — | vazia, cheia | S15, S18 |

## Inferred data model

```
Workspace   id, name, plan, ai_credits_balance, created_at
            evidence: planos limitados por nº de marcas (fonte 13); a Purepixel é o workspace
            confidence: high

User        id, email, name, avatar_url, locale, created_at
            confidence: high

Membership  workspace_id, user_id, role (owner | admin | member)
BrandAccess user_id, brand_id, role (manager | editor | content_creator | analyst | client),
            permissions (json, overrides)
            evidence: fonte 10, papéis por marca com toggles individuais
            confidence: high

Brand       id, workspace_id, name, logo_url, timezone, default_language, color, archived_at
            evidence: tutorial (fonte 2), marca = contentor de todas as contas de um negócio
            confidence: high

SocialAccount id, brand_id, network (instagram | facebook | linkedin | x | tiktok | youtube |
            pinterest | threads | bluesky | gbp), external_id, display_name, avatar_url,
            account_type (page | business | creator | personal | location), access_token (enc),
            refresh_token (enc), token_expires_at, scopes, status (active | expired | error),
            last_error, connected_by, connected_at
            evidence: S04/S05, help de ligação por rede
            confidence: high (forma), guess (nomes dos campos)

MediaAsset  id, brand_id, kind (image | video | gif), storage_key, mime, width, height,
            duration_s, size_bytes, thumbnail_key, source (upload | ai | canva | drive),
            ai_prompt, tags[], folder_id, uploaded_by, created_at
            evidence: pedido do utilizador ("carregar fotos para cada conjunto de contas"); o Metricool
            tem pouca biblioteca, por isso aqui é melhoria nossa
            confidence: high (é requisito)

Folder      id, brand_id, name, parent_id                                   confidence: guess

Post        id, brand_id, base_text, status (draft | pending_approval | scheduled | publishing |
            published | partial | failed), scheduled_at (UTC), publish_now, created_by,
            approved_by, approved_at, source (manual | csv | autolist), created_at, updated_at
            evidence: fontes 2, 3, 12
            confidence: high

PostTarget  id, post_id, social_account_id, text_override, format (feed | reel | story |
            carousel | thread | short | pin | gbp_update), first_comment, options (json:
            location, tagged users, cover frame, link, title YT, board Pinterest, privacy TikTok),
            status (pending | publishing | published | failed | manual_reminder_sent),
            external_post_id, external_url, error_code, error_message, attempts, published_at
            evidence: fontes 3 e 4, texto e opções por rede, primeiro comentário por rede
            confidence: high (forma)

PostMedia   post_id, media_asset_id, position, target_id (null = todas as redes)
            confidence: medium

BrandVoice  brand_id, tone, language(s), audience, do[], dont[], example_posts[],
            per_network (json)
            evidence: fonte 2, "Brand settings > AI Configuration", por marca e por rede
            confidence: high

AIGeneration id, brand_id, user_id, kind (text | image), input (json), output (json),
            credits_used, model, created_at
            evidence: fonte 8, créditos por tokens
            confidence: medium

ReviewRequest id, post_id, reviewer_email, reviewer_user_id, token, rule (one | all),
            decision (pending | approved | rejected), comment, decided_at
            evidence: fonte 12
            confidence: medium

Notification id, user_id, kind, payload, read_at                           confidence: guess
Autolist    id, brand_id, name, slots (json: dia+hora por rede), items -> Post (could)
            evidence: fonte 2                                               confidence: medium
```

Relationships: Workspace 1-n Brand, Workspace 1-n Membership n-1 User, User n-n Brand (BrandAccess),
Brand 1-n SocialAccount, Brand 1-n MediaAsset, Brand 1-n Post, Post 1-n PostTarget n-1 SocialAccount,
Post n-n MediaAsset (PostMedia), Brand 1-1 BrandVoice, Post 1-n ReviewRequest.

## Limites por rede (para validar no compositor)

| rede | texto | media | nota |
| --- | --- | --- | --- |
| Instagram | 2 200 | até 10 imagens/vídeos (carrossel), Reels até 15 min | stories: o Metricool usa lembrete manual (fontes em conflito) |
| Facebook | — | imagens, vídeo, reels | Página, não perfil pessoal |
| LinkedIn | — | imagens, vídeo, documento | página da empresa requer aprovação da API Community Management |
| X | 280 (sem Premium) | até 4 imagens | API paga; no Metricool é add-on à parte |
| TikTok | 2 000–2 200 | 1 vídeo ou até 35 imagens | API de publicação exige auditoria; até lá só privado/rascunho |
| Threads | 500 | até 20 imagens, fios até 80 posts | sem GIF nem sondagens via API |
| Bluesky | 300 | 4 imagens ou 1 vídeo | API aberta, a mais fácil |
| Google Business Profile | 1 500 | 1 imagem ou 1 vídeo | útil para hotéis; acesso à API por pedido |
| YouTube / Pinterest | — | — | could |

Fonte: 4 e 5. Confirmar todos os limites contra a documentação oficial de cada rede na fase do `/replica-architect`.

## Feature matrix

See `features.csv`. Must: 22, should: 14, could: 10, skip: 7.

## Out of scope (cannot or should not be cloned)

- **Analítica, relatórios, concorrentes e anúncios do Metricool.** Fora do âmbito pedido. São um produto
  à parte, e os dados históricos são do Metricool.
- **As aprovações de API que o Metricool já tem.** Cada rede exige a sua app aprovada: Meta App Review
  para `instagram_content_publish` e `pages_manage_posts`, auditoria da TikTok Content Posting API,
  LinkedIn Community Management API, plano pago da X API, pedido de acesso à Google Business Profile
  API e quota da YouTube API. Isto tem de ser pedido em nome da Purepixel e demora semanas.
- **Funcionalidades que as APIs não dão.** Stories automáticos onde a API não os permite, música
  em tendência nos Reels e texto sobreposto no TikTok. Ficam como lembrete manual.
- **Integrações de parceiros.** Canva e Google Drive só via as APIs oficiais deles (could), sem
  acordos de parceria.
- **Marca, logótipo, textos e ilustrações do Metricool.** A Social Purepixel tem identidade própria.
- **Inbox unificado de mensagens e comentários.** Possível mais tarde, mas fora do loop pedido.

## Size

Screens 18, flows 10, entities 14.
Hard parts:
1. **Aprovações das APIs das redes e OAuth** (Meta, TikTok, LinkedIn, X, Google). É o caminho crítico,
   mais do que o código, e convém começar os pedidos já.
   Exceção para uso interno: na Meta, uma app própria da Purepixel com acesso Standard (sem App
   Review) publica em todas as Páginas e contas IG que as pessoas com papel na app gerem. A app tem de
   estar em modo Live, porque em Development os posts só são visíveis para quem tem papel na app.
   O token deve ser de um System User do Business Manager. O App Review só é necessário para vender a
   outras agências.
2. **Motor de publicação fiável:** fila de jobs à hora exata no fuso da marca, upload de media por
   rede (containers do IG, upload em partes do TikTok/YouTube), retries, publicação parcial,
   renovação e expiração de tokens.
3. **Media:** uploads grandes e resumíveis, conversão (HEIC → JPG, vídeo para o formato de cada rede),
   recortes por proporção e armazenamento por marca.

Mais pequenos: geração IA de texto e imagem com voz da marca e créditos, e permissões por marca.

Size: **L** (um trimestre) para todas as redes. Um **M** (algumas semanas) é realista se o primeiro
corte for só Instagram, Facebook e Google Business Profile (o essencial para hotéis), mais a
biblioteca de media e a IA de texto e imagem, e as outras redes entrarem depois por ordem.
