-- =============================================================================
-- O painel passa a ler do banco, não dos arquivos da Câmara.
--
-- As votações, os votos e os temas já têm leitura pública. Faltava o que o
-- painel mostra no rodapé: até quando vai a fonte e quando ela foi lida. Isso
-- mora em `sync_runs`, que não é pública — o texto de erro de uma execução
-- é diagnóstico interno, não informação para o visitante. Esta função expõe
-- só os quatro números que o painel usa.
-- =============================================================================

create or replace function public.estado_do_painel()
returns table (
  synced_at       timestamptz,
  coverage_end    timestamptz,
  year_total      integer,
  year_with_votes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with ultima as (
    select r.finished_at, r.coverage_end
      from sync_runs r
     where r.house_id = 'camara'
       and r.finished_at is not null
       and r.coverage_end is not null
     order by r.finished_at desc
     limit 1
  ),
  -- O ano de referência é o da cobertura, no fuso de Brasília: em 1º de
  -- janeiro, antes de o arquivo novo sair, o painel continua no ano anterior.
  ano as (
    select make_timestamptz(
             extract(year from u.coverage_end at time zone 'America/Sao_Paulo')::int,
             1, 1, 0, 0, 0, 'America/Sao_Paulo') as inicio
      from ultima u
  )
  select u.finished_at,
         u.coverage_end,
         (select count(*)::int from votings v, ano
           where v.house_id = 'camara' and v.occurred_at >= ano.inicio
             and v.occurred_at < ano.inicio + interval '1 year'),
         (select count(*)::int from votings v, ano
           where v.house_id = 'camara' and v.has_individual_votes
             and v.occurred_at >= ano.inicio
             and v.occurred_at < ano.inicio + interval '1 year')
    from ultima u;
$$;

revoke execute on function public.estado_do_painel() from public;
grant execute on function public.estado_do_painel() to anon, authenticated, service_role;
