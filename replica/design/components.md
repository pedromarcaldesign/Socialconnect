# Social Purepixel: componentes

Tokens em `tokens.json`. Contraste: 26 pares, 0 falhas AA. Ícones: Lucide (ISC). Fonte: Inter (OFL).
Todos os componentes usam classes de token (`bg-surface`, `text-muted`), nunca hex soltos.
Foco visível em tudo o que é interativo: anel de 2px `focus`, com offset de 2px.

```
Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px
  states    default, hover, active, focus-visible, disabled, loading (spinner + label mantido, aria-busy)
  tokens    primary: bg accent / text on-accent / hover accent-hover; secondary: bg bg, border, text;
            ghost: transparente, text-muted, hover canvas; danger: bg danger, text on-accent
            radius md, font sm/600
  a11y      <button> real; ícone-só exige aria-label
  used on   todos

Input / Textarea / Select
  states    default, focus (border focus + anel), invalid (border danger + mensagem com aria-describedby), disabled
  tokens    border border-input, radius md, text sm, altura 40px
  a11y      <label> associado; erro anunciado
  used on   S01, S03, S07, S10, S12

Field
  label + controlo + ajuda/erro; label text-sm/600, ajuda text-xs text-muted
  used on   formulários

Card
  bg surface-raised, border, radius lg, shadow card, padding 16/24
  used on   S02, S06, S08, S13

Badge / StatusBadge
  variants  neutral, accent, success, warning, danger, info
  status    draft (neutral), scheduled (info), publishing (accent), published (success),
            partial (warning), failed (danger), cancelled (neutral)
  tokens    bg *-soft, text da cor, radius pill, text xs/500, ícone 12px
  a11y      texto sempre presente (cor nunca é o único sinal)
  used on   S06, S07, S13

NetworkChip
  networks  instagram, facebook (corte 1)
  states    selected (bg net-*, text on-accent), unselected (border, text-muted), unavailable (disabled + tooltip "sem conta ligada")
  a11y      role="checkbox" + aria-checked; nome da conta no label
  used on   S04, S07, S13

BrandSwitcher
  dropdown no topo da sidebar: logo/inicial + nome; lista pesquisável; "Gerir marcas"
  states    fechado, aberto, marca com alerta (ponto danger se alguma conta needs_reconnect)
  a11y      menu navegável por teclado (setas, Enter, Esc)
  used on   todos

Sidebar / AppShell
  sidebar 248px (colapsa em drawer < lg), header 56px, conteúdo max 1280px, fundo canvas
  nav       Planner, Criar, Biblioteca, Rascunhos, Ligações, Voz da marca
  used on   todos exceto S01

Modal / Sheet
  sizes     sm 440, md 640, full (compositor em ecrã inteiro < md)
  states    aberto, a fechar; Esc fecha; foco preso; devolve foco ao gatilho
  tokens    shadow pop, radius lg, overlay rgba(22,21,31,.5)
  used on   S03, S07, S09

Toast
  variants  success, error, info; 4s; aria-live polite (error: assertive)
  used on   todos

EmptyState
  ícone Lucide 40px text-subtle, título sm/600, frase text-muted, 1 ação primária
  used on   S02, S04, S06, S08

MediaGrid / MediaTile
  grelha 2→6 colunas; tile 1:1 com object-cover; vídeo com badge de duração
  states    default, hover (overlay com ações), selected (anel accent + número de ordem), processing (shimmer), failed
  a11y      tiles selecionáveis são <button aria-pressed>
  used on   S07, S08

Dropzone
  states    idle, drag-over (border accent, bg accent-soft), uploading (progresso por ficheiro), error
  a11y      também abre com Enter/Espaço (input file escondido)
  used on   S08, S09

CharCounter
  "1 234 / 2 200"; ok text-subtle, ≥ 90% warning, > limite danger + aria-live
  used on   S07

PostPreview
  variants  instagram-feed (quadrado/4:5, avatar, legenda truncada "mais"), facebook (texto acima, imagem abaixo)
  conteúdo  sempre original nosso: sem ícones ou logótipos das redes copiados; só o nome da conta e o layout genérico
  used on   S07

DateTimePicker
  input date + input time nativos, com o fuso da marca mostrado ("Hora de Lisboa")
  states    válido, no passado (erro), hora inexistente por mudança de hora (erro)
  used on   S07

Calendar
  views     mês (grelha 7×n, até 3 PostChips por dia + "+N"), semana (colunas por dia, ordenado por hora), lista
  states    hoje destacado (accent-soft), dia vazio clicável → compositor nesse dia
  a11y      grid com aria-label por dia; chips são links
  used on   S06

PostChip
  hora · miniatura 24px · pontos das redes · StatusBadge compacto (só cor + ícone com title/aria-label)
  used on   S06

ConnectionRow
  avatar, nome, @username, rede, marca atribuída (select), estado
  states    active, needs_reconnect, error, não atribuída
  used on   S04

AIPanel
  sheet lateral 400px no compositor: tema, tom, idioma(s), ação; lista de propostas com "Usar"
  states    vazio, a gerar (stream), propostas, erro, sem créditos
  used on   S07/S10

Skeleton
  shimmer em canvas → surface; respeita prefers-reduced-motion
```
