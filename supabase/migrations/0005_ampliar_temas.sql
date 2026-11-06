-- =============================================================================
-- Cinco categorias além da taxonomia inicial do PRD (§8.2 a chama de
-- "sugerida"). Sem elas, votações com tema oficial conhecido — Direito Civil,
-- Política e Eleições — chegavam ao filtro como se não tivessem tema e
-- passavam por qualquer escolha: quem pedia só "saúde" recebia 23 avisos, 14
-- deles sobre assuntos que a Câmara já tinha classificado como outra coisa.
--
-- O mapeamento dos temas oficiais para estas categorias fica no código
-- (src/lib/camara/topic-map.ts). Mantido em sincronia com src/lib/topics.ts.
-- =============================================================================
insert into topics (id, label, position) values
  ('justica',  'Justiça',                    9),
  ('politica', 'Política e eleições',       10),
  ('campo',    'Campo e agricultura',       11),
  ('governo',  'Governo e serviço público', 12),
  ('cidades',  'Cidades',                   13);
