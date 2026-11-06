"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOPICS } from "@/lib/topics";
import { deputyCaption } from "@/lib/format";
import {
  FREQUENCY_LABEL,
  FREQUENCY_NOTE,
  MAX_LEGISLATORS,
  isValidEmail,
  type Frequency,
  type Preferences,
} from "@/lib/preferences";
import { clearPreferences, savePreferences } from "@/lib/preferences-store";
import { usePreferences } from "@/hooks/use-preferences";
import { searchDeputies } from "@/lib/view";
import type { Deputy, TopicId } from "@/lib/types";

/**
 * Edição do acompanhamento: parlamentares, temas, e-mail, frequência e saída.
 *
 * O PRD §5.5 e §8.4 pedem que mudar e cancelar sejam simples. Por isso tudo
 * fica numa tela só, a exclusão é explícita e não está escondida, e nenhuma
 * alteração exige senha — não existe senha.
 *
 * Mas também não existe login, então o servidor não sabe quem está aqui: o
 * e-mail nesta tela é só o que ficou guardado neste navegador. Salvar e
 * apagar valem na hora para o navegador, e no servidor só depois do clique no
 * link enviado ao endereço. Agir direto pelo endereço deixaria qualquer um
 * mudar ou apagar a inscrição de outra pessoa.
 */

type Delivery = "enviado" | "sem-provedor" | "falhou";

type SaveStatus =
  | { kind: "enviando" }
  | { kind: "pedido"; delivery: Delivery; email: string; previous: string | null }
  | { kind: "erro"; message: string };

type DeletionStatus =
  | { kind: "enviando" }
  | { kind: "pedido"; email: string }
  | { kind: "so-local" }
  | { kind: "erro"; message: string };

