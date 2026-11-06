# Observa — Proposta de produto e escopo do MVP

**Versão:** 0.1  
**Data:** 03/11/2026  
**Status:** Documento inicial de produto — hipóteses sujeitas a validação

## 1. Resumo executivo

**Observa** (nome provisório) é uma aplicação web de transparência cívica que permite ao cidadão escolher deputados federais e temas de interesse para acompanhar automaticamente como esses parlamentares votam. O produto traduz registros legislativos públicos em informações claras, contextualizadas e verificáveis, disponibilizadas em um dashboard e enviadas por e-mail.

**Proposta de valor:** *Você votou neles. Agora acompanhe o que eles votam.*

O objetivo não é avaliar se um deputado é “bom” ou “ruim”, mas facilitar o acesso a fatos, preservando o contexto e as fontes oficiais.

## 2. Problema e oportunidade

- Informações legislativas estão disponíveis, mas podem ser difíceis de encontrar, interpretar e acompanhar continuamente.
- O cidadão precisa buscar ativamente os registros de votação, conhecer a terminologia legislativa e relacionar diferentes fontes.
- Mesmo pessoas interessadas em política nem sempre conseguem acompanhar os mandatos após as eleições.

**Oportunidade:** inverter o fluxo de informação: em vez de o cidadão procurar cada votação, o sistema identifica novas publicações relevantes e avisa automaticamente.

## 3. Público-alvo

- Cidadãos que desejam acompanhar deputados federais que elegeram ou pelos quais se interessam.
- Pessoas interessadas em temas específicos (educação, saúde, economia etc.), mas que não dominam o processo legislativo.
- Usuários que preferem receber atualizações em vez de consultar diariamente portais públicos.

O produto deve funcionar para pessoas com diferentes níveis de familiaridade política e digital, sem exigir filiação partidária ou posicionamento ideológico.

## 4. Hipóteses a validar

1. As pessoas desejam acompanhar o comportamento parlamentar após as eleições.
2. Combinar **deputados selecionados + temas de interesse** aumenta a relevância percebida das informações.
3. Notificações automáticas aumentam a consulta e a compreensão das votações.
4. Resumos em linguagem simples, com fontes oficiais, ajudam na compreensão sem comprometer a precisão.
5. Um dashboard público demonstra valor antes do cadastro.

## 5. Princípios do produto

1. **Neutralidade:** informar registros e contexto sem recomendar posicionamentos políticos.
2. **Verificabilidade:** toda informação de votação deve apontar para a fonte oficial correspondente.
3. **Precisão legislativa:** distinguir voto individual, resultado da votação e situação da proposição.
4. **Simplicidade:** linguagem clara e explicações curtas, com aprofundamento opcional.
5. **Controle do usuário:** escolha de deputados, temas, frequência de e-mails e cancelamento simples.
6. **Transparência operacional:** informar periodicidade da atualização e limitações dos dados.

## 6. Escopo do MVP (v1)

### 6.1 Funcionalidades obrigatórias

| ID | Funcionalidade | Descrição | Critério mínimo de aceite |
|---|---|---|---|
| F01 | Dashboard público | Página inicial com votações recentes e explicação do serviço | Visitante consulta dados sem criar conta |
| F02 | Busca de deputados | Pesquisa de deputados federais por nome, com identificação por partido/UF quando disponível | Resultados provenientes da API oficial ou base sincronizada |
| F03 | Seleção de deputados | Usuário escolhe até 5 deputados para acompanhar (limite inicial a validar) | Seleções podem ser adicionadas e removidas |
| F04 | Seleção de temas | Usuário escolhe uma ou mais categorias de interesse | Preferências ficam associadas ao cadastro |
| F05 | Cadastro por e-mail | Captura e confirmação de e-mail sem senha tradicional | Somente endereços confirmados recebem notificações |
| F06 | Feed personalizado | Lista votações nominais dos deputados acompanhados, com filtros por tema | Usuário consegue consultar também votações fora dos temas favoritos |
| F07 | Detalhe da votação | Exibe objeto exato da votação, data, registro individual, contexto e fonte | Não confunde voto em emenda/destaque com voto no projeto inteiro |
| F08 | Coleta periódica | Busca novas votações e votos na API da Câmara | Dados sincronizados sem duplicar registros |
| F09 | Classificação temática | Relaciona proposições/votações às categorias do produto | Classificação incerta é sinalizada ou fica sem categoria até revisão |
| F10 | Resumo em linguagem simples | Explica o objeto votado em termos acessíveis | Resumo preserva sentido, inclui fonte e não apresenta inferências como fatos |
| F11 | Notificação por e-mail | Informa votações pertinentes aos deputados e temas selecionados | Evita duplicidade; agrupa deputados envolvidos na mesma votação |
| F12 | Gestão de preferências | Permite alterar deputados, temas e frequência de envio | Alterações são aplicadas aos próximos alertas |
| F13 | Descadastro | Permite parar de receber mensagens | Link de cancelamento funcional em todos os e-mails |
| F14 | Estados de interface | Loading, vazio, erro e última atualização | Falhas de dados são explicitadas, sem inventar votos |

