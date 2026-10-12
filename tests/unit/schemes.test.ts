import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { CALLERS, callerById } from '../../src/data/callers';
import { SCHEMES, schemeById } from '../../src/data/schemes';
import { i18n } from '../../src/i18n';
import { CallManager } from '../../src/systems/calls/CallManager';
import { Dossier } from '../../src/systems/calls/dossier';
import { LootLedger, normalizeCode } from '../../src/systems/calls/ledger';
import { dayFactor, payoutFor } from '../../src/systems/calls/payout';
import { PhoneHub } from '../../src/systems/calls/PhoneHub';
import { Conversation, makeVariant, PHASES, type Loot } from '../../src/systems/conversation/engine';
import { understand } from '../../src/systems/conversation/nlu';
import { Plauder } from '../../src/systems/os/plauder';
import { Rng } from '../../src/systems/rng/rng';

const NLU = { callerNames: [] };

/** Gespräch mit Masche und festem Start-Vertrauen (Tagesform ausgeschaltet). */
function talk(id: string, schemeId: string | null, trust?: number, seed = 1): Conversation {
  const rng = new Rng(seed);
  const v = { ...makeVariant(rng), trustShift: 0, noise: 'none' as const };
  const c = new Conversation(callerById(id)!, rng, v);
  if (trust !== undefined) c.trust = trust;
  c.answer();
  if (schemeId) c.setScheme(schemeById(schemeId)!);
  return c;
}
const sits = (c: Conversation, text: string): string[] => c.say(text).lines.map((l) => l.situation);

describe('Maschen-Daten', () => {
  it('16 Maschen mit Texten, gültigen Fans/Skeptikern und Auszahlung', () => {
    expect(SCHEMES).toHaveLength(16);
    const ids = new Set(CALLERS.map((c) => c.id));
    for (const s of SCHEMES) {
      expect(i18n.has(`schemes.${s.id}.name`), s.id).toBe(true);
      expect(i18n.has(`schemes.${s.id}.app`), s.id).toBe(true);
      for (const p of PHASES) expect(i18n.has(`schemes.${s.id}.guide.${p}`), `${s.id} ${p}`).toBe(true);
      expect(i18n.list(`schemes.${s.id}.cards.pitch`).length).toBeGreaterThanOrEqual(4);
      expect(i18n.list(`schemes.${s.id}.cards.demand`).length).toBeGreaterThanOrEqual(1);
      for (const id of [...s.fans, ...s.skeptics]) expect(ids.has(id), `${s.id}: ${id}`).toBe(true);
      expect(s.payout[0]).toBeLessThanOrEqual(s.payout[1]);
    }
  });

  it('jede Pitch-Karte löst ihre Masche aus, jede Forderungs-Karte die erwartete Forderung', () => {
    for (const s of SCHEMES) {
      for (const card of i18n.list(`schemes.${s.id}.cards.pitch`)) expect(understand(card, NLU).schemes, card).toContain(s.id);
      i18n.list(`schemes.${s.id}.cards.demand`).forEach((card, i) => {
        const want = s.demands[Math.min(i, s.demands.length - 1)]!;
        expect(understand(card, NLU).demands, card).toContain(want);
      });
    }
  });
});

