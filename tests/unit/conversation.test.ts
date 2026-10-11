import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { CALLERS, callerById } from '../../src/data/callers';
import type { CallerDef } from '../../src/systems/conversation/caller';
import { Conversation, makeVariant } from '../../src/systems/conversation/engine';
import { MoodState, NO_SIGNALS } from '../../src/systems/conversation/mood';
import { findClaimedName, understand } from '../../src/systems/conversation/nlu';
import { editDistance, extractNumbers, jaccard, normalize, stem } from '../../src/systems/conversation/text';
import { TOPICS } from '../../src/systems/conversation/types';
import { Rng } from '../../src/systems/rng/rng';

const ctx = { callerNames: ['Hildegard', 'Sonnenschein'] };
const caller = (id: string): CallerDef => callerById(id)!;
/** Gespräch mit festem Start-Vertrauen (Tagesform ausgeschaltet). */
function talk(id: string, trust?: number, seed = 1): Conversation {
  const rng = new Rng(seed);
  const v = { ...makeVariant(rng), trustShift: 0, noise: 'none' as const };
  const c = new Conversation(caller(id), rng, v);
  if (trust !== undefined) c.trust = trust;
  c.answer();
  return c;
}
const situations = (c: Conversation, text: string): string[] => c.say(text).lines.map((l) => l.situation);

describe('Text-Werkzeuge', () => {
  it('normalisiert, stemmt und vergleicht unscharf', () => {
    expect(normalize('Grüß Gott, Frau Müller!')).toBe('gruess gott frau mueller');
    expect(stem('katzen')).toBe('katz');
    expect(editDistance('entschuldigung', 'entschuldigng')).toBe(1);
    expect(editDistance('bank', 'danke', 1)).toBeGreaterThan(1);
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1);
  });

  it('erkennt Zahlen aus Ziffern und Zahlwörtern, aber keine Artikel', () => {
    // Diktat mit Pausen ergibt eine Folge; andere Wörter trennen.
    expect(extractNumbers('vier acht zwei, eins null sieben')).toEqual(['482107']);
    expect(extractNumbers('drei Katzen und 12 Hunde')).toEqual(['3', '12']);
    expect(extractNumbers('Die Nummer ist 48 21 07')).toEqual(['482107']);
    expect(extractNumbers('Ich habe eine Katze')).toEqual([]);
  });
});

describe('Sprachverständnis', () => {
  it('erkennt Absichten, Rollen-Behauptung und Namen', () => {
    const f = understand('Guten Tag, Frau Sonnenschein! Mein Name ist Herr Huber von der Bank.', ctx);
    expect(f.intents.greet).toBeGreaterThan(0);
    expect(f.intents.introduce).toBeGreaterThan(0);
    expect(f.intents.thanks).toBeUndefined();
    expect(f.roleClaims).toEqual(['bank']);
    expect(f.nameMention).toBe(true);
    expect(f.claimedName).toBe('Herr Huber');
  });

  it('versteht Verneinung: „keine Sorge“ beruhigt, „nicht dringend“ drängt nicht', () => {
    expect(understand('Keine Sorge, alles gut.', ctx).intents.calm).toBeGreaterThan(1);
    expect(understand('Das ist nicht dringend.', ctx).intents.urgency).toBeUndefined();
  });

  it('verzeiht Tippfehler bei längeren Wörtern', () => {
    expect(understand('Entschuldigng!', ctx).intents.apology).toBeGreaterThan(0);
    expect(understand('Sie sind so sympatisch', ctx).intents.compliment).toBeGreaterThan(0);
  });

  it('erkennt Forderungen, Themen, Kauderwelsch und Echo-Wörter', () => {
    const d = understand('Geben Sie mir sofort Ihre Bürgernummer!', ctx);
    expect(d.demands).toEqual(['nummer']);
    expect(d.intents.urgency).toBeGreaterThan(0);
    expect(understand('Wie geht es Ihrer Katze?', ctx).topics).toContain('katzen');
    expect(understand('asdfghjk qwrtz', ctx).nonsense).toBeGreaterThan(0.5);
    expect(understand('Ich biete Ihnen einen Quantenstaubsauger an', ctx).echo).toBe('Quantenstaubsauger');
    expect(understand('ICH BIN DER ENKEL!!', ctx).shouting).toBe(true);
  });

  it('Namensnennung nur bei echten Namen', () => {
    expect(findClaimedName('Ich bin Ihr Enkel')).toBeNull();
    expect(findClaimedName('ich bin müde')).toBeNull();
    expect(findClaimedName('Hier spricht Frau Meier')).toBe('Frau Meier');
    expect(findClaimedName('Mein Name ist Kim Lüdke')).toBe('Kim Lüdke');
  });
});