### 6.2 Fora do escopo inicial

- Notificações via WhatsApp, SMS ou push.
- Aplicativo nativo iOS/Android.
- Monitoramento de senadores, vereadores, governadores ou outros cargos.
- Comparações avançadas entre parlamentares e rankings de desempenho.
- Monitoramento de despesas, discursos, presença e atividades não relacionadas às votações.
- Chatbot ou conversa bidirecional com o projeto.
- Avaliações automáticas de mérito ou alinhamento ideológico dos votos.
- Mapa eleitoral interativo semelhante ao da referência visual.

## 7. Experiência e jornadas

### 7.1 Jornada pública

1. Visitante abre a página inicial e vê um dashboard público com votações recentes.
2. Pesquisa um deputado ou explora uma votação.
3. Abre o detalhe e entende o que foi votado, quem votou e de onde vieram os dados.
4. É convidado a configurar acompanhamento personalizado.

### 7.2 Jornada de cadastro

1. Seleciona até cinco deputados federais.
2. Seleciona temas de interesse.
3. Informa e confirma o e-mail.
4. Escolhe a frequência de notificações (proposta: por atualização, resumo diário ou semanal; validar viabilidade).
5. Acessa o feed personalizado e pode editar preferências.

### 7.3 Jornada de notificação

1. Sistema detecta uma nova votação nominal disponibilizada pela Câmara.
2. Associa votos aos deputados e identifica o objeto votado.
3. Classifica o tema, verifica relevância para os assinantes e prepara o resumo.
4. Agrupa, por votação, os votos dos deputados que cada usuário acompanha.
5. Envia e-mail aos usuários confirmados e registra o envio.
6. O link leva ao detalhe na aplicação, com referência oficial.

**Exemplo fictício de e-mail:**

> **Nova votação sobre educação**  
> A Câmara registrou uma votação sobre critérios de financiamento da educação básica.  
> **Como votaram os deputados que você acompanha?**  
> Deputada Ana Ribeiro — Sim  
> Deputado Carlos Mendes — Não  
> **O que estava em votação?** Um resumo objetivo do item efetivamente submetido a voto.  
> **Entenda a votação e consulte a fonte oficial:** [link]

Os nomes, a proposta e os votos acima são ilustrativos.

## 8. Regras de negócio e integridade dos dados

### 8.1 Votações

- **Não presumir que toda votação é nominal.** Só atribuir voto individual quando houver registro oficial correspondente.
- Preservar o valor original do voto (por exemplo, Sim, Não, Abstenção, Obstrução e outros que a fonte oferecer).
- Não inferir que ausência de registro equivale a ausência do parlamentar ou a voto contrário.
- Diferenciar **voto do deputado**, **resultado da deliberação** e **situação do projeto**.
- Uma votação pode tratar de emenda, destaque, requerimento ou etapa procedimental; o texto deve identificar o objeto exato.
- Não simplificar automaticamente “Sim” para “a favor do projeto” ou “Não” para “contra o projeto”.
- Uma proposição pode ter diversas votações ao longo de sua tramitação.

### 8.2 Temas

- Taxonomia inicial sugerida: Saúde, Educação, Economia, Meio ambiente, Segurança pública, Direitos sociais, Transporte e Tecnologia.
- Uma votação pode receber múltiplos temas.
- Metadados oficiais e regras determinísticas devem ter prioridade quando suficientes; IA pode apoiar classificação e redação.
- Em caso de ambiguidade, não enviar uma classificação como se fosse certa.
- Os temas **priorizam notificações**, mas não ocultam o histórico de votações disponível do parlamentar.

