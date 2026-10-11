import { describe, expect, it } from 'vitest';
import { babbleSyllables, guessFemale, speechSegments } from '../../src/audio/speechText';
import { TUNING } from '../../src/config/tuning';
import { CALLERS } from '../../src/data/callers';
import { i18n } from '../../src/i18n';
import { collectStrings, type Dict } from '../../src/i18n/i18n';
import { DE } from '../../src/i18n/locales';
import { CallManager } from '../../src/systems/calls/CallManager';
import { PhoneHub, type Capture } from '../../src/systems/calls/PhoneHub';
import { CARD_CATEGORIES, CardDeck } from '../../src/systems/conversation/cards';
import { LinePicker } from '../../src/systems/conversation/lines';
import { understand } from '../../src/systems/conversation/nlu';
import { DEMANDS, MOODS, ROLES } from '../../src/systems/conversation/types';
import { Notebook } from '../../src/systems/os/notebook';
import { Rng } from '../../src/systems/rng/rng';

/** Zeit in kleinen Schritten vorspulen (wie der feste Logik-Takt). */
function run(fn: (dt: number) => void, seconds: number, dt = 1 / 30): void {
  for (let t = 0; t < seconds; t += dt) fn(dt);
}

function setup(seed = 3): { calls: CallManager; hub: PhoneHub; captures: Capture[] } {
  const calls = new CallManager(new Rng(seed), CALLERS, 8);
  const captures: Capture[] = [];
  const hub = new PhoneHub(calls, CALLERS, i18n, (c) => captures.push(c));
  return { calls, hub, captures };
}

describe('Anrufverwaltung', () => {
  it('besetzte Plätze klingeln bald, unbesetzte seltener; nach 30 s ist ein Anruf verpasst', () => {
    const { calls } = setup();
    calls.setStaffed(2, true);
    let rang = -1;
    calls.on((e) => {
      if (e.type === 'ring' && rang < 0) rang = e.desk;
    });
    run((dt) => calls.tick(dt), TUNING.calls.firstRingMax + 0.5);
    expect(rang).toBe(2);
    expect(calls.view(2).kind).toBe('ringing');
    run((dt) => calls.tick(dt), TUNING.calls.ringSeconds + 0.5);
    expect(calls.history.some((r) => r.desk === 2 && r.outcome === 'missed')).toBe(true);
  });

  it('mehrere Plätze klingeln gleichzeitig, aber nie zweimal derselbe Anrufer', () => {
    const { calls } = setup(9);
    for (let d = 0; d < 8; d++) calls.setStaffed(d, true);
    run((dt) => calls.tick(dt), TUNING.calls.firstRingMax + 0.5);
    const ringing = calls.views().filter((v) => v.kind === 'ringing') as { callerId: string }[];
    expect(ringing.length).toBeGreaterThan(1);
    expect(new Set(ringing.map((v) => v.callerId)).size).toBe(ringing.length);
  });

  it('geplante Anrufer klingeln sofort beim Hinsetzen; zufällige Anrufe lassen sich abschalten', () => {
    const { calls } = setup();
    calls.open = false;
    calls.scripted = ['gerd'];
    run((dt) => calls.tick(dt), 60);
    expect(calls.views().every((v) => v.kind === 'idle')).toBe(true);
    calls.setStaffed(5, true);
    expect(calls.view(5)).toMatchObject({ kind: 'ringing', callerId: 'gerd' });
  });

  it('Ablehnen zählt als verpasst, Auflegen wird mit Vertrauen protokolliert', () => {
    const { calls } = setup();
    calls.scripted = ['rosi', 'agnes'];
    calls.setStaffed(0, true);
    calls.decline(0);
    expect(calls.history.at(-1)).toMatchObject({ callerId: 'rosi', outcome: 'missed' });
    calls.setStaffed(0, false);
    calls.setStaffed(0, true);
    expect(calls.answer(0)).not.toBeNull();
    calls.hangUp(0);
    expect(calls.history.at(-1)).toMatchObject({ callerId: 'agnes', outcome: 'playerHangup' });
    expect(calls.view(0).kind).toBe('idle');
  });

  it('laufende Gespräche ticken weiter, auch wenn niemand am Platz sitzt', () => {
    const { calls } = setup();
    calls.scripted = ['hildegard'];
    calls.setStaffed(1, true);
    calls.answer(1);
    calls.setStaffed(1, false);
    calls.open = false;
    run((dt) => calls.tick(dt), 200);
    expect(calls.history.find((r) => r.desk === 1)).toMatchObject({ callerId: 'hildegard', outcome: 'hangup' });
  });
});

