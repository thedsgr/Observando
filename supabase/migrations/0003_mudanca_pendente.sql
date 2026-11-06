-- =============================================================================
-- Mudança de preferências exige prova de posse do endereço.
--
-- O problema que isto corrige: a inscrição gravava as preferências na hora,
-- mesmo quando o e-mail já estava verificado. Como canal verificado não pede
-- confirmação, qualquer pessoa que digitasse o endereço de outra no onboarding
-- reescrevia silenciosamente quem ela acompanha — e, pior, reabria a
-- assinatura de quem havia cancelado, voltando a mandar e-mail para quem saiu.
--
-- A partir daqui, para um canal JÁ VERIFICADO nada é gravado no momento do
-- pedido: a mudança desejada fica em `payload`, e só é aplicada quando o link
-- mágico é usado. O clique continua sendo o que autoriza, exatamente como no
-- primeiro cadastro (PRD §8.4).
-- =============================================================================

-- Preferências pendentes, aguardando confirmação. Nulo quando o token só
-- confirma o canal (primeiro cadastro), porque aí não há estado de ninguém
-- para proteger e as preferências já foram gravadas.
alter table magic_tokens add column payload jsonb;

-- `purpose` era texto livre. Os dois valores em uso passam a ser explícitos,
-- para um valor digitado errado falhar na escrita em vez de virar um token que
-- nunca confirma nada.
alter table magic_tokens
  add constraint magic_tokens_purpose_check
  check (purpose in ('verify', 'apply'));

-- Um token de 'apply' sem payload não teria o que aplicar, e um de 'verify'
-- com payload sugere confusão entre os dois caminhos.
alter table magic_tokens
  add constraint magic_tokens_payload_check
  check ((purpose = 'apply') = (payload is not null));
