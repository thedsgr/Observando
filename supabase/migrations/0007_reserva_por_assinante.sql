-- =============================================================================
-- A reserva passa a travar o ASSINANTE, não as linhas.
--
-- A versão de 0006 escolhia assinantes sem travá-los e depois travava as
-- linhas com `skip locked`. Em teste, duas chamadas simultâneas escolheram o
-- mesmo assinante, e o `skip locked` deu a cada uma metade das linhas dele:
-- nada foi enviado duas vezes, mas o resumo saiu partido em dois e-mails —
-- justamente o que a reserva por assinante prometia evitar.
--
-- Agora a unidade da trava é a linha do assinante em `subscribers`. Quem
-- pega o assinante pega todas as notificações vencidas dele; a outra chamada
-- pula o assinante inteiro. Se começar depois do commit, já encontra
-- `claimed_at` preenchido e também não o pega.
-- =============================================================================
create or replace function claim_due_notifications(max_subscribers integer default 50)
returns setof notifications
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return query
  with alvos as (
    select s.id
    from subscribers s
    where exists (
      select 1 from notifications n
      where n.subscriber_id = s.id
        and n.state = 'pendente'
        and n.scheduled_for <= now()
        and (n.claimed_at is null or n.claimed_at < now() - interval '15 minutes')
    )
    limit max_subscribers
    for update of s skip locked
  )
  update notifications n
     set claimed_at = now()
    from alvos a
   where n.subscriber_id = a.id
     and n.state = 'pendente'
     and n.scheduled_for <= now()
     and (n.claimed_at is null or n.claimed_at < now() - interval '15 minutes')
  returning n.*;
end;
$$;

revoke execute on function claim_due_notifications(integer) from public, anon, authenticated;
