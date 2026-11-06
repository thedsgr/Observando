"use client";

import { useMemo, useState } from "react";
import { TOPICS } from "@/lib/topics";
import { deputyCaption } from "@/lib/format";
import {
  EMPTY_PREFERENCES,
  FREQUENCY_LABEL,
  FREQUENCY_NOTE,
  MAX_LEGISLATORS,
  isValidEmail,
  type Frequency,
  type Preferences,
} from "@/lib/preferences";
import { savePreferences } from "@/lib/preferences-store";
import { searchDeputies } from "@/lib/view";
import type { Deputy, TopicId } from "@/lib/types";

/**
 * Onboarding em três passos: quem acompanhar, sobre o quê, e como ser avisado.
 *
 * O público do produto é quem tem pouco tempo e acha o processo legislativo
 * difícil (não quem já acompanha política). Por isso: uma decisão por tela,
 * linguagem sem jargão, e nenhum passo obrigatório além do primeiro e do
 * último. Quem não quiser escolher temas recebe tudo.
 */
/** Desfecho da inscrição, para a tela final dizer a verdade sobre o envio. */
type Outcome =
  | { status: "enviando" }
  | { status: "inscrito"; emailSent: boolean }
  | { status: "so-local"; reason: string };

export function Onboarding({ deputies }: { deputies: Deputy[] }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Preferences>(EMPTY_PREFERENCES);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const steps = ["Parlamentares", "Temas", "Avisos"];

  async function finish(email: string, frequency: Frequency) {
    const next: Preferences = {
      ...draft,
      channel: { kind: "email", address: email.trim().toLowerCase() },
      frequency,
      completedAt: new Date().toISOString(),
    };
    setDraft(next);
    setOutcome({ status: "enviando" });

    try {
      const response = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: next.channel?.address,
          frequency: next.frequency,
          legislators: next.legislators,
          topics: next.topics,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        emailSent?: boolean;
        message?: string;
      };

      if (response.ok && body.ok) {
        setOutcome({ status: "inscrito", emailSent: Boolean(body.emailSent) });
      } else {
        setOutcome({
          status: "so-local",
          reason: body.message ?? "O servidor não aceitou a inscrição.",
        });
      }
    } catch {
      setOutcome({
        status: "so-local",
        reason: "Não foi possível falar com o servidor.",
      });
    }
  }

  /** Guarda no navegador e entra no painel. */
  function enter() {
    savePreferences(draft);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header>
        <p className="font-serif text-lg text-text">Observa</p>
        <h1 className="mt-5 font-serif text-3xl leading-tight text-text sm:text-4xl">
          Você votou neles. Agora acompanhe o que eles votam.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
          Três perguntas rápidas e a gente avisa você, por e-mail, toda vez que
          os parlamentares que você escolher votarem alguma coisa.
        </p>
      </header>

      {/* Progresso */}
      <ol className="mt-8 flex items-center gap-2" aria-label="Progresso">
        {steps.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={[
                "h-1 flex-1 rounded-full transition-colors",
                index <= step ? "bg-accent" : "bg-surface-3",
              ].join(" ")}
            />
            <span
              className={[
                "shrink-0 text-xs",
                index === step ? "text-accent" : "text-text-dim",
              ].join(" ")}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex-1">
        {step === 0 && (
          <StepLegislators
            deputies={deputies}
            selected={draft.legislators.map((item) => item.externalId)}
            onToggle={(deputy) =>
              setDraft((current) => {
                const exists = current.legislators.some(
                  (item) => item.externalId === deputy.id,
                );
                if (exists) {
                  return {
                    ...current,
                    legislators: current.legislators.filter(
                      (item) => item.externalId !== deputy.id,
                    ),
                  };
                }
                if (current.legislators.length >= MAX_LEGISLATORS) return current;
                return {
                  ...current,
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
                };
              })
            }
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <StepTopics
            selected={draft.topics}
            onToggle={(topicId) =>
              setDraft((current) => ({
                ...current,
                topics: current.topics.includes(topicId)
                  ? current.topics.filter((item) => item !== topicId)
                  : [...current.topics, topicId],
              }))
            }
            onClear={() => setDraft((current) => ({ ...current, topics: [] }))}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && !outcome && (
          <StepChannel
            legislatorCount={draft.legislators.length}
            onBack={() => setStep(1)}
            onFinish={finish}
          />
        )}

        {outcome && (
          <StepDone
            outcome={outcome}
            email={draft.channel?.address ?? ""}
            onEnter={enter}
          />
        )}
      </div>
    </main>
  );
}

function StepDone({
  outcome,
  email,
  onEnter,
}: {
  outcome: Outcome;
  email: string;
  onEnter: () => void;
}) {
  if (outcome.status === "enviando") {
    return (
      <section aria-busy="true">
        <h2 className="text-xl text-text">Guardando suas escolhas…</h2>
      </section>
    );
  }

  const inscrito = outcome.status === "inscrito";

  return (
    <section>
      <h2 className="text-xl text-text">
        {inscrito ? "Tudo certo" : "Suas escolhas valem neste navegador"}
      </h2>

      {inscrito && outcome.emailSent && (
        <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
          Enviamos um link de confirmação para{" "}
          <span className="text-text">{email}</span>. Os avisos começam depois
          que você clicar nele — é esse clique que autoriza o envio.
        </p>
      )}

      {inscrito && !outcome.emailSent && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
            Sua inscrição foi gravada com <span className="text-text">{email}</span>.
          </p>
          <p className="mt-3 rounded-lg border border-dashed border-flag/50 px-4 py-3 text-[13px] leading-relaxed text-flag">
            O envio de e-mail ainda não está configurado neste ambiente, então
            nenhuma mensagem foi enviada e nenhuma será até isso mudar. Preferimos
            dizer isso a deixar você esperando um e-mail que não vem.
          </p>
        </>
      )}

      {!inscrito && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
            Você pode usar o painel normalmente, mas as escolhas ficam só neste
            navegador — some se você trocar de aparelho ou limpar os dados do
            site, e nenhum aviso será enviado.
          </p>
          <p className="mt-3 rounded-lg border border-dashed border-flag/50 px-4 py-3 text-[13px] leading-relaxed text-flag">
            {outcome.status === "so-local" && outcome.reason}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onEnter}
        className="mt-7 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
      >
        Ir para o meu painel
      </button>
    </section>
  );
}

