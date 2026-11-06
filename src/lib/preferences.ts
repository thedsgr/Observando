import type { TopicId } from "@/lib/types";

/**
 * Preferências de acompanhamento.
 *
 * O formato já prevê o que ainda não existe, para não ter que migrar depois:
 * `channel.kind` aceita SMS e WhatsApp embora o MVP só envie e-mail, e
 * `legislators` carrega a casa legislativa embora só exista Câmara.
 */

export const MAX_LEGISLATORS = 5;

export type ChannelKind = "email" | "sms" | "whatsapp";

export type Channel = {
  kind: ChannelKind;
  /** E-mail, ou telefone em E.164 quando for SMS/WhatsApp. */
  address: string;
};

export type Frequency = "imediato" | "diario" | "semanal";

export type FollowedLegislator = {
  /** Casa legislativa. Só 'camara' no MVP. */
  house: "camara" | "senado";
  /** Identificador oficial na casa de origem. */
  externalId: number;
  name: string;
  party: string | null;
  uf: string | null;
};

export type Preferences = {
  legislators: FollowedLegislator[];
  /** Vazio significa **todos os temas**, que é o padrão de quem não escolhe. */
  topics: TopicId[];
  channel: Channel | null;
  frequency: Frequency;
  /** Quando o onboarding foi concluído. */
  completedAt: string | null;
};

export const EMPTY_PREFERENCES: Preferences = {
  legislators: [],
  topics: [],
  channel: null,
  frequency: "semanal",
  completedAt: null,
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  imediato: "A cada votação",
  diario: "Resumo diário",
  semanal: "Resumo semanal",
};

export const FREQUENCY_NOTE: Record<Frequency, string> = {
  imediato: "Um e-mail por votação dos seus parlamentares. Pode ser bastante.",
  diario: "Um e-mail por dia, só nos dias em que houver votação.",
  semanal: "Um e-mail por semana, reunindo tudo. O mais tranquilo.",
};

export function isComplete(preferences: Preferences): boolean {
  return (
    preferences.completedAt !== null &&
    preferences.legislators.length > 0 &&
    preferences.channel !== null
  );
}

/** Normalização simples; a validação séria acontece no servidor. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
