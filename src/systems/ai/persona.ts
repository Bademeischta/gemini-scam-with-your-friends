import { TUNING } from '../../config/tuning';
import { SCHEMES } from '../../data/schemes';
import type { Params } from '../../i18n/i18n';
import type { CallerDef } from '../conversation/caller';
import type { AiPlan, Conversation } from '../conversation/engine';
import { MOODS, ROLES } from '../conversation/types';
import type { AiMessage } from './transport';

/** Woher die Texte kommen (i18n; in Tests austauschbar). */
export interface PromptText {
  t(key: string, params?: Params): string;
  list(key: string): string[];
}

/** Situationen, aus denen Beispielsätze für den Tonfall der Figur stammen. */
const STYLE_SITUATIONS = ['answer', 'react.greet.pos', 'react.compliment.pos', 'react.smalltalk.neg', 'react.urgency.neg', 'demand.early', 'mood.genervt', 'react.nonsense'];

/**
 * System-Prompt einer Figur: Hintergrund, Charakter, Vorlieben, Schwächen, Misstrauens-Auslöser,
 * Tonfall (Beispielzeilen aus den Daten) und die festen Regeln. Je Figur unverändert (cachebar).
 */
export function buildPersona(caller: CallerDef, src: PromptText): string {
  const k = (key: string, params?: Params): string => src.t(key, params);
  const out: string[] = [k('ai.prompt.intro'), k('ai.prompt.who', { name: k(`callers.${caller.id}.name`), bio: k(`callers.${caller.id}.bio`) })];

  const tm = caller.temper;
  const traits: string[] = [];
  if (tm.irritability >= 1) traits.push(k('ai.temper.irritable'));
  else if (tm.irritability <= 0.5) traits.push(k('ai.temper.patient'));
  if (tm.fearfulness >= 0.8) traits.push(k('ai.temper.fearful'));
  else if (tm.fearfulness <= 0.3) traits.push(k('ai.temper.brave'));
  if (tm.humor >= 0.6) traits.push(k('ai.temper.funny'));
  else if (tm.humor <= 0.3) traits.push(k('ai.temper.serious'));
  if (tm.suspicion >= 0.6) traits.push(k('ai.temper.suspicious'));
  else if (tm.suspicion <= 0.35) traits.push(k('ai.temper.gullible'));
  if (tm.volatility >= 1.4) traits.push(k('ai.temper.volatile'));
  else if (tm.volatility <= 0.7) traits.push(k('ai.temper.calm'));
  for (const tr of caller.traits ?? []) traits.push(k(`ai.traits.${tr}`));
  if (traits.length > 0) out.push(k('ai.prompt.character', { list: traits.join('; ') }));

  const topics = (ids: readonly string[]): string => ids.map((id) => k(`calls.topics.${id}`)).join(', ');
  if (caller.likes.length > 0) out.push(k('ai.prompt.likes', { list: topics(caller.likes) }));
  if (caller.dislikes.length > 0) out.push(k('ai.prompt.dislikes', { list: topics(caller.dislikes) }));
  const roles = Object.entries(caller.roles ?? {}) as [string, number][];
  const trusted = roles.filter(([, v]) => v >= 0.8).map(([r]) => k(`calls.roles.${r}.label`));
  const distrusted = roles.filter(([, v]) => v <= -0.5).map(([r]) => k(`calls.roles.${r}.label`));
  if (trusted.length > 0) out.push(k('ai.prompt.trusts', { list: trusted.join(', ') }));
  if (distrusted.length > 0) out.push(k('ai.prompt.distrusts', { list: distrusted.join(', ') }));
  const fans = SCHEMES.filter((s) => s.fans.includes(caller.id)).map((s) => k(`schemes.${s.id}.name`));
  const skeptics = SCHEMES.filter((s) => s.skeptics.includes(caller.id)).map((s) => k(`schemes.${s.id}.name`));
  if (fans.length > 0) out.push(k('ai.prompt.fans', { list: fans.join(', ') }));
  if (skeptics.length > 0) out.push(k('ai.prompt.skeptics', { list: skeptics.join(', ') }));
  out.push(k('ai.prompt.threshold'));

  // Wenige Beispielsätze genügen für den Ton (kurzer Prompt, weniger Tokens je Anfrage).
  const examples: string[] = [];
  for (const sit of STYLE_SITUATIONS) {
    if (examples.length >= TUNING.ai.styleExamples) break;
    const line = src.list(`callers.${caller.id}.lines.${sit}`)[0];
    if (line) examples.push(`– ${line.replace(/\{\w+\}/g, '…')}`);
  }
  if (examples.length > 0) out.push(`${k('ai.prompt.style')}\n${examples.join('\n')}`);
  out.push(k('ai.prompt.rules'));
  out.push(k('ai.prompt.format', { moods: MOODS.join(', ') }));
  return out.join('\n\n');
}

