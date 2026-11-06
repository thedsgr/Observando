-- =============================================================================
-- Avisos sem filtro de tema.
--
-- Acompanhar um parlamentar passa a ser acompanhar tudo o que ele vota. A
-- escolha de temas no onboarding ia contra a proposta do produto: quem
-- acompanhava um deputado só por "Saúde" nunca ficava sabendo do voto dele
-- numa reforma tributária. E a classificação é imperfeita o bastante para
-- esconder votos por engano, não só por escolha. O volume já é baixo (cerca
-- de uma votação nominal a cada cinquenta) e a frequência continua sendo o
-- jeito de controlar quantos e-mails chegam.
--
-- Os temas continuam existindo nas votações (`voting_topics`) e no painel,
-- como forma de ler — não de filtrar o que chega.
-- =============================================================================

-- A geração perde a regra 5 (tema). As outras quatro ficam como estavam; ver
-- 0004_gerar_notificacoes.sql para o porquê de cada uma.
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
  on conflict (dedup_key) do nothing;

  get diagnostics criadas = row_count;
  return criadas;
end;
$$;

revoke execute on function generate_notifications(interval) from public, anon, authenticated;

-- Sem quem a leia, a tabela só guardaria preferência política inferível à
-- toa (PRD §8.4).
drop table subscriber_topics;