### 8.3 Alertas

- Um usuário não deve receber múltiplos e-mails para a mesma votação apenas por acompanhar vários deputados nela envolvidos.
- Deduplicar por usuário, votação e tipo de notificação.
- Não reenviar eventos antigos como novos após reprocessamento ou falhas.
- Informar quando o dado foi publicado/sincronizado; evitar a promessa de “tempo real”.
- Frequência padrão, janelas de agrupamento e limites de volume ainda precisam ser definidos por teste.

### 8.4 Privacidade e consentimento

- Solicitar consentimento claro para comunicações e permitir cancelamento a qualquer momento.
- Coletar apenas os dados necessários ao funcionamento do serviço.
- Tratar preferências políticas inferíveis dos acompanhamentos com cuidado adicional, considerando a LGPD e revisão jurídica antes do lançamento público.
- Não compartilhar ou comercializar listas de usuários e preferências políticas.
- Proteger links de gestão de conta, credenciais e dados pessoais.

## 9. Direção de design

**Referência fornecida:** capturas de tela do dashboard Pandora (G4Valley), com layout escuro, dados densos, cards discretos e busca modal.

### 9.1 Linguagem visual

- Dark mode como padrão, com fundo quase preto e superfícies em cinzas escuros.
- Bordas finas, divisões discretas, hierarquia clara e boa densidade informacional.
- Tipografia sans-serif para interface e dados; uso pontual de serifada em títulos editoriais.
- Cores de estado sem vincular automaticamente vermelho/azul a partidos, ideologias ou mérito de votos.
- Busca central em modal, com navegação por teclado e resultados rápidos.
- Feed cronológico, filtros por tema e detalhes acessíveis em poucos cliques.
- Layout responsivo: dashboard modular no desktop e fluxo de uma coluna no celular.
- Acessibilidade: contraste, foco visível, suporte a teclado e estados não dependentes apenas de cor.

### 9.2 Páginas/telas

1. **Dashboard público:** votações recentes, filtros e explicação do serviço.
2. **Modal de busca de deputados:** nome, partido e UF, com seleção.
3. **Seleção de temas:** categorias e preferências.
4. **Confirmação de e-mail:** estado de envio e confirmação.
5. **Meu acompanhamento:** feed personalizado e deputados selecionados.
6. **Detalhe da votação:** objeto, registros de votos, contexto, data e links oficiais.
7. **Preferências:** deputados, temas, frequência e cancelamento.

**Nota:** o mapa eleitoral da referência não deve ser copiado; no Observa, o elemento central é a atividade parlamentar.

## 10. Arquitetura técnica sugerida

| Camada | Tecnologia candidata | Uso |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind CSS | Web responsiva, dashboard e páginas |
| Backend e banco | Supabase/PostgreSQL | Usuários, preferências, votações e notificações |
| Autenticação | Supabase Auth ou fluxo seguro por link | Confirmação de e-mail e gestão sem senha |
| Coleta | Jobs agendados / Edge Functions | Sincronização incremental com a Câmara |
| Classificação/resumo | Regras + serviço de IA, se necessário | Temas e textos claros, com revisão de qualidade |
| E-mail | Resend (ou equivalente) | Confirmação e alertas |
| Hospedagem | Vercel (ou equivalente) | Deploy e ambiente web |
| Analytics | PostHog (opcional no início) | Funil, engajamento e retenção |