/** Was seit der letzten KI-Antwort passiert ist (vom Spiel gesprochene Zeilen, Ereignisse). */
export interface RegieInput {
  conversation: Conversation;
  plan: AiPlan;
  /** Zeilen, die der Anrufer seitdem per Spiel gesagt hat (Abheben, Diktat, Warteschleife …). */
  events: string[];
  /** Wirkt der Satz wie eine abgenutzte Floskel (Faktor < 1)? */
  floskel: number;
  /** Zusammenfassung älterer Züge (leer = alles steht noch wörtlich im Verlauf). */
  summary?: string;
}

/**
 * Regie-Notiz zum aktuellen Satz (als System-Nachricht mitten im Gespräch): Zustand, Masche,
 * Entscheidungen der Spiellogik (Forderung, Widerspruch, Abschied) und Hinweise.
 */
export function buildRegie(r: RegieInput, src: PromptText): string {
  const k = (key: string, params?: Params): string => src.t(key, params);
  const c = r.conversation;
  const p = r.plan;
  const out: string[] = [k('ai.regie.head')];
  out.push(k('ai.regie.state', { trust: Math.round(c.trust), mood: k(`calls.moods.${c.currentMood}`), phase: k(`calls.phase.${c.phase}`) }));
  if (c.scheme) {
    out.push(k('ai.regie.scheme', { name: k(`schemes.${c.scheme.id}.name`), desc: k(`schemes.${c.scheme.id}.desc`) }));
    if (c.affinity > 0) out.push(k('ai.regie.fan'));
    if (c.affinity < 0) out.push(k('ai.regie.skeptic'));
    if (c.pitched) out.push(k('ai.regie.pitched'));
  } else out.push(k('ai.regie.noScheme'));
  if (r.summary) out.push(r.summary);
  // Was er bisher behauptet hat (das Gedächtnis bleibt, auch wenn der Verlauf gekürzt ist).
  const mem = c.memory;
  if (!p.role && !p.contradiction && (mem.name || mem.role)) {
    const who = [mem.name ? k('ai.regie.knownName', { name: mem.name }) : '', mem.role ? k('ai.regie.knownRole', { role: roleFrom(mem.role, src) }) : ''].filter(Boolean).join(', ');
    out.push(k('ai.regie.known', { who }));
  }
  if (c.loots.length > 0) out.push(k('ai.regie.given', { list: [...new Set(c.loots.map((l) => k(`calls.demands.${l.kind}`)))].join(', ') }));
  if (r.events.length > 0) out.push(k('ai.regie.events', { list: r.events.map((text) => k('ai.regie.said', { text })).join('; ') }));
  if (p.wakes) out.push(k('ai.regie.wake'));
  if (p.role) out.push(k('ai.regie.role', { role: roleFrom(p.role, src) }));
  if (p.contradiction) {
    const { kind, before, now } = p.contradiction;
    out.push(kind === 'role' ? k('ai.regie.contradiction.role', { before: roleFrom(before, src), now: roleFrom(now, src) }) : k('ai.regie.contradiction.name', { before, now }));
  }
  if (p.injection) out.push(k('ai.regie.injection'));
  else if (p.repeat) out.push(k('ai.regie.repeat'));
  else if (r.floskel < 0.9) out.push(k('ai.regie.floskel'));
  if (p.demand) {
    const bait = p.demand.decision === 'grant' && (c.caller.traits?.includes('baiter') ?? false);
    out.push(k(`ai.regie.demand.${bait ? 'grantBait' : p.demand.decision}`, { demand: k(`calls.demands.${p.demand.kind}`) }));
  }
  if (p.farewell) out.push(k('ai.regie.farewell'));
  out.push(c.trust < TUNING.ai.hangupMaxTrust ? k('ai.regie.mayHangUp') : k('ai.regie.keepGoing'));
  return out.join('\n');
}

/**
 * Ältere Züge lokal zusammenfassen (keine zusätzliche Anfrage): was der Spieler gesagt hat,
 * gekürzt; bei langen Gesprächen der Anfang und die letzten Sätze vor dem wörtlichen Verlauf.
 */
export function summarizeHistory(older: readonly AiMessage[], src: PromptText): string {
  const said = older.filter((m) => m.role === 'user').map((m) => shorten(m.content, TUNING.ai.summaryChars));
  if (said.length === 0) return '';
  const max = TUNING.ai.summaryItems;
  const pick = said.length > max ? [...said.slice(0, 2), '…', ...said.slice(said.length - (max - 2))] : said;
  return src.t('ai.regie.summary', { list: pick.map((text) => (text === '…' ? text : src.t('ai.regie.summarySaid', { text }))).join('; ') });
}

function shorten(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function roleFrom(role: string, src: PromptText): string {
  return (ROLES as readonly string[]).includes(role) ? src.t(`calls.roles.${role}.from`) : role;
}
