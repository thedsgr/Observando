# Observando

Aplicação web de transparência cívica: o cidadão escolhe deputados federais e
temas de interesse e acompanha como esses parlamentares votam, com contexto e
fonte oficial. Ver `docs/prd.md` para a proposta de produto completa.

> **Fase 3 (atual).** Onboarding e acompanhamento personalizado. A pessoa
> escolhe parlamentares, temas e frequência, e a home passa a refletir essa
> configuração. O banco está de pé com os 513 deputados, a inscrição grava e
> confirma pelo link mágico, e o envio de e-mail está implementado; falta
> **a conta no provedor e um domínio verificado** para as mensagens saírem.
>
> Escopo do MVP: **Câmara dos Deputados e e-mail**. Senado, SMS e WhatsApp
> entram depois, e o modelo de dados já os prevê.

## Para rodar com banco

O projeto Supabase **Observando** já existe (organização `My Dashs`, região
`sa-east-1`) e as migrações de `supabase/migrations/` já foram aplicadas nele.

```bash
cp .env.example .env.local
```

Preencha `SUPABASE_SERVICE_ROLE_KEY` com a chave em
Supabase → Project Settings → API Keys → `service_role`. Ela ignora RLS e só
pode existir no servidor; `.env.local` é ignorado pelo git.

```bash
npm run sync:deputados
```

Votações, proposições, votos e temas do ano vão para o banco com:

```bash
npm run sync:votacoes            # ano corrente
npm run sync:votacoes -- 2025    # outro ano
npm run sync:votacoes -- --dry   # só relata, não grava
```

Reusa `src/lib/camara/bulk-source.ts` para a leitura e a classificação. O
painel lê do banco (`src/lib/db/feed.ts`), então a tela mostra exatamente o que
gerou os avisos: mesma classificação, mesmos temas, mesmos horários. A situação
da tramitação só existe na API REST, e a sincronização a busca só para as
proposições que aparecem no painel. É idempotente (só upsert) e
registra cada execução em `sync_runs`. Para antes de gravar se muitas votações
nominais aparecerem sem voto individual no arquivo: isso indica download
truncado, e gravar faria a interface dizer "sem registro" sobre voto real.

Ao final, a sincronização chama `generate_notifications()`, que cria em
`notifications` uma linha por (assinante, votação) que merece aviso. Não envia
nada — só deixa pendente, com `scheduled_for` conforme a frequência (imediato;
diário às 8h; semanal na segunda às 8h, horário de Brasília).

O envio é `/api/notificacoes/enviar`, chamado por agendador com
`Authorization: Bearer $CRON_SECRET` (a Vercel chama por GET e manda o
cabeçalho sozinha). Cada chamada reserva até 50 pessoas e manda uma mensagem
por pessoa com todas as votações vencidas dela. Sem provedor configurado, não
reserva nada: os avisos ficam pendentes em vez de virar "falhou".

Deputados que votaram mas não estão mais em exercício — suplentes, quem saiu
no meio da legislatura — entram em `legislators` com `in_office = false`.
Descartar os votos deles apagaria voto real.

Para as mensagens saírem, preencha também `RESEND_API_KEY`,
`OBSERVA_EMAIL_FROM` e `OBSERVA_SITE_URL`. Faltando qualquer uma, a inscrição
é gravada e a interface diz que nada foi enviado. O Resend só entrega para
endereços quaisquer depois que um domínio é verificado em Domains; antes disso
o único remetente aceito é `onboarding@resend.dev` e o único destinatário é o
e-mail da própria conta.

Sem isso a inscrição falha de propósito: `subscriber_legislators` referencia
`legislators`, e gravar metade faria a pessoa achar que acompanha alguém que o
sistema não conhece. O script aborta se ler menos de 400 parlamentares.

## Rodar

```bash
npm install
npm run dev
```

Não há variáveis de ambiente: a API da Câmara é pública e não exige chave.

## Estrutura