describe('Gesprächs-Engine', () => {
  it('Komplimente bauen Vertrauen auf, nutzen sich aber ab (keine Universal-Floskel)', () => {
    const c = talk('hildegard', 40);
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) gains.push(c.say('Sie haben eine wirklich schöne Stimme!').trustDelta);
    expect(gains[0]).toBeGreaterThan(4);
    expect(gains[4]).toBeLessThan(gains[0]! * 0.3);
    expect(gains.reduce((a, b) => a + b, 0)).toBeLessThan(gains[0]! * 2.2);
  });

  it('Wer zu früh fordert, verliert stark; mit genug Vertrauen klappt es', () => {
    const early = talk('hildegard', 35);
    const r = early.say('Nennen Sie mir Ihre Bürgernummer.');
    expect(r.trustDelta).toBeLessThan(-8);
    expect(r.lines.map((l) => l.situation)).toContain('demand.early');
    expect(early.ended).toBe(false);

    const late = talk('hildegard', 80);
    const ok = late.say('Lesen Sie mir bitte Ihre Bürgernummer vor.');
    expect(ok.loot?.kind).toBe('nummer');
    expect(ok.loot?.value).toMatch(/^[A-Z]{2} \d\d \d\d \d\d$/);
    // Diktat Stück für Stück (CAL-15); die sorgfältige Hildegard liest am Ende alles noch einmal vor.
    const sit = ok.lines.map((l) => l.situation);
    expect(sit[0]).toBe('demand.agree');
    expect(sit[1]).toBe('dictate.start');
    expect(sit.filter((x) => x === 'dictate.chunk')).toHaveLength(4);
    expect(sit.at(-1)).toBe('loot.nummer');
    // Das Gespräch läuft weiter, bis man sich verabschiedet.
    expect(late.ended).toBe(false);
    expect(late.phase).toBe('beute');
    const bye = late.say('Vielen Dank, auf Wiederhören!');
    expect(bye.outcome).toBe('success');
    expect(bye.lines.map((l) => l.situation)).toEqual(['end.success']);
  });

  it('Widersprüche fallen auf: erst Bank, dann Enkel', () => {
    const c = talk('rosi', 50);
    c.say('Guten Tag, ich rufe im Auftrag der Bank an.');
    const r = c.say('Ich bin Ihr Enkel!');
    expect(r.lines[0]?.situation).toBe('contradiction.role');
    expect(r.lines[0]?.params).toMatchObject({ role: 'bank', newRole: 'familie' });
    expect(r.trustDelta).toBeLessThan(-5);
  });

  it('Stimmung ist kein reiner Prozentwert: gleiche 55 %, verschiedene Stimmungen', () => {
    const a = talk('chantal', 55);
    a.say('Du bist so eine Nervensäge!');
    const b = talk('hildegard', 55);
    b.say('Sie sind so freundlich und klingen so jung!');
    expect(a.currentMood).toBe('wuetend');
    expect(['vertrauensvoll', 'neutral']).toContain(b.currentMood);
    expect(a.currentMood).not.toBe(b.currentMood);
  });

  it('Empfindliche explodiert bei Beleidigung, eine Entschuldigung beruhigt', () => {
    const c = talk('chantal', 60);
    expect(situations(c, 'Du bist doof.')).toContain('trait.explode');
    expect(c.currentMood).toBe('wuetend');
    c.say('Entschuldigung, das tut mir leid, mein Fehler!');
    expect(c.currentMood).not.toBe('wuetend');
  });

  it('Wut bei wenig Vertrauen: legt nach einigen Sekunden auf', () => {
    const c = talk('detlef', 12);
    c.say('Sie Idiot, Sie Hornochse!');
    expect(c.currentMood).toBe('wuetend');
    let r = null;
    for (let t = 0; t < 10 && !c.ended; t += 0.5) r = c.tick(0.5);
    expect(c.ended).toBe(true);
    expect(r?.reason === 'angry' || r?.reason === 'trust' || c.reason === 'trust').toBe(true);
  });

  it('Schweigen: erst Mahnung, dann Auflegen', () => {
    const c = talk('hildegard', 50);
    const seen: string[] = [];
    for (let t = 0; t < 200 && !c.ended; t += 0.25) {
      const r = c.tick(0.25);
      if (r) seen.push(...r.lines.map((l) => l.situation));
    }
    expect(seen).toContain('silence.1');
    expect(seen).toContain('hangup.patience');
    expect(c.outcome).toBe('hangup');
  });

  it('Warteschleife: kurz ist ok, zu lang legt auf', () => {
    const c = talk('hildegard', 50);
    c.hold();
    for (let i = 0; i < 4; i++) c.tick(1);
    expect(c.resume().lines[0]?.situation).toBe('hold.back');
    c.hold();
    for (let t = 0; t < TUNING.calls.holdMaxSeconds + 1 && !c.ended; t += 1) c.tick(1);
    expect(c.reason).toBe('hold');
  });

  it('Köder geben falsche Beute', () => {
    const c = talk('kevin', 85);
    const r = c.say('Nennen Sie mir bitte Ihren Code.');
    expect(r.loot?.bait).toBe(true);
    expect(r.loot?.value).not.toBe(c.variant.loot.code);
    expect(r.lines.map((l) => l.situation)).toContain('loot.bait');
    c.hangUp();
    expect(c.outcome).toBe('bait');
  });

  it('Schläfer nicken ein und müssen geweckt werden', () => {
    const c = talk('gerd', 50);
    let slept = false;
    for (let t = 0; t < 20 && !slept; t += 0.5) slept = c.tick(0.5)?.lines.some((l) => l.situation === 'trait.sleep') ?? false;
    expect(slept).toBe(true);
    expect(situations(c, 'Das Wetter ist schön')).toEqual(['trait.snore']);
    expect(situations(c, 'Hallo Gerd!')[0]).toBe('trait.wake');
  });

  it('Verabschieden beendet das Gespräch freundlich', () => {
    const c = talk('rosi', 50);
    const r = c.say('Tschüss und einen schönen Tag noch!');
    expect(r.outcome).toBe('farewell');
    expect(c.log.some((e) => e.who === 'player')).toBe(true);
  });

  it('protokolliert alle Zeilen (Gesprächsanalyse)', () => {
    const c = talk('hildegard', 50);
    c.say('Hallo!');
    c.hangUp();
    expect(c.log.map((e) => e.who)).toEqual(['caller', 'player', 'caller', 'system']);
    expect(c.outcome).toBe('playerHangup');
  });
});

