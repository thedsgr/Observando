-- =============================================================================
-- Geração de notificações.
--
-- Cria uma linha em `notifications` para cada par (assinante, votação) que
-- merece aviso. Não envia nada: o envio é outro passo, que lê as pendentes
-- cujo `scheduled_for` já passou.
--
-- Feita em SQL, numa instrução só, porque a regra mais importante — nunca
-- avisar duas vezes sobre a mesma coisa (PRD §8.3) — fica garantida pelo
-- banco: `dedup_key` é único e o INSERT ignora o que já existe. Rodar de novo,
-- reprocessar um ano inteiro ou duas execuções simultâneas não reenviam nada.
-- =============================================================================

-- Quando a votação apareceu no banco pela primeira vez. `synced_at` não serve:
-- é reescrito a cada sincronização. Esta coluna fica fora do upsert do
-- sincronizador, então o valor da primeira inserção se preserva.
--
-- As votações que já estavam no banco recebem o horário desta migração. É o
-- correto: elas chegaram antes de existir qualquer assinante confirmado.
alter table votings
  add column first_seen_at timestamptz not null default now();

create index votings_first_seen_idx
  on votings (first_seen_at) where has_individual_votes;

-- -----------------------------------------------------------------------------
-- Próximo horário de envio para cada frequência, em horário de Brasília.
-- Resumo diário: próximas 8h. Semanal: próxima segunda às 8h.
-- -----------------------------------------------------------------------------
create or replace function next_send_time(freq digest_frequency, ref timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  with local as (select ref at time zone 'America/Sao_Paulo' as agora)
  select case freq
    when 'imediato' then ref
    when 'diario' then (
      select case when t > agora then t else t + interval '1 day' end
      from (select date_trunc('day', agora) + interval '8 hours' as t) d
    ) at time zone 'America/Sao_Paulo'
    when 'semanal' then (
      select case when t > agora then t else t + interval '7 days' end
      from (select date_trunc('week', agora) + interval '8 hours' as t) w
    ) at time zone 'America/Sao_Paulo'
  end
  from local;
$$;

-- -----------------------------------------------------------------------------
-- A geração.
--
-- Avisa o assinante S sobre a votação V quando, ao mesmo tempo:
--
-- 1. S está apto: canal confirmado, sem `opted_out_at`, e o canal confirmado é
--    o canal preferido nas configurações.
--
-- 2. V é NOVA para S: apareceu no banco depois que S confirmou o canal. Sem
--    isso, quem se inscreve hoje receberia todas as votações do ano de uma vez.
--
-- 3. V é RECENTE: aconteceu dentro de `max_age`. Protege contra carga de anos
--    anteriores, que apareceria como "nova" para todo mundo.
--
-- 4. Algum parlamentar que S acompanha tem REGISTRO de voto em V. Registro,
--    não valor: voto em branco conta, porque o registro existe. E ausência de
--    registro não gera aviso — "não há registro" não é notícia e o §8.1
--    proíbe tratá-la como falta.
--
-- 5. O tema passa: S sem temas escolhidos recebe tudo; V sem tema atribuído
--    passa também. É a mesma regra do painel, pelo mesmo motivo: esconder um
--    voto real porque a nossa classificação falhou faria a pessoa concluir
--    que o parlamentar não votou.
--
-- Uma linha por (assinante, canal, votação), não por parlamentar: acompanhar
-- três deputados que votaram na mesma coisa gera um aviso só (PRD §8.3). O
-- envio monta a mensagem lendo os votos de todos os acompanhados.
-- -----------------------------------------------------------------------------
create or replace function generate_notifications(max_age interval default interval '14 days')
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  criadas integer;
begin
  insert into notifications (subscriber_id, channel_id, voting_id, dedup_key, state, scheduled_for)
  select
    s.id,
    c.id,
    v.id,
    'v1:' || s.id || ':' || c.id || ':' || v.id,
    'pendente',
    next_send_time(st.frequency)
  from subscribers s
  join subscriber_settings st on st.subscriber_id = s.id
  join subscriber_channels c  on c.id = st.channel_id and c.subscriber_id = s.id
  join votings v
    on v.has_individual_votes
   and v.first_seen_at > c.verified_at
   and v.occurred_at > now() - max_age
  where s.opted_out_at is null
    and c.verified_at is not null
    and exists (
      select 1
      from subscriber_legislators sl
      join votes x on x.legislator_id = sl.legislator_id and x.voting_id = v.id
      where sl.subscriber_id = s.id
    )
    and (
      not exists (select 1 from subscriber_topics t where t.subscriber_id = s.id)
      or not exists (select 1 from voting_topics vt where vt.voting_id = v.id)
      or exists (
        select 1
        from subscriber_topics t
        join voting_topics vt on vt.topic_id = t.topic_id and vt.voting_id = v.id
        where t.subscriber_id = s.id
      )
    )
  on conflict (dedup_key) do nothing;

  get diagnostics criadas = row_count;
  return criadas;
end;
$$;

-- Funções em Postgres são executáveis por PUBLIC por padrão, e o PostgREST
-- expõe as do schema `public` como RPC. Mesmo que o RLS barrasse a escrita,
-- a gente não deixa a porta aberta: só a chave de serviço chama isto.
revoke execute on function generate_notifications(interval) from public, anon, authenticated;
revoke execute on function next_send_time(digest_frequency, timestamptz) from public, anon, authenticated;
