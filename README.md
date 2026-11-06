# Observa

Aplicação web de transparência cívica: o cidadão escolhe deputados federais e
temas de interesse e acompanha como esses parlamentares votam, com contexto e
fonte oficial. Ver `docs/prd.md` para a proposta de produto completa.

> **Fase 3 (atual).** Onboarding e acompanhamento personalizado. A pessoa
> escolhe parlamentares, temas e frequência, e a home passa a refletir essa
> configuração. O banco existe e as migrações foram aplicadas; falta **a chave
> de serviço no ambiente** para a inscrição sair do navegador, e um provedor
> de e-mail para as mensagens saírem.
>
> Escopo do MVP: **Câmara dos Deputados e e-mail**. Senado, SMS e WhatsApp
> entram depois, e o modelo de dados já os prevê.

## Para rodar com banco

O projeto Supabase **Observa** já existe (organização `My Dashs`, região
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

Sem isso a inscrição falha de propósito: `subscriber_legislators` referencia
`legislators`, e gravar metade faria a pessoa achar que acompanha alguém que o
sistema não conhece.

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
A Câmara tem 32 temas e o Observa tem 8 categorias; o mapeamento está em
`src/lib/camara/topic-map.ts`, com confiança `alta` para correspondência direta
e `media` quando o tema oficial é mais amplo que a categoria. Temas oficiais
fora da tabela não geram categoria: a votação fica sem tema até revisão.

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
- **Nenhum tema marcado significa todos.** É o padrão de quem não quer
  escolher.
- **Votação sem tema atribuído nunca é escondida por filtro de tema.** Omitir
  um voto real do parlamentar porque a nossa classificação falhou faria o
  usuário concluir que ele não votou. Entre mostrar algo fora do tema e
  esconder um voto que existe, mostramos.
- **Voto com valor em branco é registro, não ausência.** A fonte tem 466 deles
  em 2026; comparações usam `!== undefined`, nunca truthiness.

## O que falta

1. **`SUPABASE_SERVICE_ROLE_KEY` no ambiente** e `npm run sync:deputados`.
   Enquanto não houver, a inscrição responde 503 e a interface diz que as
   escolhas só valem naquele navegador — em vez de fingir que gravou.
2. **Envio de e-mail** (Resend ou equivalente). O link mágico já é gerado e
   guardado como hash; falta a mensagem. Em desenvolvimento o link aparece no
   log do servidor, nunca na resposta ao cliente.
3. **Sincronizar votações para o banco**, com `dedup_key` nas notificações
   para não reenviar evento antigo como novo (PRD §8.3). Hoje as votações são
   lidas dos arquivos a cada revalidação, sem passar pelo banco.