describe('Gesprächsphasen und Pitch (CAL-14)', () => {
  it('Einstieg → Vertrauen → Pitch → Forderung → Beute → Abschluss', () => {
    const c = talk('rosi', 'atlantis', 20);
    expect(c.phase).toBe('einstieg');
    c.say('Guten Tag, hier ist die Lottogesellschaft Schwindelheim.');
    c.say('Wie war denn Ihre letzte Kreuzfahrt?');
    expect(['vertrauen', 'pitch']).toContain(c.phase);
    c.trust = Math.max(c.trust, c.pitchTrust + 5);
    expect(sits(c, 'Sie haben in der Unterwasser-Lotterie von Atlantis gewonnen!')).toContain('scheme.pitch.pos');
    expect(c.phase).toBe('forderung');
    c.trust = 95;
    c.say('Bitte bezahlen Sie die kleine Gebühr und nennen Sie mir den Zahlungs-Code.');
    expect(c.phase).toBe('beute');
    expect(c.loot?.schemeId).toBe('atlantis');
    c.tick(TUNING.calls.lootPhaseSeconds + 0.5);
    expect(c.phase).toBe('ende');
    c.say('Vielen Dank und auf Wiederhören!');
    expect(c.outcome).toBe('success');
  });

  it('zu früh erzählt wirkt unglaubwürdig, Forderung ohne Geschichte: „Wofür?“', () => {
    const early = talk('dietmar', 'atlantis', 5);
    expect(sits(early, 'Sie haben in der Unterwasser-Lotterie von Atlantis gewonnen!').some((s) => s === 'scheme.pitch.neg' || s === 'scheme.pitch.early')).toBe(true);
    const why = talk('rosi', 'atlantis', 90);
    expect(sits(why, 'Bitte bezahlen Sie die Gebühr.')).toContain('scheme.why');
    expect(why.loots).toHaveLength(0);
  });

  it('Fans glauben früher, Skeptiker später (SCH-17)', () => {
    const fan = talk('hildegard', 'rentennummer', 50);
    const skeptic = talk('zoe', 'rentennummer', 50);
    expect(fan.affinity).toBe(1);
    expect(skeptic.affinity).toBe(-1);
    expect(fan.pitchTrust).toBeLessThan(skeptic.pitchTrust);
    expect(fan.thresholdFor('nummer')).toBe(fan.threshold - TUNING.calls.fanBonus);
    expect(skeptic.thresholdFor('nummer')).toBe(skeptic.threshold + TUNING.calls.skepticMalus);
    expect(fan.thresholdFor('code')).toBe(fan.threshold + TUNING.calls.demandOffset.code - TUNING.calls.fanBonus);
  });
});

describe('Diktat (CAL-15)', () => {
  it('liest Stück für Stück vor; Versprecher werden korrigiert und so notiert', () => {
    let slips = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = talk('rosi', null, 95, seed);
      const r = c.say('Bitte lesen Sie mir Ihre Bürgernummer vor.');
      const loot = r.loot!;
      const s = r.lines.map((l) => l.situation);
      expect(s[0]).toBe('demand.agree');
      expect(s).toContain('dictate.start');
      const groups = loot.value.split(/[\s-]+/);
      expect(s.filter((x) => x === 'dictate.chunk' || x === 'dictate.slip')).toHaveLength(groups.length);
      // Was notiert wird: richtige Stücke, Versprecher mit der Korrektur in Klammern.
      const fixed = loot.heard.replace(/\S+ \((\S+)\)/g, '$1');
      expect(fixed.replace(/\s/g, '')).toBe(loot.value.replace(/[\s-]/g, ''));
      if (s.includes('dictate.slip')) slips++;
    }
    expect(slips).toBeGreaterThan(0);
  });

  it('sorgfältige Anrufer versprechen sich nie und wiederholen alles', () => {
    const c = talk('hildegard', null, 95);
    const s = sits(c, 'Bitte lesen Sie mir Ihre Bürgernummer vor.');
    expect(s).not.toContain('dictate.slip');
    expect(s).toContain('loot.nummer');
  });

  it('auf Nachfrage wird wiederholt, beim dritten Mal genervt', () => {
    const c = talk('rosi', null, 95);
    c.say('Bitte lesen Sie mir Ihre Bürgernummer vor.');
    const p0 = c.patience;
    expect(sits(c, 'Können Sie das bitte noch einmal wiederholen?')).toEqual(['dictate.repeat']);
    expect(c.patience).toBeLessThan(p0);
    c.say('Wie bitte? Nochmal, bitte.');
    expect(sits(c, 'Bitte ganz langsam wiederholen.')).toEqual(['dictate.repeatAnnoyed']);
  });

  it('Gutschein: mit Betrag', () => {
    const c = talk('hildegard', 'gutschein', 95);
    c.trust = 99;
    c.say('Gehen Sie zum Kiosk und begleichen Sie das mit Gutscheinkarten.');
    const r = c.say('Lesen Sie mir bitte den Gutscheincode vor.');
    expect(r.loot?.kind).toBe('gutschein');
    expect(r.loot?.amount).toBeGreaterThanOrEqual(80);
    expect(r.lines.map((l) => l.situation)).toContain('dictate.amount');
  });
});

