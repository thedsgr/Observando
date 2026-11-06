#!/usr/bin/env node
/**
 * Sincroniza os deputados em exercício da Câmara para a tabela `legislators`.
 *
 * É pré-requisito da inscrição: `subscriber_legislators` tem chave estrangeira
 * para `legislators`, então sem isto ninguém consegue acompanhar ninguém.
 *
 * Roda com a chave de serviço porque `legislators` tem RLS e só política de
 * leitura — escrita passa apenas pelo servidor.
 *
 *   node scripts/sync-deputados.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
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

const BASE = "https://dadosabertos.camara.leg.br/api/v2";

/** A API cai com alguma frequência; sem repetição a sincronização fica parcial. */
async function getJson(path, attempt = 1) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    if (attempt < 4) {
      const wait = attempt * 10_000;
      console.warn(`  ${path} → ${response.status}; nova tentativa em ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      return getJson(path, attempt + 1);
    }
    throw new Error(`${path} respondeu ${response.status} após ${attempt} tentativas`);
  }
  return (await response.json()).dados;
}

async function main() {
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log("Lendo deputados em exercício…");
  const byId = new Map();
  for (let page = 1; page <= 8; page += 1) {
    const rows = await getJson(
      `/deputados?ordem=ASC&ordenarPor=nome&itens=100&pagina=${page}`,
    );
    if (!rows || rows.length === 0) break;
    for (const row of rows) byId.set(row.id, row);
    console.log(`  página ${page}: ${rows.length} (acumulado ${byId.size})`);
  }

  if (byId.size < 400) {
    // A legislatura tem 513. Bem menos que isso indica leitura incompleta, e
    // gravar parcial faria deputados reais sumirem da busca.
    throw new Error(
      `Só ${byId.size} deputados lidos; esperado perto de 513. Abortando para não gravar base parcial.`,
    );
  }

  const records = [...byId.values()].map((row) => ({
    house_id: "camara",
    external_id: String(row.id),
    name: row.nome,
    party: row.siglaPartido ?? null,
    uf: row.siglaUf ?? null,
    photo_url: row.urlFoto ?? null,
    in_office: true,
    synced_at: new Date().toISOString(),
  }));

  console.log(`Gravando ${records.length} parlamentares…`);
  for (let index = 0; index < records.length; index += 200) {
    const chunk = records.slice(index, index + 200);
    const { error } = await db
      .from("legislators")
      .upsert(chunk, { onConflict: "house_id,external_id" });
    if (error) throw new Error(`Falha ao gravar: ${error.message}`);
    console.log(`  ${Math.min(index + chunk.length, records.length)}/${records.length}`);
  }

  const { count } = await db
    .from("legislators")
    .select("*", { count: "exact", head: true })
    .eq("house_id", "camara");

  console.log(`Pronto. ${count} parlamentares na base.`);
}

main().catch((error) => {
  console.error(`\nErro: ${error.message}`);
  process.exit(1);
});
