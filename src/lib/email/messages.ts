import "server-only";
import { FREQUENCY_LABEL, type Frequency } from "@/lib/preferences";
import { topicLabel } from "@/lib/topics";
import type { TopicId } from "@/lib/types";
import type { EmailMessage } from "@/lib/email/send";

/**
 * As duas mensagens que o produto manda.
 *
 * Ambas seguem a mesma regra: dizem o que o clique faz e o que acontece se a
 * pessoa ignorar. Isso não é cortesia — qualquer um pode digitar o e-mail de
 * outra pessoa no onboarding, então quem recebe sem ter pedido precisa saber,
 * na primeira linha, que ignorar basta.
 *
 * O texto evita jargão legislativo de propósito: o público são pessoas com
 * pouco tempo e nenhuma paciência para "requerimento de destaque".
 */

export type MessageContext = {
  to: string;
  url: string;
  ttlHours: number;
  legislators: string[];
  topics: TopicId[];
  frequency: Frequency;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function topicsLine(topics: TopicId[]): string {
  if (topics.length === 0) return "Todos os temas";
  return topics.map((id) => topicLabel(id) ?? id).join(", ");
}

/** Resumo das escolhas, para a pessoa reconhecer — ou não — o que pediu. */
function summaryText(context: MessageContext): string {
  const quem = context.legislators.map((name) => `  - ${name}`).join("\n");
  return [
    quem,
    "",
    `Temas: ${topicsLine(context.topics)}`,
    `Frequência: ${FREQUENCY_LABEL[context.frequency]}`,
  ].join("\n");
}

function summaryHtml(context: MessageContext): string {
  const quem = context.legislators
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join("");
  return [
    `<ul style="margin:0 0 16px;padding-left:20px">${quem}</ul>`,
    `<p style="margin:0 0 4px"><strong>Temas:</strong> ${escapeHtml(topicsLine(context.topics))}</p>`,
    `<p style="margin:0 0 16px"><strong>Frequência:</strong> ${escapeHtml(FREQUENCY_LABEL[context.frequency])}</p>`,
  ].join("");
}

/** Moldura comum. Estilos inline: cliente de e-mail ignora folha de estilo. */
function wrap(parts: { heading: string; body: string }): string {
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;',
    'max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;font-size:15px;line-height:1.6">',
    '<p style="margin:0 0 24px;font-size:17px">Observa</p>',
    `<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3">${parts.heading}</h1>`,
    parts.body,
    "</div>",
  ].join("");
}

function button(url: string, label: string): string {
  return [
    `<p style="margin:0 0 20px"><a href="${escapeHtml(url)}" `,
    'style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;',
    `padding:11px 20px;border-radius:999px;font-weight:500">${label}</a></p>`,
    `<p style="margin:0 0 20px;font-size:13px;color:#666">Se o botão não abrir, copie este endereço:<br>${escapeHtml(url)}</p>`,
  ].join("");
}

/** Primeiro cadastro: nada foi enviado ainda e nada será sem este clique. */
export function verifyMessage(context: MessageContext): EmailMessage {
  const text = [
    "Você pediu para acompanhar as votações de:",
    "",
    summaryText(context),
    "",
    "Confirme neste link para começar a receber:",
    context.url,
    "",
    `O link vale por ${context.ttlHours} horas.`,
    "",
    "Se não foi você que pediu, ignore este e-mail. Nada é enviado sem a",
    "confirmação, e seu endereço não volta a ser usado.",
  ].join("\n");

  const html = wrap({
    heading: "Confirme para começar a receber",
    body: [
      '<p style="margin:0 0 12px">Você pediu para acompanhar as votações de:</p>',
      summaryHtml(context),
      button(context.url, "Confirmar e começar"),
      `<p style="margin:0 0 20px;font-size:13px;color:#666">O link vale por ${context.ttlHours} horas.</p>`,
      '<p style="margin:0;font-size:13px;color:#666">Se não foi você que pediu, ignore este e-mail. ',
      "Nada é enviado sem a confirmação, e seu endereço não volta a ser usado.</p>",
    ].join(""),
  });

  return { to: context.to, subject: "Confirme para começar a receber", text, html };
}

/**
 * Mudança pedida para um endereço já confirmado.
 *
 * Esta mensagem é a própria defesa: ela mostra o que mudaria e diz que ignorar
 * preserva o que já existe. Quem não pediu a mudança descobre aqui.
 */
export function applyMessage(context: MessageContext): EmailMessage {
  const text = [
    "Pediram para mudar o que você acompanha no Observa para:",
    "",
    summaryText(context),
    "",
    "Se foi você, confirme neste link:",
    context.url,
    "",
    `O link vale por ${context.ttlHours} horas.`,
    "",
    "Se não foi você, ignore este e-mail. Suas escolhas atuais continuam",
    "exatamente como estão — nada muda sem esse clique.",
  ].join("\n");

  const html = wrap({
    heading: "Confirme a mudança nas suas escolhas",
    body: [
      '<p style="margin:0 0 12px">Pediram para mudar o que você acompanha no Observa para:</p>',
      summaryHtml(context),
      button(context.url, "Confirmar a mudança"),
      `<p style="margin:0 0 20px;font-size:13px;color:#666">O link vale por ${context.ttlHours} horas.</p>`,
      '<p style="margin:0;font-size:13px;color:#666">Se não foi você, ignore este e-mail. ',
      "Suas escolhas atuais continuam exatamente como estão — nada muda sem esse clique.</p>",
    ].join(""),
  });

  return {
    to: context.to,
    subject: "Confirme a mudança nas suas escolhas",
    text,
    html,
  };
}