describe('Besondere Maschen', () => {
  it('Goldfisch-Finanzamt: erst Bürgernummer, dann Gutschein', () => {
    const c = talk('detlef', 'goldfisch', 99);
    c.say('Hier ist das Finanzamt: Ihre Goldfischsteuer ist fällig.');
    expect(c.nextDemand).toBe('nummer');
    c.trust = 99;
    c.say('Nennen Sie mir bitte Ihre Bürgernummer.');
    expect(c.loots.map((l) => l.kind)).toEqual(['nummer']);
    expect(c.nextDemand).toBe('gutschein');
    c.tick(TUNING.calls.lootPhaseSeconds + 0.5);
    expect(c.phase).toBe('forderung');
    c.trust = 99;
    c.say('Lesen Sie mir jetzt bitte den Gutscheincode vor.');
    expect(c.loots.map((l) => l.kind)).toEqual(['nummer', 'gutschein']);
    expect(c.nextDemand).toBeNull();
  });

  it('Luftgitarren-Abo: drei Mal „Ja“, erst das dritte zählt', () => {
    const c = talk('bodo', 'abo', 99);
    c.say('Sie bekommen einen Probemonat Luftgitarren-Unterricht, Sie werden ein Rockstar!');
    for (let i = 0; i < 2; i++) {
      c.trust = 99;
      c.say('Sagen Sie einfach Ja.');
      expect(c.loots).toHaveLength(0);
    }
    c.trust = 99;
    const s = sits(c, 'Sagen Sie einfach Ja.');
    expect(s).toContain('jawort.more');
    expect(c.loots.map((l) => l.kind)).toEqual(['jawort']);
  });

  it('Turbo-Geschenk: ohne Geschenk kein Code, danach schon (SCH-03)', () => {
    const c = talk('bodo', 'turbo', 99);
    c.say('Sie haben ein Turbo-Geschenk in der Plauderbude gewonnen!');
    c.trust = 99;
    expect(sits(c, 'Lesen Sie mir bitte Ihren Code vor.')).toContain('gift.missing');
    expect(c.gift().lines.map((l) => l.situation)).toEqual(['gift.received']);
    expect(c.gift().lines).toHaveLength(0);
    c.trust = 99;
    c.say('Lesen Sie mir bitte Ihren Code vor.');
    expect(c.loot?.kind).toBe('code');
    expect(c.loot?.schemeId).toBe('turbo');
  });

  it('Fernzugriff: verdächtige Klicks und gierige Überweisungen kosten Vertrauen (SCH-22)', () => {
    const c = talk('hildegard', 'ferngucker', 80);
    expect(c.remote('ok').trustDelta).toBe(0);
    const t0 = c.trust;
    expect(c.remote('suspicious').lines[0]!.situation).toBe('remote.suspicious');
    expect(c.trust).toBeLessThan(t0);
    const big = c.remote('transferBig', 800);
    expect(big.lines[0]).toEqual({ situation: 'remote.transferBig', params: { amount: 800 } });
    expect(big.trustDelta).toBeLessThan(-5);
  });
});