| Caminho | Papel |
|---|---|
| `src/app/page.tsx` | Server component que carrega o feed e os deputados |
| `src/app/api/` | Votos sob demanda e cruzamento deputado × votações |
| `src/lib/camara/bulk.ts` | Leitura dos arquivos anuais (espinha dorsal) |
| `src/lib/camara/` | Cliente REST, mapeamentos e derivações |
| `src/lib/types.ts` | Modelo de domínio; codifica as regras do PRD §8.1 |
| `src/lib/view.ts` | Funções puras de filtro, busca e cobertura |
| `src/components/onboarding/` | Fluxo de três passos da primeira visita |
| `src/components/` | Dashboard, faixa de destaque, feed, painéis, busca |
| `src/lib/preferences*.ts` | Acompanhamento configurado e onde ele é guardado |
| `supabase/migrations/` | Esquema do banco, ainda não aplicado |

## Por que duas fontes

A Câmara publica os mesmos dados de duas formas, e elas **não** têm os mesmos
campos. A escolha entre uma e outra foi medida, não suposta.

| | Arquivos anuais | API REST |
|---|---|---|
| Contagem de votos por votação | **sim** (`votosSim/Nao/Outros`) | não |
| Tipo estruturado do objeto | **sim** (`votacoesObjetos`) | não |
| Atualidade | fecha no dia anterior | dia corrente |
| Custo para saber se há voto individual | um campo | uma requisição de ~150 KB por votação |

Conferido em 05/11/2026 contra `votacoesVotos-2026.csv`: as **159** votações de
2026 com contagem > 0 são exatamente as 159 com voto individual, e as somas
batem em todos os casos, sem nenhuma divergência.

## O que as fontes realmente entregam

Estes pontos foram verificados contra dados reais e moldaram o modelo. Vale
reler antes de mexer na camada de dados.

- **Não existe campo para "votação nominal" em lugar nenhum.** O que existe é a
  contagem: soma > 0 significa que há voto individual publicado. Por isso o
  campo é `hasIndividualVotes`, um fato observável, e a interface nunca afirma
  que a votação foi simbólica.
- **Voto individual é exceção.** 159 de 7978 votações de 2026 — **2,0%**. O
  painel de cobertura mostra isso, e o feed tem um filtro de um clique para as
  votações que têm.
- **A maioria das votações recentes não tem voto individual publicado.** O feed
  as mostra mesmo assim, marcadas: omiti-las daria uma impressão falsa da
  atividade do plenário.
- **O tipo do objeto votado tem duas vias, nenhuma completa.**
  `votacoesObjetos` dá o tipo estruturado, mas só determina o objeto quando a
  votação tem **um** candidato: isso cobre 60% das votações e apenas **17% das
  nominais**, porque votações de plenário costumam ter vários. Quando é
  ambíguo, resta derivar da descrição oficial por regras explícitas em
  `src/lib/camara/object-kind.ts`. Ambas as vias declaram confiança, e o tipo
  fica `null` quando nada se aplica. A descrição oficial é exibida sempre, e a
  interface diz quantos objetos candidatos a fonte lista.
- **`Outros` na contagem é um agregado da fonte**, não um valor de voto: reúne
  abstenção, obstrução e artigo 17 sem separá-los. A quebra exata só existe nos
  votos individuais. A legenda marca isso.
- **Há 466 votos com o campo `voto` em branco** em 2026, todos numa única
  votação. O registro existe sem valor: não é "sem registro" e não vira um
  valor inventado.
- **`/votacoes/{id}/votos` não aceita paginação.** Uma votação nominal vem
  inteira (centenas de registros, ~150 KB). Por isso os votos só são buscados
  quando o usuário abre os detalhes.
- **Não dá para consultar votações por deputado.** O cruzamento é feito no
  servidor, votação a votação, sobre os votos já em cache.
- **A API REST limita taxa** (responde `retry-after: 30`) e cai: durante o
  desenvolvimento ficou horas devolvendo 504. Todo acesso passa por funções
  marcadas com `"use cache"`, e o feed continua de pé sem ela — só a situação
  da proposição e os temas ficam indisponíveis.
- **Cuidado com `"use cache"` aninhado.** Uma função cacheada não pode aguardar
  uma promessa criada por outra. Por isso `fetchRecentVotings` **não** é
  cacheada: ela só compõe `loadSnapshot` e `fetchPropositionExtras`, que são.
  Leituras de relógio ficam dentro do escopo cacheado.

## Classificação temática

