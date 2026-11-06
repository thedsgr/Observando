-- =============================================================================
-- Exclusão de dados a pedido do titular (LGPD), com link por e-mail.
--
-- Sem conta e sem senha, o servidor não sabe quem está do outro lado: o
-- e-mail na tela de preferências é só o que ficou guardado num navegador.
-- Excluir direto por endereço deixaria qualquer um apagar a inscrição de
-- outra pessoa. Então a exclusão segue a regra do resto do produto: o clique
-- no link enviado ao endereço é a prova de que o pedido é do dono.
--
-- O link de exclusão não confirma canal nem aplica mudança: `confirmToken`
-- só aceita 'verify' e 'apply', e a exclusão tem rota própria.
-- =============================================================================
alter table magic_tokens drop constraint magic_tokens_purpose_check;
alter table magic_tokens
  add constraint magic_tokens_purpose_check
  check (purpose in ('verify', 'apply', 'delete'));