describe('Beute-Buch und Auszahlung (SCH-19/20)', () => {
  const base = { callId: 1, desk: 0, callerId: 'hildegard', kind: 'nummer' as const, value: 'SV 49-18 45', amount: 250 };

  it('Eingabe egal ob klein, mit Leerzeichen oder Strichen; zahlt aus', () => {
    expect(normalizeCode(' sv49 18-45 ')).toBe('SV491845');
    const l = new LootLedger();
    const paid: number[] = [];
    l.onPaid((i) => paid.push(i.amount));
    l.add({ ...base, schemeId: 'rentennummer', input: 'identomat' });
    expect(l.submit('identomat', 'sv 491845')).toMatchObject({ ok: true });
    expect(paid).toEqual([250]);
    // Falsche App: nichts.
    l.add({ ...base, callId: 2, schemeId: 'rentennummer', input: 'identomat' });
    expect(l.submit('gutschein', 'SV491845')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('dreimal vertippt: gesperrt, die Beute ist futsch', () => {
    const l = new LootLedger();
    l.add({ ...base, schemeId: 'rentennummer', input: 'identomat' });
    expect(l.submit('identomat', 'XX')).toMatchObject({ ok: false, reason: 'unknown', attemptsLeft: 2 });
    expect(l.submit('identomat', 'YY')).toMatchObject({ ok: false, attemptsLeft: 1 });
    expect(l.submit('identomat', 'ZZ')).toMatchObject({ ok: false, reason: 'locked' });
    expect(l.items[0]!.status).toBe('failed');
    expect(l.submit('identomat', 'SV491845')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('Köder fliegen auf, FernGucker zahlt erst nach der Überweisung, Mitschnitte sofort', () => {
    const l = new LootLedger();
    l.add({ ...base, schemeId: 'turbo', kind: 'code', input: 'plauderbude', bait: true });
    expect(l.submit('plauderbude', base.value)).toMatchObject({ ok: false, reason: 'bait' });
    const fern = l.add({ ...base, callId: 3, schemeId: 'ferngucker', kind: 'code', value: '123 456', amount: 0, input: 'ferngucker' })!;
    expect(l.submit('ferngucker', '123456')).toMatchObject({ ok: true });
    expect(fern.status).toBe('pending');
    l.pay(fern, 400);
    expect(fern).toMatchObject({ status: 'paid', amount: 400 });
    const abo = l.add({ ...base, callId: 4, schemeId: 'abo', kind: 'jawort', value: 'ja ja ja', amount: 350, input: 'auto' })!;
    expect(abo.status).toBe('paid');
  });

  it('Auszahlung: Spanne, Anteil bei zwei Forderungen, Tages- und Schwierigkeits-Zuschlag', () => {
    const rng = new Rng(1);
    const loot = (kind: Loot['kind'], amount?: number): Loot => ({ kind, value: 'X', schemeId: null, heard: 'X', ...(amount ? { amount } : {}) });
    const hilde = callerById('hildegard')!;
    expect(payoutFor(schemeById('rentennummer')!, loot('nummer'), hilde, 1, rng)).toBe(Math.round((250 * TUNING.payout.difficulty[hilde.difficulty]) / 5) * 5);
    expect(payoutFor(schemeById('ferngucker')!, loot('code'), hilde, 1, rng)).toBe(0);
    expect(payoutFor(schemeById('gutschein')!, loot('gutschein', 120), hilde, 1, rng)).toBe(Math.round((120 * TUNING.payout.difficulty[hilde.difficulty]) / 5) * 5);
    const gold = payoutFor(schemeById('goldfisch')!, loot('nummer'), hilde, 1, rng);
    expect(gold).toBeLessThanOrEqual(Math.ceil((750 / 2) * TUNING.payout.difficulty[hilde.difficulty]) + 5);
    expect(dayFactor(5)).toBeGreaterThan(dayFactor(1));
  });
});

describe('Kundenkartei und Vorauswahl', () => {
  it('merkt sich Vorlieben, Abneigungen und Lieblingsmaschen', () => {
    const d = new Dossier();
    const c = talk('hildegard', 'rentennummer', 60);
    d.met('hildegard');
    d.observe('hildegard', c.say('Backen Sie gern Streuselkuchen?'));
    d.observe('hildegard', c.say('Ihre Rentenerhöhung ist da, das Rentenamt zahlt nach.'));
    d.observe('hildegard', c.say('Investieren Sie doch in Krypto!'));
    const e = d.get('hildegard')!;
    expect([...e.likes]).toContain('kuchen');
    expect([...e.dislikes]).toContain('krypto');
    expect([...e.fans]).toContain('rentennummer');
    expect(e.calls).toBe(1);
    expect(d.ids()).toEqual(['hildegard']);
  });

  it('Masche vor dem Abheben wählen: gilt für den nächsten Anruf', () => {
    const calls = new CallManager(new Rng(3), CALLERS, 8);
    const hub = new PhoneHub(calls, CALLERS, i18n, () => undefined);
    calls.scripted = ['hildegard'];
    calls.setStaffed(0, true);
    hub.setScheme(0, schemeById('mond')!);
    expect(hub.scheme(0)?.id).toBe('mond');
    hub.answer(0);
    expect(calls.conversation(0)!.scheme?.id).toBe('mond');
    hub.setScheme(0, null);
    expect(calls.conversation(0)!.scheme).toBeNull();
  });
});

describe('Plauderbude', () => {
  it('Freunde schicken regelmäßig Spam, Gelesenes zählt nicht mehr', () => {
    const p = new Plauder(new Rng(2), ['a', 'b'], () => ['Kettenbrief!']);
    expect(p.chats.map((c) => c.messages.length)).toEqual([1, 1]);
    let got = 0;
    for (let t = 0; t < TUNING.plauder.spamEvery[1] * 3; t += 1) if (p.tick(1)) got++;
    expect(got).toBeGreaterThanOrEqual(2);
    const chat = p.chats.find((c) => c.unread > 0)!;
    p.read(chat.handle);
    expect(chat.unread).toBe(0);
    for (let i = 0; i < 30; i++) p.add('a', { from: 'them', text: 'x' });
    expect(p.chat('a').messages.length).toBe(TUNING.plauder.keep);
  });
});