describe('Telefon-Sitzung', () => {
  it('Untertitel erscheinen Zeichen für Zeichen, Zeile für Zeile', () => {
    const { calls, hub } = setup();
    calls.scripted = ['rosi'];
    calls.setStaffed(0, true);
    const s = hub.answer(0)!;
    expect(s.transcript.length).toBeGreaterThan(0);
    const first = s.transcript[0]!;
    expect(first.who).toBe('caller');
    expect(first.shown).toBe(0);
    hub.tick(0.2);
    expect(first.shown).toBeGreaterThan(0);
    expect(first.shown).toBeLessThan(first.text.length);
    run((dt) => hub.tick(dt), 20);
    expect(s.speaking).toBe(false);
    expect(s.transcript.every((l) => l.shown === l.text.length)).toBe(true);
  });

  it('teilt vier Karten aus, „Andere Karten“ zeigt neue Kategorien, Eingaben werden mit Vertrauensänderung protokolliert', () => {
    const { calls, hub } = setup();
    calls.scripted = ['hildegard'];
    calls.setStaffed(0, true);
    const s = hub.answer(0)!;
    expect(s.hand).toHaveLength(4);
    const before = s.hand.map((c) => c.category);
    s.deal(true);
    expect(s.hand.filter((c) => before.includes(c.category)).length).toBeLessThan(4);
    hub.say(0, 'Guten Tag, Frau Sonnenschein! Wie geht es Ihrer Katze?', 'typed');
    const player = s.transcript.find((l) => l.who === 'player')!;
    expect(player.dTrust).toBeGreaterThan(0);
    // Die Antwort des Anrufers steht nach der Spielerzeile.
    expect(s.transcript.at(-1)!.who).toBe('caller');
  });

  it('Beute wird automatisch für den Notizblock erfasst', () => {
    const { calls, hub, captures } = setup();
    calls.scripted = ['hildegard'];
    calls.setStaffed(0, true);
    hub.answer(0);
    calls.conversation(0)!.trust = 95;
    hub.say(0, 'Bitte lesen Sie mir Ihre Bürgernummer vor.', 'typed');
    expect(captures).toHaveLength(1);
    expect(captures[0]!.loot.kind).toBe('nummer');
    expect(hub.session(0)!.record?.outcome).toBe('success');
  });

  it('Auflegen schneidet den Anrufer mitten im Satz ab', () => {
    const { calls, hub } = setup();
    calls.scripted = ['jacqueline'];
    calls.setStaffed(0, true);
    const s = hub.answer(0)!;
    hub.tick(0.3);
    hub.hangUp(0);
    expect(s.record?.outcome).toBe('playerHangup');
    expect(s.speaking).toBe(false);
    const last = s.transcript.at(-1)!;
    expect(last.text.endsWith('–')).toBe(true);
    expect(s.transcript.every((l) => l.shown === l.text.length)).toBe(true);
    hub.dismiss(0);
    expect(hub.session(0)).toBeNull();
  });
});

describe('Notizblock', () => {
  it('neueste zuerst, erfasste Beute nicht doppelt, Löschen', () => {
    const nb = new Notebook(3);
    let changes = 0;
    nb.onChange(() => changes++);
    nb.add('Erste', null);
    nb.add('Bürgernummer: AB 12 34 56', 'rosi');
    expect(nb.add('Bürgernummer: AB 12 34 56', 'rosi')).toBeNull();
    nb.add('  Dritte   Notiz ', null);
    nb.add('Vierte', null);
    expect(nb.notes.map((n) => n.text)).toEqual(['Vierte', 'Dritte Notiz', 'Bürgernummer: AB 12 34 56']);
    nb.remove(nb.notes[0]!.id);
    expect(nb.notes).toHaveLength(2);
    expect(changes).toBe(5);
  });
});

describe('Sprachausgabe-Text', () => {
  it('ohne Regieanweisungen, mit ausgeschriebener Währung', () => {
    expect(speechSegments('[Ein Hund bellt.] Das kostet 25 ₮ …  wirklich!')).toEqual([{ text: 'Das kostet 25 Taler , wirklich!', speaker: null }]);
  });

  it('Lautsprecher-Familie: ein Abschnitt je Sprecher', () => {
    const segs = speechSegments('Mama: Wer ist da? Papa: Lass mich mal! Jannik: Ist das ein Gewinnspiel?', ['Mama', 'Papa', 'Jannik']);
    expect(segs.map((s) => s.speaker)).toEqual(['Mama', 'Papa', 'Jannik']);
    expect(segs[1]!.text).toBe('Lass mich mal!');
  });

  it('Brabbeln: Vokale als Silben, Satzzeichen als Pause', () => {
    const syl = babbleSyllables('Hallo, du!');
    expect(syl.filter((v) => v >= 0)).toHaveLength(3);
    expect(syl).toContain(-1);
  });

  it('rät das Geschlecht einer Systemstimme aus dem Namen', () => {
    expect(guessFemale('Microsoft Katja Online')).toBe(true);
    expect(guessFemale('Google Deutsch Stefan')).toBe(false);
    expect(guessFemale('eSpeak de')).toBeNull();
  });
});

