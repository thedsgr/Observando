-- =============================================================================
-- Observa — esquema inicial
--
-- Duas decisões estruturais, tomadas agora para não custarem retrabalho depois:
--
-- 1. MULTI-CASA. O MVP cobre só a Câmara, mas Senado entra depois. Nenhuma
--    tabela usa o identificador oficial como chave primária, porque os ids da
--    Câmara e do Senado colidem. A chave é interna e o par
--    (house_id, external_id) é único.
--
-- 2. MULTI-CANAL. O MVP envia só e-mail, mas SMS e WhatsApp entram depois. Por
--    isso o contato não é uma coluna `email` no assinante: é a tabela
--    `subscriber_channels`, com verificação por canal. Um assinante pode ter
--    e-mail verificado e WhatsApp pendente ao mesmo tempo.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Casas legislativas
-- -----------------------------------------------------------------------------
create table houses (
  id          text primary key,              -- 'camara', 'senado'
  name        text not null
);

insert into houses (id, name) values ('camara', 'Câmara dos Deputados');

-- -----------------------------------------------------------------------------
-- Taxonomia do produto. Os temas oficiais da Câmara são mapeados para cá;
-- o mapeamento vive no código (src/lib/camara/topic-map.ts) para ser auditável
-- em revisão de código, não escondido em dados.
-- -----------------------------------------------------------------------------
create table topics (
  id          text primary key,              -- 'saude', 'educacao', ...
  label       text not null,
  position    smallint not null default 0
);

-- A taxonomia é fixa e pequena, e `voting_topics` e `subscriber_topics`
-- referenciam estas chaves. Mantida em sincronia com src/lib/topics.ts.
insert into topics (id, label, position) values
  ('saude',             'Saúde',             1),
  ('educacao',          'Educação',          2),
  ('economia',          'Economia',          3),
  ('meio-ambiente',     'Meio ambiente',     4),
  ('seguranca-publica', 'Segurança pública', 5),
  ('direitos-sociais',  'Direitos sociais',  6),
  ('transporte',        'Transporte',        7),
  ('tecnologia',        'Tecnologia',        8);

-- -----------------------------------------------------------------------------
-- Parlamentares
-- -----------------------------------------------------------------------------
create table legislators (
  id            uuid primary key default gen_random_uuid(),
  house_id      text not null references houses(id),
  external_id   text not null,               -- id oficial na casa de origem
  name          text not null,
  party         text,                        -- pode faltar na fonte
  uf            text,
  photo_url     text,
  in_office     boolean not null default true,
  synced_at     timestamptz not null default now(),
  unique (house_id, external_id)
);

create index legislators_name_idx on legislators (name);

-- -----------------------------------------------------------------------------
-- Proposições
-- -----------------------------------------------------------------------------
create table propositions (
  id            uuid primary key default gen_random_uuid(),
  house_id      text not null references houses(id),
  external_id   text not null,
  label         text not null,               -- 'PL 4674/2024'
  title         text not null,               -- ementa oficial
  -- Situação da TRAMITAÇÃO. Não confundir com o resultado de uma votação:
  -- são fatos distintos e o produto nunca os colapsa (PRD §8.1).
  status        text,
  source_url    text not null,
  synced_at     timestamptz not null default now(),
  unique (house_id, external_id)
);

-- -----------------------------------------------------------------------------
-- Votações
-- -----------------------------------------------------------------------------
create type object_kind as enum (
  'texto-principal', 'substitutivo', 'redacao-final', 'emenda',
  'destaque', 'requerimento', 'parecer', 'recurso', 'procedimental'
);

create type confidence as enum ('alta', 'media', 'baixa');

create table votings (
  id                   uuid primary key default gen_random_uuid(),
  house_id             text not null references houses(id),
  external_id          text not null,
  proposition_id       uuid references propositions(id),
  occurred_at          timestamptz not null,

  -- Descrição oficial do objeto votado, preservada literalmente. É a única
  -- descrição que a fonte fornece e nunca é reescrita.
  object_description   text not null,

  -- Tipo do objeto. Nulo quando nem o cadastro nem a descrição determinam —
  -- a fonte não tem campo confiável para isso. `object_basis` guarda o que
  -- disparou a classificação, para auditoria.
  object_kind          object_kind,
  object_confidence    confidence,
  object_basis         text,
  -- Quantos objetos a fonte lista como candidatos. Mais de um = ambíguo.
  object_candidates    smallint not null default 0,

  -- Resultado da DELIBERAÇÃO. Não é o voto de ninguém.
  result               text,

  -- Contagens oficiais. A soma > 0 é o que significa "há voto individual":
  -- a fonte não tem campo dizendo se a votação foi nominal, e lista vazia não
  -- distingue votação simbólica de votos ainda não publicados.
  votes_yes            integer not null default 0,
  votes_no             integer not null default 0,
  votes_other          integer not null default 0,

  source_url           text not null,
  synced_at            timestamptz not null default now(),
  unique (house_id, external_id)
);

create index votings_occurred_at_idx on votings (occurred_at desc);

-- Coluna gerada para o recorte mais usado do produto.
alter table votings add column has_individual_votes boolean
  generated always as (votes_yes + votes_no + votes_other > 0) stored;

