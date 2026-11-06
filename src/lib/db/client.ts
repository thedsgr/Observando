import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientes do banco.
 *
 * Há dois, e a diferença importa:
 *
 * - `publicDb` usa a chave publicável e só enxerga o que tem política de
 *   leitura: dado legislativo. É seguro em qualquer contexto.
 * - `serviceDb` usa a chave de serviço e ignora RLS. As tabelas de assinante
 *   têm RLS ligado **sem política alguma**, então ela é a única forma de
 *   lê-las ou escrevê-las — e por isso nunca pode sair do servidor.
 *
 * `server-only` no topo faz o build falhar se este módulo for importado por
 * um componente de cliente, em vez de vazar a chave no bundle.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** O banco está configurado para leitura pública? */
export function hasPublicDb(): boolean {
  return Boolean(url && publishableKey);
}

/**
 * O banco aceita escrita? Falso enquanto a chave de serviço não estiver no
 * ambiente — e nesse caso a inscrição não pode ser gravada, o que a interface
 * precisa dizer em vez de fingir que deu certo.
 */
export function hasServiceDb(): boolean {
  return Boolean(url && serviceKey);
}

let publicClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

export function publicDb(): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error(
      "Banco não configurado: faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  publicClient ??= createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  return publicClient;
}

export function serviceDb(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      "Escrita no banco não configurada: falta SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    );
  }
  serviceClient ??= createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return serviceClient;
}
