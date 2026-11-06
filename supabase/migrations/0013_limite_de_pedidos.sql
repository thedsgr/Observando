-- =============================================================================
-- Limite de pedidos nas rotas públicas que mandam e-mail.
--
-- /api/inscricao e /api/apagar mandam uma mensagem para o endereço digitado.
-- Sem limite, um script enche a caixa de qualquer pessoa, gasta a cota do
-- provedor e queima a reputação do domínio — e aí os avisos de verdade passam
-- a cair no spam.
--
-- O contador fica no banco porque a aplicação roda em funções serverless:
-- memória de processo não é compartilhada entre instâncias e some a cada
-- partida a frio.
--
-- `bucket` é um hash ("email:..." ou "ip:..."), nunca o endereço em claro, e
-- as linhas somem em um dia. Não é anonimização forte — um e-mail conhecido
-- dá para testar contra o hash —, por isso a tabela também não tem política
-- de leitura e só a chave de serviço a alcança.
-- =============================================================================

create table rate_limit_hits (
  bucket text not null,
  hit_at timestamptz not null default now()
);

create index rate_limit_hits_bucket_hit_at on rate_limit_hits (bucket, hit_at);

alter table rate_limit_hits enable row level security;

-- Registra um pedido em todos os baldes, ou em nenhum.
--
-- Devolve `false` se algum balde já atingiu o limite na sua janela; nesse
-- caso nada é gravado, para que pedidos recusados não prolonguem o bloqueio
-- de quem só está esperando a janela passar.
--
-- O lock por balde (em ordem, para não haver impasse entre dois pedidos com
-- os mesmos baldes) impede que pedidos simultâneos contem o mesmo espaço
-- livre e passem juntos do limite.
create or replace function public.registrar_pedido(
  p_buckets text[],
  p_limits integer[],
  p_windows interval[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select t.bucket, t.max_hits, t.win
      from unnest(p_buckets, p_limits, p_windows) as t(bucket, max_hits, win)
     order by t.bucket
  loop
    perform pg_advisory_xact_lock(hashtextextended('limite:' || r.bucket, 0));
    if (select count(*) from rate_limit_hits
         where bucket = r.bucket and hit_at > now() - r.win) >= r.max_hits then
      return false;
    end if;
  end loop;

  insert into rate_limit_hits (bucket)
  select distinct b from unnest(p_buckets) as b;
  return true;
end;
$$;

revoke execute on function public.registrar_pedido(text[], integer[], interval[])
  from public, anon, authenticated;
grant execute on function public.registrar_pedido(text[], integer[], interval[])
  to service_role;

-- A maior janela em uso é de um dia; nada mais velho que isso conta.
select cron.schedule(
  'observa-limpar-limite-de-pedidos',
  '17 * * * *',
  $$delete from public.rate_limit_hits where hit_at < now() - interval '1 day'$$
);