Vem do cadastro oficial da proposição (`/proposicoes/{id}/temas`), nunca de IA.
A Câmara tem 32 temas e o Observando tem 13 categorias, mais "Outros"; o
mapeamento está em `src/lib/camara/topic-map.ts`, com confiança `alta` para
correspondência direta e `media` quando o tema oficial é mais amplo que a
categoria. Quando nenhum tema oficial da proposição corresponde a uma
categoria, ou ela não tem tema, a votação vai para "Outros" — não para a
categoria mais parecida.

## Regras de integridade codificadas

- `VoteLookup` distingue voto registrado, **sem registro** e ausência de votos
  individuais; ausência de registro nunca é tratada como falta ou voto contrário.
- `Voting.result` (resultado da deliberação), `Proposition.status` (situação da
  tramitação) e o voto do deputado são três campos distintos, exibidos
  separadamente.
- `Voting.objectDescription` guarda a descrição oficial literal, e a interface
  nunca traduz "Sim" como "a favor do projeto".
- `TopicAssignment` carrega origem e confiança; classificação incerta aparece
  como "a confirmar".
- Cores de voto nunca carregam a informação sozinhas: todo chip traz rótulo
  textual e marcador de forma. `Sim` é verde e `Não` é vermelho, seguindo o
  painel da Câmara — exceção consciente ao §9.1, por isso as salvaguardas acima
  são obrigatórias. Partido e ideologia não têm cor.

## Decisões de produto que estão no código

- **Sem conta e sem senha.** A identidade é um canal verificado (hoje só
  e-mail), com link mágico. Nunca existe tela de cadastro ou login.
- **Mudar a inscrição de um e-mail confirmado exige o link.** Sem senha, o que
  prova posse do endereço é o clique. Então um pedido para um endereço já
  verificado não grava nada: a mudança fica em `magic_tokens.payload` e só vale
  depois da confirmação. Sem isso, digitar o e-mail de outra pessoa reescreveria
  quem ela acompanha, e reativaria quem cancelou. `opted_out_at` só é limpo na
  confirmação, nunca no pedido.
- **A resposta da inscrição é igual para endereço novo e já assinante.** Dizer
  qual é o caso deixaria sondar quem usa o Observa. `delivery` descreve só o
  envio, nunca o assinante.
- **Os dois e-mails dizem o que acontece se a pessoa ignorar.** Qualquer um
  pode digitar o endereço de outra pessoa no onboarding, então quem recebe sem
  ter pedido precisa saber na primeira leitura que ignorar basta. O e-mail de
  mudança mostra o que mudaria, para a pessoa reconhecer — ou não — o pedido.
- **13 categorias, não 8.** As 8 do PRD mais Justiça, Política e eleições,
  Campo e agricultura, Governo e serviço público e Cidades. Sem elas, votações
  com tema oficial conhecido — Direito Civil, Política e Eleições — chegavam ao
  filtro como "sem tema" e passavam por qualquer escolha. Escolhidas pelo peso
  nas votações nominais. Homenagens fica de fora de propósito.
- **Nenhum tema marcado significa todos.** É o padrão de quem não quer
  escolher.
- **Votação sem categoria vai para "Outros".** Antes ela passava por qualquer
  filtro de tema, e quem escolhia só "Saúde" recebia também homenagens e
  projetos sem tema. Agora só chega a quem marcou "Outros" ou não filtrou
  tema. A única votação que ainda passa por qualquer filtro é a que a
  sincronização não classificou ainda: omitir um voto real por atraso nosso
  faria o usuário concluir que o parlamentar não votou.
- **Um pedido novo aposenta o link anterior.** Os links de confirmação e de
  mudança ainda não usados do mesmo endereço são apagados quando sai outro.
  Senão um link velho confirmaria escolhas que a mensagem dele não mostrava,
  ou aplicaria escolhas antigas por cima das novas.
- **Trocar de e-mail manda ao endereço antigo um link para encerrar.** Sem
  ele, o antigo continuaria recebendo. Mas encerrar direto deixaria qualquer
  um apagar a inscrição de outra pessoa digitando o endereço dela, então só o
  clique no link encerra. A mensagem não mostra o endereço novo.
- **Inscrição nunca confirmada some sozinha.** Um job diário
  (`apagar_nao_confirmadas`, migração 0010) apaga quem não tem canal
  verificado 7 dias depois que o último link expirou, e os links usados ou
  vencidos há mais de 30 dias. Quem confirmou e saiu da lista fica: a linha é
  o que impede reenviar.