function StepLegislators({
  deputies,
  selected,
  onToggle,
  onNext,
}: {
  deputies: Deputy[];
  selected: number[];
  onToggle: (deputy: Deputy) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchDeputies(deputies, query).slice(0, 40),
    [deputies, query],
  );
  const full = selected.length >= MAX_LEGISLATORS;

  return (
    <section>
      <h2 className="text-xl text-text">Quem você quer acompanhar?</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
        Busque pelo nome do deputado federal. Pode escolher até{" "}
        {MAX_LEGISLATORS}.
      </p>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Digite o nome, o partido ou o estado"
        className="mt-5 w-full rounded-full border border-border-strong bg-surface px-5 py-3 text-[15px] text-text outline-none placeholder:text-text-dim focus:border-accent"
      />

      {selected.length > 0 && (
        <p className="mt-4 text-[13px] text-text-dim">
          {selected.length} de {MAX_LEGISLATORS} escolhidos
          {full && " — limite atingido, remova alguém para trocar"}
        </p>
      )}

      <ul className="mt-4 max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
        {results.map((deputy) => {
          const picked = selected.includes(deputy.id);
          const disabled = full && !picked;
          return (
            <li key={deputy.id}>
              <button
                type="button"
                onClick={() => onToggle(deputy)}
                disabled={disabled}
                aria-pressed={picked}
                className={[
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  picked
                    ? "border-accent/50 bg-accent/10"
                    : "border-border-subtle bg-surface hover:border-border-strong",
                  disabled ? "cursor-not-allowed opacity-40" : "",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                    picked
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-border-strong text-transparent",
                  ].join(" ")}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-text">
                    {deputy.name}
                  </span>
                  <span className="block truncate font-mono text-xs text-text-dim">
                    {deputyCaption(deputy.party, deputy.uf)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {results.length === 0 && (
          <li className="py-10 text-center text-sm text-text-muted">
            Nenhum deputado encontrado para “{query}”.
          </li>
        )}
      </ul>

      <Footer
        onNext={onNext}
        nextLabel="Continuar"
        nextDisabled={selected.length === 0}
        hint={selected.length === 0 ? "Escolha pelo menos um parlamentar" : undefined}
      />
    </section>
  );
}

function StepTopics({
  selected,
  onToggle,
  onClear,
  onBack,
  onNext,
}: {
  selected: TopicId[];
  onToggle: (topicId: TopicId) => void;
  onClear: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const all = selected.length === 0;

  return (
    <section>
      <h2 className="text-xl text-text">Quais assuntos te interessam?</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
        Isso define o que entra nos seus avisos. Se não escolher nada, você
        recebe tudo — e dá para mudar depois.
      </p>

      <button
        type="button"
        onClick={onClear}
        aria-pressed={all}
        className={[
          "mt-5 w-full rounded-lg border px-4 py-3 text-left transition-colors",
          all
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border-subtle bg-surface text-text-muted hover:border-border-strong",
        ].join(" ")}
      >
        <span className="block text-[15px]">Quero receber tudo</span>
        <span className="mt-0.5 block text-[13px] text-text-dim">
          Todas as votações dos parlamentares que você escolheu
        </span>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {TOPICS.map((topic) => {
          const picked = selected.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onToggle(topic.id)}
              aria-pressed={picked}
              className={[
                "rounded-lg border px-4 py-3 text-left text-[15px] transition-colors",
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

      {/* O tema prioriza o aviso, mas não esconde histórico (PRD §8.2). */}
      <p className="mt-4 text-[13px] leading-relaxed text-text-dim">
        O tema filtra os avisos, não o site: no seu painel você continua vendo
        todas as votações dos seus parlamentares. Votações que a Câmara não
        classificou também aparecem — preferimos mostrar um voto a mais do que
        esconder um voto que existe.
      </p>

      <Footer onBack={onBack} onNext={onNext} nextLabel="Continuar" />
    </section>
  );
}

function StepChannel({
  legislatorCount,
  onBack,
  onFinish,
}: {
  legislatorCount: number;
  onBack: () => void;
  onFinish: (email: string, frequency: Frequency) => void | Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("semanal");
  const [touched, setTouched] = useState(false);

  const valid = isValidEmail(email);
  const showError = touched && email.length > 0 && !valid;

  return (
    <section>
      <h2 className="text-xl text-text">Como você quer ser avisado?</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
        Por enquanto o Observa avisa por e-mail. SMS e WhatsApp vêm depois.
      </p>

      <label className="mt-5 block">
        <span className="text-[13px] text-text-muted">Seu e-mail</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="voce@exemplo.com"
          aria-invalid={showError}
          className={[
            "mt-1.5 w-full rounded-full border bg-surface px-5 py-3 text-[15px] text-text outline-none placeholder:text-text-dim",
            showError ? "border-flag" : "border-border-strong focus:border-accent",
          ].join(" ")}
        />
        {showError && (
          <span className="mt-1.5 block text-[13px] text-flag">
            Esse e-mail não parece válido.
          </span>
        )}
      </label>

      <fieldset className="mt-6">
        <legend className="text-[13px] text-text-muted">Com que frequência</legend>
        <div className="mt-2 space-y-2">
          {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((option) => {
            const picked = frequency === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setFrequency(option)}
                aria-pressed={picked}
                className={[
                  "w-full rounded-lg border px-4 py-3 text-left transition-colors",
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
      </fieldset>

      {/* Expectativa realista: votação com voto nominal é rara (2% em 2026). */}
      <p className="mt-5 rounded-lg border border-border-subtle bg-surface-2/60 px-4 py-3 text-[13px] leading-relaxed text-text-muted">
        A Câmara só registra o voto de cada parlamentar em parte das votações —
        cerca de uma a cada cinquenta. Na prática, isso dá algo em torno de doze
        votações por mês para cada parlamentar que você acompanha.
      </p>

      <p className="mt-4 text-[12px] leading-relaxed text-text-dim">
        Ao continuar, você concorda em receber esses avisos no e-mail informado.
        Todo e-mail tem link para cancelar, e você pode mudar ou apagar suas
        escolhas a qualquer momento.
      </p>

      <Footer
        onBack={onBack}
        onNext={() => onFinish(email, frequency)}
        nextLabel={`Acompanhar ${legislatorCount} parlamentar${legislatorCount > 1 ? "es" : ""}`}
        nextDisabled={!valid}
        hint={!valid ? "Informe um e-mail para receber os avisos" : undefined}
      />
    </section>
  );
}

function Footer({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  hint,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-border-strong px-4 py-2 text-sm text-text-muted hover:border-border-strong hover:text-text"
        >
          Voltar
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
      </button>
      {hint && <span className="text-[13px] text-text-dim">{hint}</span>}
    </div>
  );
}
