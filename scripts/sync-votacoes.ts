#!/usr/bin/env node
/**
 * Sincroniza as votações de um ano dos arquivos anuais da Câmara para o banco.
 *
 * Por que existe: sem as votações gravadas não há como gerar notificação com
 * `dedup_key` (PRD §8.3) — não se consegue dizer "já avisei sobre esta
 * votação" sobre algo que não está persistido. Ao final, gera as notificações
 * das votações que acabaram de chegar.
 *
 * Reusa `src/lib/camara/bulk-source.ts` em vez de reimplementar a leitura e a
 * classificação. Se o script tivesse a sua própria, haveria duas respostas
 * possíveis para "que tipo de objeto foi votado" e a do banco divergiria da
 * que a pessoa vê na tela.
 *
 *   npm run sync:votacoes            # ano corrente
 *   npm run sync:votacoes -- 2025    # outro ano
 *   npm run sync:votacoes -- --dry   # só relata, não grava
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchCsv,
  hasIndividualVotes,
  objectKindOf,
  readYear,
  resultOf,
  sourceTimeToIso,
  type BulkVoting,
} from "@/lib/camara/bulk-source";
import { propositionSourceUrl, votingSourceUrl } from "@/lib/camara/client";
import { mapThemes } from "@/lib/camara/topic-map";
import type { RawTheme } from "@/lib/camara/raw";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Sem arquivo: assume que as variáveis já estão no ambiente.
  }
}

loadEnv(".env.local");

const HOUSE = "camara";
const CHUNK = 500;
const VOTE_CHUNK = 1000;

/**
 * Acima disto, votação nominal sem voto no arquivo deixa de ser defasagem e
 * passa a ser download truncado. Gravar nesse caso marcaria votações como
 * tendo voto individual sem ter nenhum, e a interface diria "sem registro"
 * para todos os parlamentares — uma afirmação falsa sobre voto real.
 */
const MAX_MISSING_VOTES_RATIO = 0.1;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const year = Number(args.find((arg) => /^\d{4}$/.test(arg)) ?? new Date().getFullYear());

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