export function PreferencesEditor({ deputies }: { deputies: Deputy[] }) {
  const router = useRouter();
  const { preferences, hydrated } = usePreferences();
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [query, setQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [deletion, setDeletion] = useState<DeletionStatus | null>(null);

  // O rascunho nasce do que está guardado, na primeira renderização hidratada.
  const current = draft ?? preferences;

  if (!hydrated) return null;

  // Depois de pedir a exclusão o navegador já foi limpo, então esta tela não
  // tem mais o que editar: mostra só o desfecho.
  if (deletion?.kind === "pedido" || deletion?.kind === "so-local") {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-serif text-2xl text-text">
          {deletion.kind === "pedido" ? "Confira seu e-mail" : "Pronto"}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
          {deletion.kind === "pedido" ? (
            <>
              Apagamos suas escolhas deste navegador. Se houver uma inscrição com{" "}
              <span className="text-text">{deletion.email}</span>, enviamos para ele um
              link: os dados no servidor só são apagados quando você clicar nele.
            </>
          ) : (
            "Apagamos suas escolhas deste navegador. Não havia e-mail cadastrado, então não havia nada no servidor."
          )}
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
        >
          Ir para o início
        </button>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-serif text-2xl text-text">Nada configurado ainda</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
          Você ainda não escolheu parlamentares para acompanhar.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
        >
          Configurar agora
        </Link>
      </main>
    );
  }

  function update(changes: Partial<Preferences>) {
    setDraft({ ...(current as Preferences), ...changes });
    setSaveStatus(null);
  }

  const results = query ? searchDeputies(deputies, query).slice(0, 8) : [];
  const full = current.legislators.length >= MAX_LEGISLATORS;
  const emailValid = current.channel ? isValidEmail(current.channel.address) : false;

  /** Grava no navegador e pede ao servidor, pelo mesmo caminho da inscrição. */
  async function save() {
    const next = current as Preferences;
    // O endereço guardado antes desta edição. Se mudou, o servidor manda ao
    // antigo um link para encerrar a inscrição dele.
    const before = preferences?.channel?.address?.trim().toLowerCase() ?? "";
    const email = next.channel?.address ?? "";
    const previous =
      isValidEmail(before) && before !== email.trim().toLowerCase() ? before : null;
    savePreferences(next);
    setSaveStatus({ kind: "enviando" });
    try {
      const response = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          ...(previous ? { previousEmail: previous } : {}),
          frequency: next.frequency,
          legislators: next.legislators,
          topics: next.topics,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        delivery?: Delivery;
        message?: string;
      };
      setSaveStatus(
        response.ok && body.ok
          ? { kind: "pedido", delivery: body.delivery ?? "sem-provedor", email, previous }
          : { kind: "erro", message: body.message ?? "O servidor não aceitou o pedido." },
      );
    } catch {
      setSaveStatus({ kind: "erro", message: "Não foi possível falar com o servidor." });
    }
  }

  /**
   * Pede a exclusão. O navegador só é limpo depois que o link sai: se o envio
   * falhar e o navegador já estiver limpo, o e-mail some desta tela e a pessoa
   * fica sem ter como pedir de novo.
   */
  async function erase() {
    const email = current?.channel?.address ?? "";
    if (!isValidEmail(email)) {
      clearPreferences();
      setDeletion({ kind: "so-local" });
      return;
    }
    setDeletion({ kind: "enviando" });
    try {
      const response = await fetch("/api/apagar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        delivery?: Delivery;
        message?: string;
      };
      if (response.ok && body.ok && body.delivery === "enviado") {
        clearPreferences();
        setDeletion({ kind: "pedido", email });
      } else {
        setDeletion({
          kind: "erro",
          message:
            response.status === 429 && body.message
              ? `${body.message} Nada foi apagado.`
              : body.delivery === "sem-provedor"
              ? "O envio de e-mail não está configurado, então o link para apagar os dados do servidor não pôde ser enviado. Nada foi apagado."
              : "O e-mail com o link não saiu. Nada foi apagado; tente de novo em alguns minutos.",
        });
      }
    } catch {
      setDeletion({ kind: "erro", message: "Não foi possível falar com o servidor. Nada foi apagado." });
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/" className="text-sm text-accent hover:text-accent-hover">
        ← Voltar ao painel
      </Link>
      <h1 className="mt-4 font-serif text-3xl leading-tight text-text">
        Suas preferências
      </h1>

      {/* Parlamentares */}
      <section className="mt-9">
        <h2 className="text-[17px] text-text">Parlamentares que você acompanha</h2>
        <ul className="mt-3 space-y-2">
          {current.legislators.map((legislator) => (
            <li
              key={legislator.externalId}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-text">
                  {legislator.name}
                </span>
                <span className="block font-mono text-xs text-text-dim">
                  {deputyCaption(legislator.party, legislator.uf)}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  update({
                    legislators: current.legislators.filter(
                      (item) => item.externalId !== legislator.externalId,
                    ),
                  })
                }
                className="shrink-0 text-xs text-accent hover:text-accent-hover"
              >
                remover
              </button>
            </li>
          ))}
          {current.legislators.length === 0 && (
            <li className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
              Nenhum parlamentar. Sem pelo menos um, não há o que acompanhar.
            </li>
          )}
        </ul>

        {!full && (
          <>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Adicionar outro parlamentar"
              className="mt-3 w-full rounded-full border border-border-strong bg-surface px-5 py-2.5 text-[15px] text-text outline-none placeholder:text-text-dim focus:border-accent"
            />
            {results.length > 0 && (
              <ul className="mt-2 space-y-1">
                {results
                  .filter(
                    (deputy) =>
                      !current.legislators.some(
                        (item) => item.externalId === deputy.id,
                      ),
                  )
                  .map((deputy) => (
                    <li key={deputy.id}>
                      <button
                        type="button"
                        onClick={() => {
                          update({
                            legislators: [
                              ...current.legislators,
                              {
                                house: "camara",
                                externalId: deputy.id,
                                name: deputy.name,
                                party: deputy.party,
                                uf: deputy.uf,
                              },
                            ],
                          });
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[15px] text-text-muted">
                          {deputy.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-text-dim">
                          {deputyCaption(deputy.party, deputy.uf)}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
        {full && (
          <p className="mt-3 text-[13px] text-text-dim">
            Limite de {MAX_LEGISLATORS} atingido. Remova alguém para trocar.
          </p>
        )}
      </section>

      {/* Temas */}
      <section className="mt-9">
        <h2 className="text-[17px] text-text">Temas dos seus avisos</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">
          Sem nenhum tema marcado, você recebe tudo. O tema filtra os avisos,
          não o painel.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TOPICS.map((topic) => {
            const picked = current.topics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() =>
                  update({
                    topics: picked
                      ? current.topics.filter((item) => item !== topic.id)
                      : [...current.topics, topic.id as TopicId],
                  })
                }
                aria-pressed={picked}
                className={[
                  "rounded-lg border px-4 py-2.5 text-left text-[15px] transition-colors",
                  picked
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border-subtle bg-surface text-text hover:border-border-strong",
                ].join(" ")}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Canal */}
      <section className="mt-9">
        <h2 className="text-[17px] text-text">Como você recebe</h2>
        <label className="mt-3 block">
          <span className="text-[13px] text-text-muted">E-mail</span>
          <input
            type="email"
            value={current.channel?.address ?? ""}
            onChange={(event) =>
              update({ channel: { kind: "email", address: event.target.value } })
            }
            className={[
              "mt-1.5 w-full rounded-full border bg-surface px-5 py-2.5 text-[15px] text-text outline-none",
              emailValid ? "border-border-strong focus:border-accent" : "border-flag",
            ].join(" ")}
          />
        </label>
        <p className="mt-2 text-[13px] text-text-dim">
          SMS e WhatsApp ainda não estão disponíveis.
        </p>

        <div className="mt-4 space-y-2">
          {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((option) => {
            const picked = current.frequency === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => update({ frequency: option })}
                aria-pressed={picked}
                className={[
                  "w-full rounded-lg border px-4 py-2.5 text-left transition-colors",
                  picked
                    ? "border-accent/50 bg-accent/10"
                    : "border-border-subtle bg-surface hover:border-border-strong",
                ].join(" ")}
              >
                <span
                  className={[
                    "block text-[15px]",
                    picked ? "text-accent" : "text-text",
                  ].join(" ")}
                >
                  {FREQUENCY_LABEL[option]}
                </span>
                <span className="mt-0.5 block text-[13px] text-text-dim">
                  {FREQUENCY_NOTE[option]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
        <button
          type="button"
          onClick={save}
          disabled={current.legislators.length === 0 || !emailValid}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveStatus?.kind === "enviando" ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={erase}
          disabled={deletion?.kind === "enviando"}
          className="ml-auto text-sm text-text-dim underline decoration-border-strong underline-offset-4 hover:text-flag disabled:opacity-40"
        >
          {deletion?.kind === "enviando" ? "Enviando link…" : "Apagar meus dados"}
        </button>
      </div>

      {saveStatus && saveStatus.kind !== "enviando" && (
        <p
          className={[
            "mt-4 text-[13px] leading-relaxed",
            saveStatus.kind === "pedido" && saveStatus.delivery === "enviado"
              ? "text-status"
              : "text-flag",
          ].join(" ")}
        >
          {saveStatus.kind === "erro"
            ? `Salvo neste navegador, mas o servidor não aceitou: ${saveStatus.message}`
            : saveStatus.delivery === "enviado"
              ? `Salvo neste navegador. Para valer nos avisos, confirme pelo link que enviamos para ${saveStatus.email}. Até lá, nada muda nos avisos.${
                  saveStatus.previous
                    ? ` Se ${saveStatus.previous} recebia avisos, mandamos para ele um link para parar: sem o clique nele, os dois endereços recebem.`
                    : ""
                }`
              : saveStatus.delivery === "sem-provedor"
                ? "Salvo neste navegador. O envio de e-mail não está configurado, então a mudança ainda não chega aos avisos."
                : "Salvo neste navegador, mas o e-mail de confirmação não saiu. Tente salvar de novo em alguns minutos."}
        </p>
      )}
      {deletion?.kind === "erro" && (
        <p className="mt-4 text-[13px] leading-relaxed text-flag">{deletion.message}</p>
      )}
    </main>
  );
}
