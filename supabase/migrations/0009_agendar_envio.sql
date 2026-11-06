-- Agenda o envio das notificações: a cada 5 minutos o banco chama a rota
-- /api/notificacoes/enviar do site publicado. O cron da Vercel no plano
-- gratuito roda no máximo uma vez por dia, e o aviso "a cada votação" não
-- pode esperar um dia.
--
-- O segredo que autoriza a chamada (CRON_SECRET, o mesmo da Vercel) fica no
-- Vault, cifrado. Ele entra por definir_segredo_envio, que só a chave de
-- serviço executa — nunca aparece em migração, em log ou no texto do job.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.definir_segredo_envio(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(length(trim(p_secret)), 0) < 16 then
    raise exception 'segredo vazio ou curto demais';
  end if;
  select id into v_id from vault.secrets where name = 'observa_cron_secret';
  if v_id is null then
    perform vault.create_secret(trim(p_secret), 'observa_cron_secret',
      'CRON_SECRET da Vercel, usado para chamar /api/notificacoes/enviar');
  else
    perform vault.update_secret(v_id, trim(p_secret));
  end if;
end;
$$;

revoke execute on function public.definir_segredo_envio(text) from public, anon, authenticated;
grant execute on function public.definir_segredo_envio(text) to service_role;

-- Dispara a chamada e volta na hora: pg_net envia em segundo plano, e quem
-- marca cada notificação como enviada ou falha é a própria rota.
create or replace function public.disparar_envio(p_site text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'observa_cron_secret';
  if v_secret is null then
    raise warning 'observa_cron_secret ausente no Vault; envio não disparado';
    return null;
  end if;
  return net.http_post(
    url := rtrim(p_site, '/') || '/api/notificacoes/enviar',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.disparar_envio(text) from public, anon, authenticated;

select cron.schedule(
  'observa-enviar',
  '*/5 * * * *',
  $$select public.disparar_envio('https://observa-topaz.vercel.app')$$
);
