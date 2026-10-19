-- Social Purepixel: esquema inicial (corte 1: Instagram + Facebook)
-- Postgres 15+ (Supabase em produção). Horas sempre em timestamptz (UTC).
--
-- Acesso: o servidor Next.js liga-se com o utilizador dono das tabelas e verifica
-- permissões em src/lib/auth.ts (requireBrand / requireAdmin) antes de cada leitura e escrita.
-- RLS fica ligado SEM policies: a API pública do Supabase (chave anon) não lê nada.

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- workspaces, perfis, membros
-- ---------------------------------------------------------------------------

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- id = id do utilizador no Supabase Auth
create table profiles (
  id uuid primary key,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members (user_id);

create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  invited_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- ---------------------------------------------------------------------------
-- marcas
-- ---------------------------------------------------------------------------

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  logo_key text,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  timezone text not null default 'Europe/Lisbon',
  website text,
  description text,
  location text,
  amenities text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create index brands_workspace_idx on brands (workspace_id) where archived_at is null;

-- voz da marca: alimenta todos os prompts de IA
create table brand_voices (
  brand_id uuid primary key references brands(id) on delete cascade,
  tone text not null default 'profissional e acolhedor',
  audience text,
  languages text[] not null default '{pt-PT}',
  keywords text[] not null default '{}',
  dos text[] not null default '{}',
  donts text[] not null default '{}',
  example_posts text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- contas sociais (corte 1: facebook, instagram)
-- ---------------------------------------------------------------------------

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,   -- null = ainda não atribuída
  network text not null check (network in ('facebook','instagram')),
  external_id text not null,                 -- id da Página ou da conta IG
  username text,
  display_name text not null,
  avatar_url text,
  page_external_id text,                     -- IG: Página FB a que está ligada (dona do token)
  status text not null default 'active' check (status in ('active','needs_reconnect','removed')),
  last_error text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, network, external_id)
);
create index social_accounts_brand_idx on social_accounts (brand_id);

-- tokens cifrados (AES-256-GCM na aplicação). Nunca saem do servidor.
create table social_account_secrets (
  social_account_id uuid primary key references social_accounts(id) on delete cascade,
  access_token_enc text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- biblioteca de media
-- ---------------------------------------------------------------------------

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  storage_key text not null unique,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  thumb_key text,
  original_filename text,
  source text not null default 'upload' check (source in ('upload','ai')),
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  error text,
  description text,                          -- da análise IA, editável
  tags text[] not null default '{}',
  analysis jsonb,                            -- {mood, setting, subjects, suggestions}
  uploaded_by uuid references profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_brand_idx on media_assets (brand_id, created_at desc) where deleted_at is null;
create index media_assets_tags_idx on media_assets using gin (tags);

-- versões JPEG prontas para cada formato das redes
create table media_renditions (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  preset text not null check (preset in ('square','portrait','landscape','story','original')),
  storage_key text not null unique,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now(),
  unique (media_asset_id, preset)
);

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------

create table posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  base_text text not null default '',
  aspect text not null default 'portrait' check (aspect in ('square','portrait','landscape')),
  status text not null default 'draft'
    check (status in ('draft','scheduled','publishing','published','partial','failed','cancelled')),
  scheduled_at timestamptz,
  schedule_version integer not null default 0,
  generation_mode text check (generation_mode in ('manual','idea','batch')),
  idea text,
  created_by uuid references profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_needs_time check (status <> 'scheduled' or scheduled_at is not null)
);
create index posts_brand_time_idx on posts (brand_id, scheduled_at);
create index posts_due_idx on posts (scheduled_at) where status = 'scheduled';

create table post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete restrict,
  format text not null check (format in ('feed','carousel','story','reel')),
  text_override text,
  first_comment text,
  status text not null default 'pending'
    check (status in ('pending','publishing','published','failed','skipped')),
  container_id text,
  external_post_id text,
  external_url text,
  error_message text,
  attempts integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, social_account_id)
);
create index post_targets_account_idx on post_targets (social_account_id);

create table post_media (
  post_id uuid not null references posts(id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  media_asset_id uuid not null references media_assets(id) on delete restrict,
  primary key (post_id, position)
);
create index post_media_asset_idx on post_media (media_asset_id);

create table publish_attempts (
  id uuid primary key default gen_random_uuid(),
  post_target_id uuid not null references post_targets(id) on delete cascade,
  step text not null,
  ok boolean not null,
  http_status integer,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index publish_attempts_target_idx on publish_attempts (post_target_id, created_at);

-- ---------------------------------------------------------------------------
-- IA
-- ---------------------------------------------------------------------------

create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  kind text not null check (kind in ('caption','analysis','translation','brand_profile','rewrite')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index ai_generations_ws_idx on ai_generations (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- notificações
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,   -- null = todos os membros
  kind text not null check (kind in ('publish_failed','publish_partial','account_needs_reconnect')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_ws_idx on notifications (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at + RLS sem policies
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['workspaces','profiles','brands','brand_voices','social_accounts',
    'social_account_secrets','media_assets','posts','post_targets']
  loop
    execute format('create trigger %I_updated_at before update on %I
      for each row execute function set_updated_at()', t, t);
  end loop;
  foreach t in array array['workspaces','profiles','workspace_members','workspace_invites','brands',
    'brand_voices','social_accounts','social_account_secrets','media_assets','media_renditions',
    'posts','post_targets','post_media','publish_attempts','ai_generations','notifications']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
