# Build log

| ID | data | estado | falta | notas |
| --- | --- | --- | --- | --- |
| S01 | 2026-10-19 | done | — | magic link e Google via Supabase; só por convite ou ALLOWED_EMAILS |
| S02 | 2026-10-19 | done | — | cartões com redes, alertas e contagens |
| S03 | 2026-10-19 | partial | upload de logótipo | modal de criação + página de perfil |
| S04 | 2026-10-19 | done | — | em vez de OAuth por marca: sync do System User e atribuição |
| S05 | — | skip | — | substituído pelo sync (S04) |
| S06 | 2026-10-19 | partial | vista semana | mês com arrastar, lista, rascunhos |
| S07 | 2026-10-19 | done | vídeo | redes, fotos, recortes, texto por rede, IA, validação, pré-visualização |
| S08/S09 | 2026-10-19 | done | vídeo, pastas | upload direto com progresso, análise IA, editar etiquetas |
| S10 | 2026-10-19 | done | — | dentro do compositor |
| S11 | — | no | — | geração de imagem fica para o próximo corte |
| S12 | 2026-10-19 | done | por rede | voz da marca + preencher a partir do site |
| S13 | 2026-10-19 | done | — | estado por rede, repetir, cancelar, duplicar, registo técnico |
| S14 | — | no | — | aprovação por clientes no corte 2 |
| S15 | 2026-10-19 | done | papéis por marca | convites e remoção |
| S16 | — | partial | interface | notificações gravadas, sem ecrã |

Mais difícil do que parecia: o Next 16 pré-gerava páginas autenticadas na build (resolvido com
`connection()`), e o `ANTHROPIC_BASE_URL` do ambiente sobrepunha-se ao simulador (passou a `AI_BASE_URL`).
Capturas em `replica/clone-screens/`.