**Fonte oficial:** [API de Dados Abertos da Câmara dos Deputados](https://dadosabertos.camara.leg.br/swagger/api.html).

Endpoints a validar na implementação: `/deputados`, `/votacoes`, `/votacoes/{id}/votos`, `/proposicoes/{id}` e endpoints complementares de tramitação/orientação quando necessários. A disponibilidade, os parâmetros, a atualização e os relacionamentos devem ser verificados na documentação atual.

### 10.1 Modelo inicial de dados

- `users`: identificador, e-mail, confirmação, consentimento e configurações.
- `deputies`: identificador oficial, nome, partido, UF e metadados sincronizados.
- `topics`: categorias de interesse.
- `user_deputies`: relação usuário–deputado.
- `user_topics`: relação usuário–tema.
- `propositions`: proposições e referências oficiais.
- `votings`: votações, data, descrição, objeto, resultado e origem.
- `votes`: registro individual de voto associado à votação e ao deputado.
- `voting_topics`: relação votação–tema, origem da classificação e confiança.
- `notifications`: destinatário, evento, estado, envio e chave de deduplicação.

As chaves oficiais devem ser preservadas. Dados brutos relevantes e horários de sincronização devem permitir auditoria e reprocessamento.

## 11. Métricas e validação

**Métrica principal sugerida:** proporção de usuários confirmados que consultam pelo menos um detalhe de votação após receber uma notificação em um período de 30 dias.

Métricas complementares:

- **Ativação:** porcentagem de visitantes que selecionam deputado(s), tema(s) e confirmam o e-mail.
- **Engajamento:** abertura de detalhes, cliques nos links de fonte oficial e retorno ao feed.
- **Retenção:** usuários que voltam a consultar o produto em 30 dias.
- **Notificações:** entregabilidade, cliques, cancelamentos e reclamações.
- **Qualidade:** precisão auditada dos votos, contexto e classificação temática.
- **Operação:** atraso entre disponibilização oficial e processamento; falhas e duplicidades.

**Pesquisa qualitativa:** pedir que participantes expliquem o objeto votado, o registro do deputado e a fonte a partir da notificação e do detalhe.

Não definir metas numéricas arbitrárias antes de obter uma linha de base no beta.

## 12. Critérios para lançamento beta

- [ ] Dashboard público utilizável em desktop e celular.
- [ ] Deputados e votações obtidos de fontes oficiais, com links verificáveis.
- [ ] Busca e seleção de deputados funcionando.
- [ ] Seleção de temas e preferências persistidas.
- [ ] Confirmação de e-mail e gestão segura da assinatura.
- [ ] Histórico com votos individuais corretos e distinção entre tipos de votação.
- [ ] Detalhes contextualizados e sem simplificações enganosas.
- [ ] Sincronização periódica monitorada e deduplicada.
- [ ] E-mails testados com consentimento, cancelamento e controle de frequência.
- [ ] Auditoria manual de amostra de votações e resumos antes de ativar notificações.
- [ ] Tratamento de erros, estados vazios e indicadores de atualização.
- [ ] Política de privacidade, segurança básica e revisão de conformidade aplicável.

## 13. Plano de implementação (estimativa inicial)

**Fase 1 — Fundação e frontend:** criar projeto, tokens visuais, dashboard público e modal de busca, inicialmente com dados de teste claramente identificados.

**Fase 2 — Dados oficiais:** sincronizar deputados, proposições, votações e votos; implementar feed e detalhes verificáveis.

**Fase 3 — Personalização:** confirmação de e-mail, seleção de deputados/temas, feed e preferências.

**Fase 4 — Inteligência e comunicação:** classificação temática, resumos auditáveis, templates e motor de e-mails com deduplicação.

**Fase 5 — Beta fechado:** testes de usabilidade, precisão, segurança, entrega e monitoramento.

A estimativa anterior de quatro semanas é apenas exploratória; deve ser revista após a validação da API e da complexidade de classificação.

## 14. Decisões pendentes

1. **Página inicial:** dashboard público é a recomendação atual, mas ainda não foi confirmado como decisão final.
2. **Frequência de e-mail:** imediato após sincronização, diário ou semanal; definir padrão e limites de volume.
3. **Taxonomia:** validar lista de temas e regras de classificação com dados reais.
4. **Resumos:** determinar quando usar IA, como revisar erros e como mostrar incerteza.
5. **Limite de deputados:** cinco é um ponto de partida, não uma restrição definitiva.
6. **Autenticação:** confirmar experiência de links seguros e expiração de sessões.
7. **Nome e marca:** Observa é provisório.
8. **Políticas e privacidade:** revisar obrigações aplicáveis antes de captar usuários reais.

## 15. Evolução futura (fora do MVP)

- WhatsApp como canal unidirecional de alertas, **somente após confirmação de elegibilidade pelas políticas da Meta**.
- SMS e notificações push.
- Descoberta de representantes por estado.
- Comparação entre deputados e histórico longitudinal.
- Acompanhamento de outros cargos e casas legislativas.
- Outros indicadores de atividade parlamentar, sempre com contexto e fontes.

---

**Resumo da entrega v1:** uma web app pública e responsiva, visualmente inspirada no Pandora, na qual o cidadão pode consultar votações oficiais, selecionar deputados e temas e receber e-mails com atualizações contextualizadas e verificáveis.