create index votings_with_votes_idx
  on votings (occurred_at desc) where has_individual_votes;

-- -----------------------------------------------------------------------------
-- Votos individuais
--
-- A AUSÊNCIA de uma linha significa apenas "não há registro". Não equivale a
-- ausência do parlamentar nem a voto contrário (PRD §8.1). `value` guarda o
-- texto da fonte como veio ('Sim', 'Não', 'Abstenção', 'Obstrução',
-- 'Artigo 17'), inclusive vazio: em 2026 há 466 votos registrados sem valor.
-- -----------------------------------------------------------------------------
create table votes (
  voting_id      uuid not null references votings(id) on delete cascade,
  legislator_id  uuid not null references legislators(id),
  value          text not null,
  recorded_at    timestamptz,
  primary key (voting_id, legislator_id)
);

create index votes_legislator_idx on votes (legislator_id);

-- -----------------------------------------------------------------------------
-- Classificação temática. Origem e confiança ficam na linha para que a
-- interface possa sinalizar incerteza em vez de apresentar palpite como certeza.
-- -----------------------------------------------------------------------------
create type classification_origin as enum ('metadado-oficial', 'regra', 'ia');

create table voting_topics (
  voting_id       uuid not null references votings(id) on delete cascade,
  topic_id        text not null references topics(id),
  origin          classification_origin not null,
  confidence      confidence not null,
  official_theme  text,                       -- tema oficial que originou
  primary key (voting_id, topic_id)
);

-- -----------------------------------------------------------------------------
-- Assinantes
--
-- Não há senha e não há tabela de "contas": a identidade é um canal
-- verificado. O assinante só passa a receber mensagens depois que pelo menos
-- um canal é confirmado (PRD §8.4).
-- -----------------------------------------------------------------------------
create table subscribers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- Consentimento explícito, com registro de quando foi dado.
  consented_at timestamptz,
  -- Cancelamento geral. Mantemos a linha para não reenviar nada a quem saiu.
  opted_out_at timestamptz
);

create type channel_kind as enum ('email', 'sms', 'whatsapp');

create table subscriber_channels (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid not null references subscribers(id) on delete cascade,
  kind           channel_kind not null,
  -- E-mail ou telefone em E.164. Guardado em minúsculas/normalizado.
  address        text not null,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (kind, address)
);

create index subscriber_channels_subscriber_idx
  on subscriber_channels (subscriber_id);

-- Links mágicos: confirmação de canal e acesso às preferências, sem senha.
create table magic_tokens (
  token_hash    text primary key,            -- nunca o token em claro
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  channel_id    uuid references subscriber_channels(id) on delete cascade,
  purpose       text not null,               -- 'verify' | 'manage'
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index magic_tokens_subscriber_idx on magic_tokens (subscriber_id);

-- -----------------------------------------------------------------------------
-- Preferências
-- -----------------------------------------------------------------------------
create table subscriber_legislators (
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  legislator_id uuid not null references legislators(id),
  created_at    timestamptz not null default now(),
  primary key (subscriber_id, legislator_id)
);

-- Nenhuma linha aqui significa "todos os temas". É o padrão de quem não quer
-- escolher, e os temas priorizam o alerta sem esconder histórico (PRD §8.2).
create table subscriber_topics (
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  topic_id      text not null references topics(id),
  primary key (subscriber_id, topic_id)
);

create type digest_frequency as enum ('imediato', 'diario', 'semanal');

create table subscriber_settings (
  subscriber_id uuid primary key references subscribers(id) on delete cascade,
  frequency     digest_frequency not null default 'semanal',
  -- Canal preferido para envio. Aponta para um canal verificado.
  channel_id    uuid references subscriber_channels(id) on delete set null,
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Notificações
--
-- `dedup_key` é o que garante a regra do PRD §8.3: um usuário não recebe duas
-- mensagens pela mesma votação só porque acompanha vários parlamentares nela,
-- e reprocessamento não reenvia evento antigo como novo.
-- -----------------------------------------------------------------------------
create type notification_state as enum ('pendente', 'enviada', 'falhou', 'cancelada');

create table notifications (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid not null references subscribers(id) on delete cascade,
  channel_id     uuid not null references subscriber_channels(id) on delete cascade,
  voting_id      uuid not null references votings(id) on delete cascade,
  dedup_key      text not null,
  state          notification_state not null default 'pendente',
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  error          text,
  created_at     timestamptz not null default now(),
  unique (dedup_key)
);

create index notifications_pending_idx
  on notifications (scheduled_for) where state = 'pendente';

-- -----------------------------------------------------------------------------
-- Registro de sincronização, para auditoria e reprocessamento.
-- -----------------------------------------------------------------------------
create table sync_runs (
  id            uuid primary key default gen_random_uuid(),
  house_id      text not null references houses(id),
  source        text not null,               -- 'arquivos-anuais' | 'api-rest'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  -- Até onde a fonte cobria nesta execução. Os arquivos anuais fecham no dia
  -- anterior, e a interface declara isso em vez de sugerir tempo real.
  coverage_end  timestamptz,
  votings_seen  integer not null default 0,
  error         text
);
