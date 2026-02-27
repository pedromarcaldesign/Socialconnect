# SocialConnect – Hotel Social Media Manager

Webapp para criar e gerir publicações de Facebook e Instagram para hotéis, com IA integrada.

## Funcionalidades

- **Gestão de Hotéis** – Adicionar hotéis com pesquisa automática de informação online
- **Galeria de Fotos** – Upload de fotos próprias do hotel com análise por IA (Claude Vision)
- **Banco de Imagens** – Pesquisa de imagens gratuitas via Unsplash/Pexels
- **3 Modos de Geração:**
  - **Em Lote** – Seleciona hotéis, a app escolhe foto e gera texto automaticamente
  - **Manual** – Escolhes hotel e foto, a IA cria o texto
  - **Por Ideia** – Escreves uma ideia, a IA sugere foto e cria texto
- **Fluxo de Aprovação** – Rascunho → Editar → Aprovar
- **Suporte Bilingue** – Tradução automática PT-PT 🇵🇹 + EN 🇬🇧

## Setup

### 1. Instalar dependências

```bash
npm run install:all
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Editar `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...        # Obrigatório para IA
UNSPLASH_ACCESS_KEY=...             # Opcional – banco de imagens Unsplash
PEXELS_API_KEY=...                  # Opcional – banco de imagens Pexels
PORT=3001
```

### 3. Iniciar em desenvolvimento

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001

## Estrutura

```
├── backend/          # Express + TypeScript + SQLite
│   └── src/
│       ├── database/ # Schema SQLite
│       ├── routes/   # hotels, photos, posts, images
│       └── services/ # AI (Claude), scraper, imageSearch
└── frontend/         # React + TypeScript + Tailwind
    └── src/
        ├── pages/    # Dashboard, Hotels, GeneratePosts, etc.
        ├── api/      # Axios client
        └── types/    # TypeScript types
```

## Chaves de API

| Serviço | Onde obter | Obrigatório |
|---------|-----------|-------------|
| Anthropic (Claude) | https://console.anthropic.com | Sim (para IA) |
| Unsplash | https://unsplash.com/developers | Não |
| Pexels | https://www.pexels.com/api | Não |

> Sem `ANTHROPIC_API_KEY`, a app funciona em modo demonstração com respostas simuladas.
