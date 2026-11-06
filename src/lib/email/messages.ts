import "server-only";
import { FREQUENCY_LABEL, type Frequency } from "@/lib/preferences";
import { topicLabel } from "@/lib/topics";
import type { TopicId, VotingObjectKind } from "@/lib/types";
import { OBJECT_KIND_LABEL, OBJECT_KIND_NOTE } from "@/lib/camara/object-kind";
import { deputyCaption, formatDateTime } from "@/lib/format";
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
    '<p style="margin:0 0 24px;font-size:17px">Observando</p>',
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
    "Pediram para mudar o que você acompanha no Observando para:",
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
      '<p style="margin:0 0 12px">Pediram para mudar o que você acompanha no Observando para:</p>',
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

/**
 * Pedido de exclusão de dados.
 *
 * Diz exatamente o que deixa de existir, e que ignorar não muda nada: quem
 * recebe sem ter pedido — alguém digitou o endereço dela — precisa saber que
 * a inscrição continua como está.
 */
export function deletionMessage(context: {
  to: string;
  url: string;
  ttlHours: number;
}): EmailMessage {
  const apagado =
    "seu e-mail, os parlamentares e temas que você escolheu, a frequência e o histórico de avisos";
  const text = [
    "Pediram para apagar os seus dados do Observando.",
    "",
    `Se foi você, confirme neste link. Serão apagados ${apagado}:`,
    context.url,
    "",
    `O link vale por ${context.ttlHours} horas. A exclusão não tem volta; para`,
    "voltar a acompanhar alguém, é só se inscrever de novo.",
    "",
    "Se não foi você, ignore este e-mail. Nada é apagado sem esse clique.",
  ].join("\n");

  const html = wrap({
    heading: "Confirme a exclusão dos seus dados",
    body: [
      '<p style="margin:0 0 12px">Pediram para apagar os seus dados do Observando.</p>',
      `<p style="margin:0 0 16px">Se foi você, confirme no botão abaixo. Serão apagados ${apagado}.</p>`,
      button(context.url, "Apagar meus dados"),
      `<p style="margin:0 0 20px;font-size:13px;color:#666">O link vale por ${context.ttlHours} horas. `,
      "A exclusão não tem volta; para voltar a acompanhar alguém, é só se inscrever de novo.</p>",
      '<p style="margin:0;font-size:13px;color:#666">Se não foi você, ignore este e-mail. Nada é apagado sem esse clique.</p>',
    ].join(""),
  });

  return { to: context.to, subject: "Confirme a exclusão dos seus dados", text, html };
}

/**
 * Vai para o endereço ANTIGO quando alguém troca o e-mail nas preferências.
 *
 * Trocar não pode apagar o antigo direto: quem trocou não provou ter acesso
 * a ele, e qualquer um poderia encerrar a inscrição de outra pessoa digitando
 * o endereço dela. Então o antigo recebe um link, e só o clique encerra.
 * O endereço novo não aparece aqui — a mensagem não precisa dele, e quem não
 * pediu a troca não tem por que conhecê-lo.
 */
export function emailChangeMessage(context: {
  to: string;
  url: string;
  ttlHours: number;
}): EmailMessage {
  const text = [
    "Pediram para mudar o e-mail que recebe os avisos do Observando para outro",
    "endereço.",
    "",
    "Se foi você, confirme neste link para este endereço parar de receber. A",
    "inscrição dele (o e-mail, as escolhas e o histórico de avisos) é apagada:",
    context.url,
    "",
    `O link vale por ${context.ttlHours} horas. Confirme também o endereço novo,`,
    "pelo link que mandamos para ele: até lá, ele não recebe nada.",
    "",
    "Se não foi você, ignore este e-mail. Este endereço continua recebendo como antes.",
  ].join("\n");

  const html = wrap({
    heading: "Parar os avisos neste endereço?",
    body: [
      '<p style="margin:0 0 12px">Pediram para mudar o e-mail que recebe os avisos do Observando para outro endereço.</p>',
      '<p style="margin:0 0 16px">Se foi você, confirme no botão abaixo para este endereço parar de receber. A inscrição dele (o e-mail, as escolhas e o histórico de avisos) é apagada.</p>',
      button(context.url, "Parar os avisos aqui"),
      `<p style="margin:0 0 20px;font-size:13px;color:#666">O link vale por ${context.ttlHours} horas. `,
      "Confirme também o endereço novo, pelo link que mandamos para ele: até lá, ele não recebe nada.</p>",
      '<p style="margin:0;font-size:13px;color:#666">Se não foi você, ignore este e-mail. Este endereço continua recebendo como antes.</p>',
    ].join(""),
  });

  return { to: context.to, subject: "Parar os avisos neste endereço?", text, html };
}