describe('Inhalte', () => {
  it('jede Schnellantwort-Karte löst ihre Kategorie aus und fordert/beleidigt nicht ungewollt', () => {
    for (const cat of CARD_CATEGORIES) {
      const texts = i18n.list(`cards.${cat}`);
      expect(texts.length, cat).toBeGreaterThan(0);
      for (const text of texts) {
        const f = understand(text, { callerNames: ['Hildegard', 'Sonnenschein'] });
        const [kind, sub] = cat.split('.') as [string, string | undefined];
        let ok: boolean;
        if (kind === 'introduce') ok = f.roleClaims.includes(sub as never);
        else if (kind === 'demand') ok = f.demands.includes(sub as never);
        else if (kind === 'topic') ok = f.topics.includes(sub as never);
        else if (kind === 'ask') ok = f.question;
        else if (kind === 'smalltalk') ok = (f.intents.smalltalk ?? 0) > 0 || f.topics.length > 0;
        else ok = ((f.intents as Record<string, number>)[kind] ?? 0) > 0;
        expect(ok, `${cat}: ${text}`).toBe(true);
        if (kind !== 'demand') expect(f.demands, `${cat}: ${text}`).toEqual([]);
        if (kind !== 'insult') expect(f.intents.insult ?? 0, `${cat}: ${text}`).toBe(0);
        expect(f.nonsense, `${cat}: ${text}`).toBe(0);
      }
    }
  });

  it('jeder Anrufer hat Name, Kurzname, Steckbrief und eigene Zeilen für alle wichtigen Lagen', () => {
    const own = ['answer', 'react.greet.pos', 'react.compliment.pos', 'react.insult.neg', 'demand.early', 'end.success', 'hangup.trust', 'silence.1', 'hold.start'];
    for (const c of CALLERS) {
      for (const f of ['name', 'short', 'bio']) expect(i18n.has(`callers.${c.id}.${f}`), `${c.id}.${f}`).toBe(true);
      for (const sit of own) expect(i18n.list(`callers.${c.id}.lines.${sit}`).length, `${c.id}: ${sit}`).toBeGreaterThan(0);
      for (const t of c.likes) expect(i18n.list(`callers.${c.id}.like.${t}`).length, `${c.id} mag ${t}`).toBeGreaterThan(0);
      for (const t of c.dislikes) expect(i18n.list(`callers.${c.id}.dislike.${t}`).length, `${c.id} hasst ${t}`).toBeGreaterThan(0);
    }
  });

  it('jede Situation der Engine hat für jeden Anrufer einen Text, Platzhalter werden ersetzt', () => {
    const situations = [
      'answer', 'contradiction.name', 'contradiction.role', 'demand.agree', 'demand.early', 'end.farewell', 'end.success',
      'hold.back', 'hold.backLong', 'hold.start', 'react.echo', 'react.name', 'react.nonsense', 'react.nonsenseAmused', 'react.neutral',
      'react.question', 'react.repeat', 'react.shouting', 'react.monologue', 'silence.1', 'silence.2', 'topic.like', 'topic.dislike',
      ...['trust', 'angry', 'patience', 'hold', 'contradiction'].map((r) => `hangup.${r}`),
      ...MOODS.map((m) => `mood.${m}`),
      ...DEMANDS.map((d) => `loot.${d}`),
      ...['tv', 'hund', 'baustelle', 'kaffee', 'wind', 'radio', 'kinder'].map((n) => `noise.${n}`),
      ...['greet', 'introduce', 'smalltalk', 'compliment', 'empathy', 'urgency', 'threat', 'calm', 'explain', 'confirm', 'deny', 'insult', 'apology', 'laugh', 'thanks', 'promise'].flatMap((i) => [`react.${i}.pos`, `react.${i}.neg`]),
      ...['role.pos', 'role.neg'],
    ];
    const params = { role: ROLES[0], newRole: ROLES[1], name: 'Herr Huber', newName: 'Frau Kim', topic: 'katzen', echo: 'Mondgrundstück', loot: 'AB 12 34 56', demand: 'nummer' };
    for (const c of CALLERS) {
      const picker = new LinePicker(c.id, new Rng(1), i18n);
      for (const sit of situations) {
        const text = picker.text({ situation: sit, params });
        expect(text, `${c.id}: ${sit}`).not.toBe('');
        expect(text, `${c.id}: ${sit}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('über 1.500 Anrufer-Zeilen (FUN-02)', () => {
    const lines = collectStrings((DE['callers'] as Dict) ?? {}).length + collectStrings((DE['calls'] as Dict)['lines'] as Dict).length;
    expect(lines).toBeGreaterThan(1500);
  });

  it('Kartendeck berücksichtigt Themen, zu denen der Anrufer eine Meinung hat', () => {
    const deck = new CardDeck(new Rng(5), (k) => i18n.list(k));
    let hinted = 0;
    for (let i = 0; i < 60; i++) {
      const hand = deck.deal({ turns: 3, trust: 40, threshold: 60, mood: 'neutral', role: 'bank', hints: ['katzen', 'krypto'] });
      if (hand.some((c) => c.category === 'topic.katzen' || c.category === 'topic.krypto')) hinted++;
    }
    expect(hinted).toBeGreaterThan(15);
  });
});
