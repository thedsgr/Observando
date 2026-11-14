"use client";

import { useMemo, useState } from "react";
import { deputyCaption } from "@/lib/format";
import {
  EMPTY_PREFERENCES,
  FREQUENCY_LABEL,
  FREQUENCY_NOTE,
  MAX_LEGISLATORS,
  isValidEmail,
  type FollowedLegislator,
  type Frequency,
  type Preferences,
} from "@/lib/preferences";
import { savePreferences } from "@/lib/preferences-store";
import { searchDeputies } from "@/lib/view";
import type { Deputy } from "@/lib/types";
import { Logo } from "@/components/ui/logo";

/**
 * Onboarding em dois passos: quem acompanhar e como ser avisado.
 *
 * O público do produto é quem tem pouco tempo e acha o processo legislativo
 * difícil (não quem já acompanha política). Por isso: uma decisão por tela e
 * linguagem sem jargão.
 *
 * Não há escolha de temas. Acompanhar um parlamentar é acompanhar tudo o que
 * ele vota, inclusive o que a pessoa não iria procurar — filtrar por tema
 * esconderia justamente esses votos, e a classificação é imperfeita o
 * bastante para esconder outros por engano. Os temas ficam no painel, como
 * forma de ler, não de filtrar o que chega.
 */
/**
 * Desfecho da inscrição, para a tela final dizer a verdade sobre o envio.
 *
 * `delivery` separa dois casos que a tela não pode confundir: ambiente sem
 * provedor configurado é uma pendência de quem instalou, e falha no envio é um
 * problema passageiro que vale tentar de novo. Dizer "não está configurado"
 * quando o provedor existe e só recusou seria mentira útil para ninguém.
 */
type Delivery = "enviado" | "sem-provedor" | "falhou";

type Outcome =
  | { status: "enviando" }
  | { status: "inscrito"; delivery: Delivery }
  | { status: "so-local"; reason: string };