async function upsertAll(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  size = CHUNK,
) {
  let done = 0;
  for (const chunk of chunks(rows, size)) {
    const { error } = await db.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    done += chunk.length;
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}   `);
  }
  if (rows.length > 0) process.stdout.write("\n");
}

/** Mapa external_id -> uuid, lido de volta depois de gravar. */
async function idMap(
  db: SupabaseClient,
  table: string,
  externalIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const chunk of chunks(externalIds, CHUNK)) {
    const { data, error } = await db
      .from(table)
      .select("id, external_id")
      .eq("house_id", HOUSE)
      .in("external_id", chunk);
    if (error) throw new Error(`${table} (releitura): ${error.message}`);
    for (const row of data ?? []) map.set(row.external_id as string, row.id as string);
  }
  return map;
}

/**
 * Temas oficiais por proposição, dos arquivos anuais.
 *
 * Um arquivo por ano DA PROPOSIÇÃO, não da votação: as votações de um ano
 * decidem proposições de muitos anos, então é preciso um arquivo por ano
 * presente. Ano sem arquivo publicado é relatado, não silenciado — as votações
 * daquelas proposições ficam sem tema, que é diferente de ficarem escondidas.
 */
async function readThemes(years: number[]): Promise<Map<number, RawTheme[]>> {
  const byProposition = new Map<number, RawTheme[]>();
  for (const ano of years) {
    let rows: Array<Record<string, string>>;
    try {
      rows = await fetchCsv(`proposicoesTemas/csv/proposicoesTemas-${ano}.csv`);
    } catch (error) {
      console.warn(
        `  temas de ${ano}: indisponível (${error instanceof Error ? error.message : "erro"})`,
      );
      continue;
    }
    for (const row of rows) {
      const id = Number(row.uriProposicao?.replace(/\/+$/, "").split("/").pop());
      const codTema = Number(row.codTema);
      if (!Number.isFinite(id) || !Number.isFinite(codTema)) continue;
      const list = byProposition.get(id) ?? [];
      list.push({ codTema, tema: row.tema ?? "", relevancia: Number(row.relevancia) || 0 });
      byProposition.set(id, list);
    }
    process.stdout.write(`\r  temas: ${ano} lido   `);
  }
  process.stdout.write("\n");
  return byProposition;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Pegue a chave de serviço em: Supabase → Project Settings → API Keys → service_role\n" +
        "e coloque em .env.local (o arquivo é ignorado pelo git).",
    );
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Lendo arquivos de ${year}…${dryRun ? " (simulação)" : ""}`);
  const read = await readYear(year);
  if (read.votings.length === 0) {
    console.error(`Nenhuma votação em ${year}. Nada a fazer.`);
    process.exit(1);
  }

  const votosRows = await fetchCsv(`votacoesVotos/csv/votacoesVotos-${year}.csv`);
  console.log(
    `  ${read.yearTotal} votações, ${read.yearWithVotes} com voto individual, ` +
      `${votosRows.length} votos; cobertura até ${read.coverageEnd}`,
  );

  // Invariante da fonte, conferida a cada execução em vez de assumida: toda
  // votação cuja contagem é > 0 tem voto individual no arquivo, e não há voto
  // individual de votação fora dessa lista.
  const nominais = read.votings.filter(hasIndividualVotes);
  const comVotos = new Set(votosRows.map((row) => row.idVotacao));
  const semVotos = nominais.filter((row) => !comVotos.has(row.id));
  const idsConhecidos = new Set(read.votings.map((row) => row.id));
  const votosOrfaos = [...comVotos].filter((id) => !idsConhecidos.has(id));

  if (semVotos.length > 0) {
    console.warn(
      `  ${semVotos.length} de ${nominais.length} votações nominais sem voto no arquivo`,
    );
  }
  if (votosOrfaos.length > 0) {
    console.warn(`  ${votosOrfaos.length} votações com voto mas fora de votacoes-${year}`);
  }
  if (semVotos.length / Math.max(nominais.length, 1) > MAX_MISSING_VOTES_RATIO) {
    console.error(
      "Parando: proporção alta de votações nominais sem voto individual sugere\n" +
        "arquivo truncado. Gravar marcaria votações como tendo voto sem ter nenhum.",
    );
    process.exit(1);
  }

  // Votações sem data de registro não podem ser gravadas: `occurred_at` é
  // obrigatório e inventar a data falsificaria quando o voto aconteceu.
  const semData = read.votings.filter((row) => !row.dateTime);
  const graváveis = read.votings.filter((row) => Boolean(row.dateTime));
  if (semData.length > 0) {
    console.warn(`  ${semData.length} votações sem dataHoraRegistro: não serão gravadas`);
  }

  // --- proposições ---------------------------------------------------------
  const propositions = new Map<number, BulkVoting["propositions"][number]>();
  for (const voting of graváveis) {
    for (const proposition of voting.propositions) {
      if (!propositions.has(proposition.id)) propositions.set(proposition.id, proposition);
    }
  }
  console.log(`  ${propositions.size} proposições distintas referenciadas`);

  if (dryRun) {
    const anos = [...new Set([...propositions.values()].map((p) => yearOfLabel(p)))];
    console.log(
      `Simulação: gravaria ${propositions.size} proposições, ${graváveis.length} votações, ` +
        `${votosRows.length} votos; temas de ${anos.length} anos.`,
    );
    return;
  }

  const run = await db
    .from("sync_runs")
    .insert({ house_id: HOUSE, source: "arquivos-anuais" })
    .select("id")
    .single();
  if (run.error) throw new Error(`sync_runs: ${run.error.message}`);
  const runId = run.data.id as string;

  try {
    await upsertAll(
      db,
      "propositions",
      [...propositions.values()].map((proposition) => ({
        house_id: HOUSE,
        external_id: String(proposition.id),
        label: proposition.label,
        // A ementa é a única descrição que a fonte dá; nunca é reescrita.
        title: proposition.ementa.replace(/^[“"]|[”"]$/g, "") || "Ementa não informada",
        // `status` é tramitação e só existe na API REST. Fica nulo em vez de
        // receber palpite: a interface declara "não informada".
        source_url: propositionSourceUrl(proposition.id),
        synced_at: new Date().toISOString(),
      })),
      "house_id,external_id",
    );

    const propositionIds = await idMap(
      db,
      "propositions",
      [...propositions.keys()].map(String),
    );

    // --- votações ----------------------------------------------------------
    await upsertAll(
      db,
      "votings",
      graváveis.map((voting) => {
        const first = voting.propositions[0] ?? null;
        const kind = objectKindOf(voting);
        return {
          house_id: HOUSE,
          external_id: voting.id,
          proposition_id: first ? propositionIds.get(String(first.id)) ?? null : null,
          occurred_at: voting.dateTime,
          object_description: voting.descricao,
          object_kind: kind?.kind ?? null,
          object_confidence: kind?.confidence ?? null,
          object_basis: kind?.basis ?? null,
          object_candidates: voting.objects.length,
          result: resultOf(voting.aprovacao),
          votes_yes: voting.votosSim,
          votes_no: voting.votosNao,
          votes_other: voting.votosOutros,
          source_url: votingSourceUrl(voting.id),
          synced_at: new Date().toISOString(),
        };
      }),
      "house_id,external_id",
    );

    const votingIds = await idMap(db, "votings", graváveis.map((row) => row.id));

    // --- parlamentares que faltam -----------------------------------------
    // 567 deputados aparecem nos votos de 2026, mas só 513 estão em exercício:
    // suplentes e quem saiu no meio da legislatura votaram e continuam no
    // registro. Descartar esses votos apagaria voto real (PRD §8.1), então os
    // parlamentares entram aqui, marcados como fora de exercício.
    const existentes = await idMap(
      db,
      "legislators",
      [...new Set(votosRows.map((row) => row.deputado_id))],
    );
    const faltantes = new Map<string, Record<string, unknown>>();
    for (const row of votosRows) {
      const id = row.deputado_id;
      if (!id || existentes.has(id) || faltantes.has(id)) continue;
      faltantes.set(id, {
        house_id: HOUSE,
        external_id: id,
        name: row.deputado_nome ?? `Deputado ${id}`,
        party: row.deputado_siglaPartido || null,
        uf: row.deputado_siglaUf || null,
        photo_url: row.deputado_urlFoto || null,
        in_office: false,
      });
    }
    if (faltantes.size > 0) {
      console.log(`  ${faltantes.size} parlamentares fora de exercício a registrar`);
      await upsertAll(
        db,
        "legislators",
        [...faltantes.values()],
        "house_id,external_id",
      );
      for (const [external, id] of await idMap(db, "legislators", [...faltantes.keys()])) {
        existentes.set(external, id);
      }
    }

    // --- votos individuais -------------------------------------------------
    const votes: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let orfaos = 0;
    for (const row of votosRows) {
      const votingId = votingIds.get(row.idVotacao);
      const legislatorId = existentes.get(row.deputado_id);
      if (!votingId || !legislatorId) {
        orfaos += 1;
        continue;
      }
      // A chave primária é (voting_id, legislator_id): duplicata no arquivo
      // quebraria o upsert do lote inteiro.
      const chave = `${votingId}:${legislatorId}`;
      if (seen.has(chave)) continue;
      seen.add(chave);
      votes.push({
        voting_id: votingId,
        legislator_id: legislatorId,
        // Em 2026 há 466 votos com `voto` em branco. O registro existe, mas
        // sem valor: não é "sem registro" e não pode virar valor inventado.
        value: (row.voto ?? "").trim(),
        recorded_at: sourceTimeToIso(row.dataHoraVoto),
      });
    }
    if (orfaos > 0) console.warn(`  ${orfaos} votos sem votação ou parlamentar conhecido`);
    await upsertAll(db, "votes", votes, "voting_id,legislator_id", VOTE_CHUNK);

    // --- temas -------------------------------------------------------------
    const anos = [
      ...new Set([...propositions.values()].map(yearOfLabel)),
    ]
      .filter((ano) => Number.isFinite(ano))
      .sort((a, b) => b - a);
    console.log(`  temas: ${anos.length} anos de proposição a ler`);
    const themes = await readThemes(anos);

    const votingTopics: Record<string, unknown>[] = [];
    for (const voting of graváveis) {
      const first = voting.propositions[0];
      const votingId = votingIds.get(voting.id);
      if (!first || !votingId) continue;
      for (const topic of mapThemes(themes.get(first.id) ?? [])) {
        votingTopics.push({
          voting_id: votingId,
          topic_id: topic.topicId,
          origin: topic.origin,
          confidence: topic.confidence,
          official_theme: topic.officialTheme ?? null,
        });
      }
    }
    await upsertAll(db, "voting_topics", votingTopics, "voting_id,topic_id");

    // --- notificações -------------------------------------------------------
    // Depois de tudo gravado, e não antes: a regra de tema precisa dos
    // vínculos de tema, e a de registro precisa dos votos. A função ignora o
    // que já foi gerado, então rodar a sincronização de novo não reenvia nada.
    // `first_seen_at` fica de fora do upsert de votações de propósito — é ele
    // que diz o que é novidade, e reescrevê-lo faria tudo parecer novo.
    const { data: criadas, error: notificationError } = await db.rpc(
      "generate_notifications",
    );
    if (notificationError) {
      throw new Error(`notificações: ${notificationError.message}`);
    }
    console.log(`  ${criadas ?? 0} notificações novas`);

    await db
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        coverage_end: read.coverageEnd || null,
        votings_seen: graváveis.length,
        error:
          semVotos.length > 0
            ? `${semVotos.length} votações nominais sem voto individual no arquivo`
            : null,
      })
      .eq("id", runId);

    console.log(
      `Pronto. ${graváveis.length} votações, ${propositions.size} proposições, ` +
        `${votes.length} votos, ${votingTopics.length} vínculos de tema.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), error: message })
      .eq("id", runId);
    throw error;
  }
}

/** Ano da proposição, extraído do rótulo ("PL 4674/2024"). */
function yearOfLabel(proposition: { label: string }): number {
  const match = /\/(\d{4})\b/.exec(proposition.label);
  return match ? Number(match[1]) : Number.NaN;
}

main().catch((error) => {
  console.error(`\nFalhou: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
