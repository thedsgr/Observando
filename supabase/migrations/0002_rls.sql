-- =============================================================================
-- Observa — políticas de acesso
--
-- Princípio: dado legislativo é público e pode ser lido por qualquer um. Dado
-- de assinante NÃO pode ser lido por ninguém através da API pública.
--
-- A lista de quem acompanha quem revela preferência política inferível, que o
-- PRD §8.4 manda tratar com cuidado adicional sob a LGPD. Por isso nenhuma
-- tabela de assinante recebe política de leitura para os papéis `anon` e
-- `authenticated`: o acesso acontece apenas no servidor, com a chave de
-- serviço, depois de validar um link mágico.
-- =============================================================================

-- Dado legislativo: leitura pública, escrita só pela sincronização.
alter table houses          enable row level security;
alter table topics          enable row level security;
alter table legislators     enable row level security;
alter table propositions    enable row level security;
alter table votings         enable row level security;
alter table votes           enable row level security;
alter table voting_topics   enable row level security;
alter table sync_runs       enable row level security;

create policy "leitura publica" on houses        for select to anon, authenticated using (true);
create policy "leitura publica" on topics        for select to anon, authenticated using (true);
create policy "leitura publica" on legislators   for select to anon, authenticated using (true);
create policy "leitura publica" on propositions  for select to anon, authenticated using (true);
create policy "leitura publica" on votings       for select to anon, authenticated using (true);
create policy "leitura publica" on votes         for select to anon, authenticated using (true);
create policy "leitura publica" on voting_topics for select to anon, authenticated using (true);

-- `sync_runs` fica sem política: expõe cadência interna e mensagens de erro.

-- Dado de assinante: RLS ligado e NENHUMA política criada.
-- Com RLS ativo e sem política, `anon` e `authenticated` não leem nem escrevem
-- nada. Só a chave de serviço, usada no servidor, passa.
alter table subscribers             enable row level security;
alter table subscriber_channels     enable row level security;
alter table subscriber_legislators  enable row level security;
alter table subscriber_topics       enable row level security;
alter table subscriber_settings     enable row level security;
alter table magic_tokens            enable row level security;
alter table notifications           enable row level security;