- **Horário da fonte ganha fuso na entrada.** Os arquivos da Câmara trazem
  horário de Brasília sem dizer isso. `sourceTimeToIso` converte no momento da
  leitura, pelo fuso nomeado (o Brasil teve horário de verão até 2019). Sem
  isso, numa máquina em Brasília tudo parece certo por coincidência, e num
  servidor em UTC todo horário sai três horas adiantado.
- **Aviso só sobre o que é novidade para a pessoa.** Uma votação gera aviso
  se chegou ao banco (`first_seen_at`) depois que o canal foi confirmado, e se
  aconteceu nos últimos 14 dias. Sem a primeira regra, quem se inscreve hoje
  receberia o ano inteiro; sem a segunda, carregar um ano antigo apareceria
  como novidade para todo mundo. `first_seen_at` fica fora do upsert de
  propósito: reescrevê-lo faria tudo parecer novo.
- **Um aviso por votação, não por parlamentar.** Quem acompanha três deputados
  que votaram na mesma coisa recebe uma mensagem (PRD §8.3). `dedup_key` é
  único no banco, então reprocessar não reenvia.
- **Sem registro de voto, sem aviso.** "Seu deputado não tem registro" não é
  notícia, e o §8.1 proíbe tratar ausência como falta. Voto em branco gera
  aviso: o registro existe.
- **O e-mail diz o que foi votado de fato.** A maioria das votações é sobre
  urgência, emenda ou retirada de pauta, não sobre a lei. "Votou Sim no PL X"
  seria falso quando foi um requerimento, então cada votação traz o tipo do
  objeto com a explicação, a descrição oficial literal e o resultado separado
  do voto de cada um. O assunto não cita voto de ninguém: ali não cabe a
  ressalva, e sem ela ele engana.
- **Um resumo por pessoa, nunca partido nem repetido.** A reserva trava o
  assinante, não as linhas: duas execuções ao mesmo tempo não dividem o resumo
  de alguém em dois e-mails. Testado com seis chamadas simultâneas em oito
  rodadas. Uma queda entre enviar e registrar é coberta pela chave de
  idempotência mandada ao provedor.
- **Descadastro não acontece ao abrir o link.** Filtros de segurança de e-mail
  abrem todos os links de uma mensagem. O link do corpo leva a uma página com
  botão; o descadastro em um clique dos provedores (RFC 8058) chega por POST.
  Sair cancela também o que já estava na fila.
- **Preferências e exclusão passam pelo link, como a inscrição.** Sem login, o
  servidor não sabe quem está na tela de preferências: o e-mail ali é só o que
  ficou num navegador. Salvar vale na hora para o navegador e, no servidor,
  depois do clique no link (é o fluxo da inscrição). "Apagar meus dados" manda
  um link; clicando, a inscrição é apagada de verdade — e-mail, escolhas,
  links e histórico de avisos —, não só marcada como cancelada. Abrir o link
  não apaga; a resposta do pedido é igual haja ou não inscrição.
- **Voto com valor em branco é registro, não ausência.** A fonte tem 466 deles
  em 2026; comparações usam `!== undefined`, nunca truthiness.

## O que falta

1. **Domínio verificado no Resend.** Conta e chave estão configuradas, e a
   confirmação por e-mail foi testada de ponta a ponta. Mas com o remetente de
   teste (`onboarding@resend.dev`) só chega e-mail no endereço da própria conta
   Resend: para qualquer pessoa se inscrever, falta verificar um domínio e
   trocar `OBSERVA_EMAIL_FROM`.
2. **Publicação e agendamento estão no ar, mas só entregam para você.** O
   site está em https://observa-topaz.vercel.app (Vercel, ligado ao
   repositório Observando: cada push publica). A sincronização roda pelo
   GitHub Actions às 7h e às 19h; o envio, pelo `pg_cron` do Supabase a cada
   5 minutos (migração 0009), com o `CRON_SECRET` guardado no Vault por
   `npm run segredo:envio`. Se o endereço do site mudar, é preciso reagendar
   o job `observa-enviar` com a URL nova. Enquanto o item 1 não for feito,
   tudo isso funciona, mas só chega e-mail para a conta do Resend.
