-- =============================================================================
-- Inscrição nunca confirmada não fica guardada.
--
-- Quem digitou um endereço e não clicou no link nunca recebeu nada, mas o
-- endereço continuava no banco para sempre. Pela minimização da LGPD, dado
-- sem finalidade sai: 7 dias depois que o último link do assinante expirou,
-- a inscrição inteira é apagada (canais, escolhas e links vão em cascata).
--
-- "Nunca confirmada" é nenhum canal verificado. Quem confirmou e depois saiu
-- da lista (`opted_out_at`) fica: a linha é o que impede reenviar a quem saiu,
-- e apagá-la é o que o link de exclusão faz, a pedido do titular.
--
-- De carona, links usados ou expirados há mais de 30 dias também saem: não
-- servem para mais nada e cada um aponta para um assinante.
-- =============================================================================

create or replace function public.apagar_nao_confirmadas(
  grace interval default interval '7 days'
)
returns table (inscricoes integer, links integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscribers integer;
  v_tokens integer;
begin
  with stale as (
    select s.id
      from subscribers s
     where not exists (
             select 1 from subscriber_channels c
              where c.subscriber_id = s.id and c.verified_at is not null)
       -- Sem link nenhum (não deveria acontecer), conta a criação.
       and coalesce(
             (select max(t.expires_at) from magic_tokens t
               where t.subscriber_id = s.id),
             s.created_at
           ) < now() - grace
  )
  delete from subscribers s using stale where s.id = stale.id;
  get diagnostics v_subscribers = row_count;

  delete from magic_tokens
   where coalesce(used_at, expires_at) < now() - interval '30 days';
  get diagnostics v_tokens = row_count;

  return query select v_subscribers, v_tokens;
end;
$$;

revoke execute on function public.apagar_nao_confirmadas(interval) from public, anon, authenticated;

-- Todo dia às 6h UTC (3h em Brasília), longe dos horários de envio.
select cron.schedule(
  'observa-apagar-nao-confirmadas',
  '0 6 * * *',
  $$select * from public.apagar_nao_confirmadas()$$
);