describe('Stimmungs-Automat', () => {
  it('hat Trägheit: ein einzelner leichter Reiz kippt die Stimmung nicht', () => {
    const m = new MoodState('neutral', { volatility: 0.6, irritability: 1, fearfulness: 0.5, humor: 0.5, suspicion: 0.5 });
    expect(m.apply({ ...NO_SIGNALS, urgency: 0.5 }, 50)).toBeNull();
    expect(m.apply({ ...NO_SIGNALS, insult: 1.5 }, 50)).toBeNull();
    expect(m.apply({ ...NO_SIGNALS, insult: 1.5 }, 50)).toBe('wuetend');
  });
});

describe('Anrufer-Daten', () => {
  it('sind vollständig und gültig', () => {
    const ids = new Set<string>();
    for (const c of CALLERS) {
      expect(ids.has(c.id), c.id).toBe(false);
      ids.add(c.id);
      expect(c.names.length).toBeGreaterThan(0);
      expect(c.startTrust[0]).toBeLessThanOrEqual(c.startTrust[1]);
      expect(c.startTrust[1]).toBeLessThanOrEqual(100);
      for (const t of [...c.likes, ...c.dislikes]) expect(TOPICS as readonly string[]).toContain(t);
      expect(c.likes.some((t) => c.dislikes.includes(t))).toBe(false);
    }
    expect(CALLERS.length).toBe(22);
  });
});