/* =========================================================================
   Resumo de votações.

   É a mensagem que o produto existe para mandar, e as regras do PRD §8.1
   valem aqui com mais força que na tela, porque o e-mail é lido de passagem:

   - dizer o que foi votado DE FATO. A maioria das votações não é sobre a
     lei, é sobre uma urgência, uma emenda, uma retirada de pauta. "Votou Sim
     no PL X" seria falso quando foi um requerimento;
   - ausência de registro nunca vira falta nem voto contrário;
   - o valor do voto aparece como a fonte deu. Só ganha explicação o que
     ninguém entende sozinho ("Artigo 17", "Obstrução"); nunca é trocado;
   - nada qualifica o mérito. Sem cor, sem "a favor do povo".
   ========================================================================= */

export type DigestVote = {
  name: string;
  party: string | null;
  uf: string | null;
  /** Valor como a fonte deu; `null` quando não há registro. */
  value: string | null;
};

export type DigestItem = {
  occurredAt: string;
  propositionLabel: string | null;
  propositionTitle: string | null;
  objectKind: VotingObjectKind | null;
  /** Descrição oficial, literal. */
  objectDescription: string;
  result: "Aprovado" | "Rejeitado" | null;
  /** Um por parlamentar acompanhado, com ou sem registro. */
  votes: DigestVote[];
  sourceUrl: string;
};

export type DigestContext = {
  to: string;
  items: DigestItem[];
  siteUrl: string;
  unsubscribeUrl: string;
};

const UNDETERMINED_SHORT =
  "A Câmara não informa com clareza o que foi votado nesta etapa. Leia a descrição oficial abaixo antes de tirar conclusões.";

/** Valor do voto como a fonte deu, com explicação só onde ela é necessária. */
function voteText(value: string | null): string {
  if (value === null) {
    return "sem registro de voto (isso não quer dizer ausência nem voto contrário)";
  }
  const trimmed = value.trim();
  if (!trimmed) return "voto registrado, mas sem a opção informada pela Câmara";
  if (trimmed === "Artigo 17") return "Artigo 17 (presidia a sessão e, pelo regimento, não vota)";
  if (trimmed === "Obstrução") return "Obstrução (recurso para tentar impedir a votação)";
  return trimmed;
}

function cleanTitle(title: string | null): string | null {
  const cleaned = title?.replace(/^[“"]|[”"]$/g, "").trim();
  return cleaned || null;
}

function whatText(item: DigestItem): string {
  return item.objectKind
    ? `${OBJECT_KIND_LABEL[item.objectKind]}. ${OBJECT_KIND_NOTE[item.objectKind]}`
    : UNDETERMINED_SHORT;
}

function itemText(item: DigestItem): string {
  const header = [item.propositionLabel ?? "Votação", formatDateTime(item.occurredAt)].join(" · ");
  const lines = [header];
  const title = cleanTitle(item.propositionTitle);
  if (title) lines.push(title);
  lines.push("", `O que foi votado: ${whatText(item)}`);
  lines.push(`Descrição oficial: "${item.objectDescription}"`);
  if (item.result) lines.push(`Resultado da votação: ${item.result}`);
  lines.push("", "Como votaram:");
  for (const vote of item.votes) {
    lines.push(`  - ${vote.name} (${deputyCaption(vote.party, vote.uf)}): ${voteText(vote.value)}`);
  }
  lines.push("", `Fonte oficial: ${item.sourceUrl}`);
  return lines.join("\n");
}

