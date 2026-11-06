-- =============================================================================
-- Envio das notificações: reserva e retentativa.
--
-- Dois riscos opostos, e o desenho trata os dois:
--
-- - mandar duas vezes: duas execuções do envio ao mesmo tempo pegariam as
--   mesmas pendentes. A reserva usa `for update skip locked`, então cada
--   linha vai para uma execução só;
-- - perder um aviso: se o processo cair depois de reservar e antes de marcar,
--   a linha ficaria presa. A reserva expira em 15 minutos e a linha volta para
--   a fila. O reenvio que isso causa é neutralizado pela chave de idempotência
--   mandada ao provedor (o id da linha), que descarta a repetição.
--
-- Falha de envio não é definitiva na primeira: a linha volta para a fila com
-- espera crescente, e só vira 'falhou' depois de cinco tentativas.
-- =============================================================================

alter table notifications
  add column claimed_at timestamptz,
  add column attempts smallint not null default 0;

/**
 * Reserva até `max_subscribers` assinantes com aviso vencido e devolve TODAS
 * as linhas vencidas de cada um. Por assinante, não por linha: o resumo junta
 * as votações numa mensagem só, e reservar metade delas mandaria a outra
 * metade num segundo e-mail minutos depois.
 */
create or replace function claim_due_notifications(max_subscribers integer default 50)
returns setof notifications
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return query
  with alvos as (
    select distinct n.subscriber_id
    from notifications n
    where n.state = 'pendente'
      and n.scheduled_for <= now()
      and (n.claimed_at is null or n.claimed_at < now() - interval '15 minutes')
    limit max_subscribers
  ),
  linhas as (
    select n.id
    from notifications n
    join alvos a on a.subscriber_id = n.subscriber_id
    where n.state = 'pendente'
      and n.scheduled_for <= now()
      and (n.claimed_at is null or n.claimed_at < now() - interval '15 minutes')
    for update of n skip locked
  )
  update notifications n
     set claimed_at = now()
    from linhas l
   where n.id = l.id
  returning n.*;
end;
$$;

revoke execute on function claim_due_notifications(integer) from public, anon, authenticated;
