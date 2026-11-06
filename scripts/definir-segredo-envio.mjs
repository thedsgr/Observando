#!/usr/bin/env node
/**
 * Guarda o CRON_SECRET do .env.local no Vault do Supabase, de onde o job
 * observa-enviar (migração 0009) o lê para chamar /api/notificacoes/enviar.
 * Precisa ser o mesmo valor configurado na Vercel. Nada é impresso.
 *
 *   npm run segredo:envio
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { error } = await db.rpc("definir_segredo_envio", { p_secret: env.CRON_SECRET ?? "" });
if (error) {
  console.error("Não foi possível guardar o segredo:", error.message);
  process.exit(1);
}
console.log("Segredo do envio guardado no Vault.");