export function Onboarding({ deputies }: { deputies: Deputy[] }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Preferences>(EMPTY_PREFERENCES);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const steps = ["Parlamentares", "Avisos"];

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
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        delivery?: Delivery;
        message?: string;
      };

      if (response.ok && body.ok) {
        setOutcome({
          status: "inscrito",
          delivery: body.delivery ?? "sem-provedor",
        });
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

  const done = outcome !== null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header>
        <p>
          <Logo />
        </p>
        <h1 className="mt-6 font-serif text-3xl leading-tight text-text sm:text-4xl">
          Você votou neles. Agora acompanhe o que eles votam.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
          Duas perguntas rápidas e a gente avisa você, por e-mail, toda vez que
          os parlamentares que você escolher votarem alguma coisa.
        </p>
      </header>

      {/* Progresso: o passo atual em texto, e uma barra por passo */}
      <div className="mt-10">
        <p className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-text">{done ? "Pronto" : steps[step]}</span>
          <span className="font-mono text-xs text-text-dim">
            {done ? steps.length : step + 1} de {steps.length}
          </span>
        </p>
        <ol className="mt-2.5 grid grid-cols-2 gap-1.5" aria-label="Progresso">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={!done && index === step ? "step" : undefined}
              className={[
                "h-1 rounded-full transition-colors",
                done || index <= step ? "bg-accent" : "bg-surface-3",
              ].join(" ")}
            >
              <span className="sr-only">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10 flex-1">
        {step === 0 && (
          <StepLegislators
            deputies={deputies}
            selected={draft.legislators}
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

        {step === 1 && !outcome && (
          <StepChannel
            legislatorCount={draft.legislators.length}
            onBack={() => setStep(0)}
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

/*
 * Linguagem visual do onboarding, para as telas não divergirem entre si:
 * - raio: caixa grande `rounded-panel`, campo e opção `rounded-lg`, ação e
 *   chip `rounded-full` — o mesmo que o painel usa;
 * - seleção: só a borda, o fundo e o indicador mudam; o texto não muda de
 *   cor. Indicador quadrado para escolha múltipla, redondo para escolha única;
 * - tipo: 20 para a pergunta, 15 para o corpo, 13 para o apoio.
 */

const PRIMARY_BUTTON =
  "rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-dim";

const OPTION_BASE =
  "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors";

function optionState(picked: boolean): string {
  return picked
    ? "border-accent/50 bg-accent/10"
    : "border-border-subtle bg-surface hover:border-border-strong";
}

function StepHeading({ title, lede }: { title: string; lede: React.ReactNode }) {
  return (
    <>
      <h2 className="text-xl font-medium leading-snug text-text">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-text-muted">{lede}</p>
    </>
  );
}

/** Marca de seleção. Quadrada para múltipla escolha, redonda para única. */
function Indicator({ picked, shape }: { picked: boolean; shape: "check" | "radio" }) {
  return (
    <span
      aria-hidden
      className={[
        "mt-0.5 flex size-[18px] shrink-0 items-center justify-center border transition-colors",
        shape === "check" ? "rounded-md" : "rounded-full",
        picked ? "border-accent bg-accent" : "border-border-strong bg-transparent",
      ].join(" ")}
    >
      {picked &&
        (shape === "check" ? (
          <svg viewBox="0 0 12 12" className="size-3 text-accent-contrast" fill="none">
            <path
              d="M2.5 6.2 5 8.5l4.5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="size-1.5 rounded-full bg-accent-contrast" />
        ))}
    </span>
  );
}

/** Aviso que não é erro: expectativa, consentimento, estado do envio. */
function Note({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "flag";
}) {
  return (
    <p
      className={[
        "rounded-lg border px-4 py-3 text-[13px] leading-relaxed",
        tone === "flag"
          ? "border-dashed border-flag/50 text-flag"
          : "border-border-subtle bg-surface text-text-muted",
      ].join(" ")}
    >
      {children}
    </p>
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
        <StepHeading
          title="Guardando suas escolhas…"
          lede="Isso leva só um instante."
        />
      </section>
    );
  }

  // A cópia daqui serve a três casos — endereço novo, endereço pendente e
  // endereço já confirmado — porque a API não diz qual foi. Dizer revelaria
  // quem usa o Observando a quem digitasse um e-mail alheio.
  const inscrito = outcome.status === "inscrito";
  const delivery = outcome.status === "inscrito" ? outcome.delivery : null;

  return (
    <section>
      {delivery === "enviado" && (
        <StepHeading
          title="Confirme no seu e-mail"
          lede={
            <>
              Enviamos um link de confirmação para{" "}
              <span className="text-text">{email}</span>. Suas escolhas passam a
              valer quando você clicar nele — é o clique que autoriza, não este
              botão.
            </>
          }
        />
      )}

      {inscrito && delivery !== "enviado" && (
        <>
          <StepHeading
            title="Pedido registrado"
            lede={
              <>
                Registramos seu pedido para <span className="text-text">{email}</span>.
              </>
            }
          />
          <div className="mt-5">
            <Note tone="flag">
              {delivery === "sem-provedor"
                ? `O envio de e-mail ainda não está configurado neste ambiente, então
                   nenhuma mensagem foi enviada e nenhuma será até isso mudar.
                   Preferimos dizer isso a deixar você esperando um e-mail que não vem.`
                : `O e-mail de confirmação não saiu: o envio falhou. Seu pedido está
                   guardado, então tente de novo em alguns minutos. Nada é enviado
                   enquanto você não confirmar.`}
            </Note>
          </div>
        </>
      )}

      {!inscrito && (
        <>
          <StepHeading
            title="Suas escolhas valem neste navegador"
            lede="Você pode usar o painel normalmente, mas as escolhas ficam só neste navegador — somem se você trocar de aparelho ou limpar os dados do site, e nenhum aviso será enviado."
          />
          <div className="mt-5">
            <Note tone="flag">{outcome.status === "so-local" && outcome.reason}</Note>
          </div>
        </>
      )}

      <Footer onNext={onEnter} nextLabel="Ir para o meu painel" />
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
  selected: FollowedLegislator[];
  onToggle: (deputy: Deputy) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchDeputies(deputies, query).slice(0, 40),
    [deputies, query],
  );
  const selectedIds = selected.map((item) => item.externalId);
  const full = selected.length >= MAX_LEGISLATORS;

  return (
    <section>
      <StepHeading
        title="Quem você quer acompanhar?"
        lede={`Busque pelo nome do deputado federal. Pode escolher até ${MAX_LEGISLATORS}.`}
      />

      {/* Escolhidos ficam à vista mesmo quando a busca os tira da lista */}
      {selected.length > 0 && (
        <div className="mt-6">
          <p className="flex items-baseline justify-between gap-3 text-[13px] text-text-muted">
            <span>Escolhidos</span>
            <span className="font-mono text-xs text-text-dim">
              {selected.length} de {MAX_LEGISLATORS}
            </span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {selected.map((item) => {
              const deputy = deputies.find((candidate) => candidate.id === item.externalId);
              return (
                <li key={item.externalId}>
                  <button
                    type="button"
                    onClick={() => deputy && onToggle(deputy)}
                    aria-label={`Remover ${item.name}`}
                    className="flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 py-1 pl-3 pr-2 text-[13px] text-text transition-colors hover:border-accent"
                  >
                    {item.name}
                    <span aria-hidden className="text-text-dim">
                      ×
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Busca e resultados numa caixa só, como a busca do painel */}
      <div className="mt-6 overflow-hidden rounded-panel border border-border-subtle bg-surface focus-within:border-border-strong">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4 shrink-0 text-text-dim"
            fill="none"
          >
            <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, partido ou estado"
            aria-label="Buscar deputado"
            className="w-full bg-transparent py-3.5 text-[15px] text-text outline-none placeholder:text-text-dim"
          />
        </div>

        <ul className="max-h-[20rem] overflow-y-auto">
          {results.map((deputy) => {
            const picked = selectedIds.includes(deputy.id);
            const disabled = full && !picked;
            return (
              <li key={deputy.id} className="border-b border-border-subtle last:border-b-0">
                <button
                  type="button"
                  onClick={() => onToggle(deputy)}
                  disabled={disabled}
                  aria-pressed={picked}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    picked ? "bg-accent/10" : "hover:bg-surface-2",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  <Indicator picked={picked} shape="check" />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-text">
                    {deputy.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-text-dim">
                    {deputyCaption(deputy.party, deputy.uf)}
                  </span>
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-text-muted">
              Nenhum deputado encontrado para “{query}”.
            </li>
          )}
        </ul>
      </div>

      {full && (
        <p className="mt-3 text-[13px] text-text-dim">
          Limite atingido. Remova alguém para trocar.
        </p>
      )}

      <Footer
        onNext={onNext}
        nextLabel="Continuar"
        nextDisabled={selected.length === 0}
        hint={selected.length === 0 ? "Escolha pelo menos um parlamentar" : undefined}
      />
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
      <StepHeading
        title="Como você quer ser avisado?"
        lede="Por enquanto o Observando avisa por e-mail. SMS e WhatsApp vêm depois."
      />

      <label className="mt-6 block">
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
            "mt-2 w-full rounded-lg border bg-surface px-4 py-3 text-[15px] text-text outline-none transition-colors placeholder:text-text-dim",
            showError ? "border-flag" : "border-border-strong focus:border-accent",
          ].join(" ")}
        />
        {showError && (
          <span className="mt-2 block text-[13px] text-flag">
            Esse e-mail não parece válido.
          </span>
        )}
      </label>

      <fieldset className="mt-6">
        <legend className="text-[13px] text-text-muted">Com que frequência</legend>
        <div className="mt-2 space-y-2" role="radiogroup">
          {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((option) => {
            const picked = frequency === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => setFrequency(option)}
                className={[OPTION_BASE, optionState(picked)].join(" ")}
              >
                <Indicator picked={picked} shape="radio" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-text">
                    {FREQUENCY_LABEL[option]}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-text-dim">
                    {FREQUENCY_NOTE[option]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Expectativa realista: votação com voto nominal é rara (2% em 2026). */}
      <div className="mt-6">
        <Note>
          A Câmara só registra o voto de cada parlamentar em parte das votações —
          cerca de uma a cada cinquenta. Na prática, isso dá algo em torno de doze
          votações por mês para cada parlamentar que você acompanha.
        </Note>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-text-dim">
        Ao continuar, você concorda em receber esses avisos no e-mail informado.
        Todo e-mail tem link para cancelar, e você pode mudar ou apagar suas
        escolhas a qualquer momento.
      </p>

      <Footer
        onBack={onBack}
        onNext={() => onFinish(email, frequency)}
        nextLabel={`Acompanhar ${legislatorCount} parlamentar${legislatorCount > 1 ? "es" : ""}`}
        nextDisabled={!valid}
        hint={!valid ? "Informe um e-mail para continuar" : undefined}
      />
    </section>
  );
}

/** Rodapé dos passos: voltar à esquerda, ação principal à direita. */
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
    <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-subtle pt-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-1 py-2.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          ← Voltar
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {hint && <span className="text-[13px] text-text-dim">{hint}</span>}
        <button type="button" onClick={onNext} disabled={nextDisabled} className={PRIMARY_BUTTON}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