function itemHtml(item: DigestItem): string {
  const title = cleanTitle(item.propositionTitle);
  const votes = item.votes
    .map(
      (vote) =>
        `<li style="margin:0 0 4px"><strong>${escapeHtml(vote.name)}</strong> ` +
        `<span style="color:#666">(${escapeHtml(deputyCaption(vote.party, vote.uf))})</span>: ` +
        `${escapeHtml(voteText(vote.value))}</li>`,
    )
    .join("");
  return [
    '<div style="border-top:1px solid #e5e5e5;padding:20px 0">',
    `<p style="margin:0 0 4px;font-size:13px;color:#666">${escapeHtml(item.propositionLabel ?? "Votação")} · ${escapeHtml(formatDateTime(item.occurredAt))}</p>`,
    title ? `<p style="margin:0 0 12px;font-weight:600">${escapeHtml(title)}</p>` : "",
    `<p style="margin:0 0 8px"><strong>O que foi votado:</strong> ${escapeHtml(whatText(item))}</p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:#666">Descrição oficial: “${escapeHtml(item.objectDescription)}”</p>`,
    item.result
      ? `<p style="margin:0 0 12px"><strong>Resultado da votação:</strong> ${escapeHtml(item.result)}</p>`
      : "",
    '<p style="margin:0 0 4px"><strong>Como votaram:</strong></p>',
    `<ul style="margin:0 0 12px;padding-left:20px">${votes}</ul>`,
    `<p style="margin:0;font-size:13px"><a href="${escapeHtml(item.sourceUrl)}" style="color:#1a1a1a">Fonte oficial</a></p>`,
    "</div>",
  ].join("");
}

/**
 * Uma mensagem por pessoa, com todas as votações vencidas. Mais recentes
 * primeiro. O assunto não cita voto de ninguém: num assunto não cabe dizer que
 * o "Não" foi a um requerimento, e sem isso ele engana.
 */
export function digestMessage(context: DigestContext): EmailMessage {
  const items = [...context.items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const subject =
    items.length === 1
      ? `Nova votação: ${items[0].propositionLabel ?? "Câmara dos Deputados"}`
      : `${items.length} votações dos parlamentares que você acompanha`;

  const footerText = [
    "Você recebe este e-mail porque escolheu acompanhar esses parlamentares no Observando.",
    `Para mudar quem você acompanha, refaça a inscrição em ${context.siteUrl}`,
    `Para parar de receber: ${context.unsubscribeUrl}`,
  ].join("\n");

  const text = [
    items.length === 1
      ? "Um parlamentar que você acompanha participou de uma votação na Câmara."
      : "Parlamentares que você acompanha participaram destas votações na Câmara.",
    "",
    ...items.flatMap((item) => [itemText(item), "", "---", ""]),
    footerText,
  ].join("\n");

  const html = wrap({
    heading: escapeHtml(subject),
    body: [
      ...items.map(itemHtml),
      '<div style="border-top:1px solid #e5e5e5;padding-top:20px;font-size:13px;color:#666">',
      "<p style=\"margin:0 0 8px\">Você recebe este e-mail porque escolheu acompanhar esses parlamentares no Observando.</p>",
      `<p style="margin:0 0 8px"><a href="${escapeHtml(context.siteUrl)}" style="color:#666">Mudar quem você acompanha</a></p>`,
      `<p style="margin:0"><a href="${escapeHtml(context.unsubscribeUrl)}" style="color:#666">Parar de receber</a></p>`,
      "</div>",
    ].join(""),
  });

  return { to: context.to, subject, text, html };
}
