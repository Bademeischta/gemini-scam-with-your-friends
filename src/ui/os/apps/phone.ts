import Phaser from 'phaser';
import { hex, PALETTE } from '../../../config/palette';
import { callerById } from '../../../data/callers';
import { FONT_CELL_HEIGHT } from '../../../gfx/fontGlyphs';
import { portraitTexture } from '../../../gfx/phaserTextures';
import { t } from '../../../i18n';
import type { CallSession } from '../../../systems/calls/PhoneHub';
import type { Card } from '../../../systems/conversation/cards';
import { PHASES } from '../../../systems/conversation/engine';
import type { Mood } from '../../../systems/conversation/types';
import { SpeechInput, micIssueFor, type MicIssue } from '../../../systems/voice/SpeechInput';
import { PixelLabel } from '../../PixelLabel';
import { ChatLog, OsCard } from '../callWidgets';
import type { Rect } from '../focusNav';
import { TextInputBridge, type TextInputOptions } from '../TextInputBridge';
import { BODY_FONT, controlHeight, fitLabel, OsButton, OsList, type ListItem } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

type Mode = 'idle' | 'ringing' | 'call' | 'ended';
/** Anzeige am Sprechen-Knopf: bereit, hört zu, wertet aus, Fehler (dann Tastatur-Diktat). */
type MicState = 'idle' | 'listening' | 'processing' | 'error';

const CARD_ACTIONS = ['card1', 'card2', 'card3', 'card4'] as const;

/** Gute Stimmungen (für den Hinweiston beim Kippen). */
const GOOD_MOODS: ReadonlySet<Mood> = new Set(['vertrauensvoll', 'amuesiert', 'neutral']);

/**
 * Telefon-App (APP-01, CAL-03, HUD-02): Porträt mit Stimmung, Vertrauen in %, Geduld und Phase,
 * Untertitel-Verlauf, vier Schnellantwort-Karten (auf dem Handy die Hauptsteuerung), Texteingabe,
 * Halten-zum-Sprechen, Halten (Warteschleife), Lautsprecher und Auflegen. Ohne Anruf: Anrufliste.
 */
class PhoneView implements AppView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly name: PixelLabel;
  private readonly status: PixelLabel;
  private readonly phase: PixelLabel;
  private readonly delta: PixelLabel;
  private readonly chat: ChatLog;
  private readonly cards: OsCard[];
  private readonly reroll: OsButton;
  private readonly schemeBtn: OsButton;
  private readonly send: OsButton;
  private readonly mic: OsButton;
  private readonly holdBtn: OsButton;
  private readonly speakerBtn: OsButton;
  private readonly kbdBtn: OsButton;
  private readonly hangup: OsButton;
  private readonly answerBtn: OsButton;
  private readonly declineBtn: OsButton;
  private readonly doneBtn: OsButton;
  private readonly history: OsList;
  private readonly info: Phaser.GameObjects.Text;
  private readonly live: Phaser.GameObjects.Text;
  private readonly bridge = TextInputBridge.get();
  private readonly inputOpts: TextInputOptions = {
    placeholder: t('calls.phone.placeholder'),
    maxLength: 160,
    onSubmit: (text) => this.say(text, 'typed'),
    onEmptyKey: (key) => {
      const i = ['1', '2', '3', '4'].indexOf(key);
      if (i < 0 || this.mode !== 'call') return false;
      this.playCard(i);
      return true;
    },
  };
  private size = { w: 0, h: 0 };
  private mode: Mode = 'idle';
  private session: CallSession | null = null;
  private hand: readonly Card[] = [];
  private inputRect: Rect | null = null;
  private headerRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private lastTrust: number | null = null;
  private lastMood: Mood | null = null;
  private deltaTime = 0;
  private listening = false;
  private micState: MicState = 'idle';
  /** Grund, warum die Spracherkennung nicht geht (bleibt bis zum nächsten Anruf; dann Tastatur-Diktat). */
  private micIssue: MicIssue | null = null;
  private interim = '';
  /** Zeile über dem Verlauf: Mikrofon-Status, „überlegt …“, Hinweise zur KI. */
  private micText = '';
  private noticeText = '';
  private noticeTime = 0;
  private readonly offHub: () => void;
  private historyCount = -1;
  /** Neuer Anruf mit Tastatur: Eingabefeld fokussieren, sobald es steht. */
  private pendingFocus = false;
  /** Zuhören wurde per Taste (V/RT) gestartet und endet beim Loslassen der Taste. */
  private pttByKey = false;

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const id = ctx.win.id;
    const sc = host.scene;
    const u = host.u();
    this.g = sc.add.graphics();
    this.portrait = sc.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    host.container.add([this.g, this.portrait]);
    const label = (color: 'white' | 'fog' | 'mustard') => new PixelLabel(sc, '', { scale: u, color, shadow: null, container: host.container });
    this.name = label('white');
    this.status = label('white');
    this.phase = label('fog');
    this.delta = label('mustard');
    this.chat = new ChatLog(host, `${id}:chat`);
    this.cards = [0, 1, 2, 3].map((i) => new OsCard(host, `${id}:card:${i}`, String(i + 1), () => this.playCard(i)));
    this.reroll = new OsButton(host, `${id}:reroll`, { label: t('calls.phone.reroll'), icon: 'os-icon-reroll', onClick: () => this.rerollCards() });
    this.schemeBtn = new OsButton(host, `${id}:scheme`, { label: t('calls.phone.scheme'), icon: 'os-icon-scheme', onClick: () => this.openScheme() });
    this.send = new OsButton(host, `${id}:send`, { icon: 'os-icon-send', variant: 'primary', onClick: () => this.submitTyped() });
    this.mic = new OsButton(host, `${id}:mic`, {
      label: t('calls.phone.mic'),
      icon: 'os-icon-mic',
      onClick: () => this.micClick(),
      onDown: () => this.micDown(),
      onRelease: () => this.micUp(),
    });
    this.holdBtn = new OsButton(host, `${id}:hold`, { label: t('calls.phone.hold'), icon: 'os-icon-hold', onClick: () => this.toggleHold() });
    this.speakerBtn = new OsButton(host, `${id}:speaker`, { label: t('calls.phone.speaker'), icon: 'os-icon-speaker', onClick: () => this.toggleSpeaker() });
    this.kbdBtn = new OsButton(host, `${id}:kbd`, { label: t('calls.phone.keyboard'), icon: 'os-icon-keyboard', onClick: () => this.toggleTyping() });
    this.hangup = new OsButton(host, `${id}:hangup`, { label: t('calls.phone.hangup'), icon: 'os-icon-hangup', onClick: () => this.hangUp() });
    this.answerBtn = new OsButton(host, `${id}:answer`, { label: t('calls.popup.answer'), icon: 'os-icon-answer', variant: 'primary', onClick: () => this.answer() });
    this.declineBtn = new OsButton(host, `${id}:decline`, { label: t('calls.popup.decline'), icon: 'os-icon-hangup', onClick: () => this.decline() });
    this.doneBtn = new OsButton(host, `${id}:done`, { label: t('calls.phone.done'), variant: 'primary', onClick: () => this.dismiss() });
    this.history = new OsList(host, `${id}:history`);
    this.info = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '14px', align: 'center' }).setOrigin(0.5, 0);
    this.live = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.mustard, fontSize: '13px', fontStyle: 'italic' });
    host.container.add([this.info, this.live]);
    // KI fällt auf die lokale Engine zurück: kurz Bescheid geben, warum.
    this.offHub = this.hub.on((e) => {
      if (e.type !== 'aiFallback' || e.desk !== this.desk) return;
      this.notice(t(`calls.phone.ai.${e.error}`));
      if (e.session.engine === 'local') this.ctx.os.toast({ icon: 'phone', title: t('calls.phone.ai.fallbackTitle'), body: t(`calls.phone.ai.${e.error}`) });
    });
    this.syncMode(true);
  }

  // ------------------------------------------------------------------ AppView

  layout(w: number, h: number): void {
    this.size = { w, h };
    this.relayout();
  }

  update(dt: number): void {
    this.syncMode(false);
    for (const c of this.cards) c.update(dt);
    const s = this.session;
    if (s) this.chat.sync(s.transcript);
    if (this.mode === 'call' || this.mode === 'ended') this.syncHeader(dt);
    if (this.mode === 'idle') this.syncHistory();
    if (this.mode === 'call' && s && s.hand !== this.hand) this.syncCards();
    this.handleActions();
    this.syncLive(dt);
    this.placeInput();
    if (this.pendingFocus && this.bridge.ownedBy === this && this.bridge.visible) {
      this.pendingFocus = false;
      this.bridge.focus(this);
    }
  }

  onTyped(keys: readonly string[]): boolean {
    if (this.mode !== 'call' || !this.inputRect || this.bridge.focused) return false;
    // Einfach lostippen: Buchstaben springen ins Eingabefeld.
    const letters = keys.filter((k) => k.length === 1 && /[\p{L}?!.,']/u.test(k));
    if (letters.length === 0) return false;
    this.bridge.setValue(this, this.bridge.value + letters.join(''));
    this.bridge.focus(this);
    return true;
  }

  firstFocus(): string | undefined {
    const id = this.ctx.win.id;
    if (this.mode === 'call') return `${id}:card:0`;
    if (this.mode === 'ringing') return `${id}:answer`;
    if (this.mode === 'ended') return `${id}:done`;
    return `${id}:history`;
  }

  state(): unknown {
    const s = this.session;
    const c = s?.conversation ?? null;
    const d = this.ctx.host.dpr();
    const o = this.ctx.host.origin();
    return {
      mode: this.mode,
      callerId: s?.caller.id ?? null,
      trust: c ? Math.round(c.trust) : null,
      mood: c?.currentMood ?? null,
      phase: c?.phase ?? null,
      scheme: c?.scheme?.id ?? null,
      pitchTrust: c?.scheme ? c.pitchTrust : null,
      need: c?.nextDemand ? c.thresholdFor(c.nextDemand) : null,
      hold: c?.state === 'hold',
      speaker: s?.speaker ?? false,
      speaking: s?.speaking ?? false,
      outcome: s?.record?.outcome ?? null,
      cards: this.mode === 'call' ? this.cards.map((k) => k.label) : [],
      transcript: s?.transcript.map((l) => ({ who: l.who, text: l.text, shown: l.shown, dTrust: l.dTrust ?? null })) ?? [],
      typing: this.inputRect !== null,
      inputRect: this.inputRect ? { x: (o.x + this.inputRect.x) / d, y: (o.y + this.inputRect.y) / d, w: this.inputRect.w / d, h: this.inputRect.h / d } : null,
      listening: this.listening,
      micState: this.micState,
      engine: s?.engine ?? null,
      thinking: s?.thinking ?? false,
      aiNotice: s?.aiNotice ?? null,
      tokens: s ? { input: s.usage.input, output: s.usage.output, requests: s.usage.requests } : null,
      live: this.live.text,
      micIssue: this.micIssue,
      interim: this.interim,
      history: this.history.entries.map((e) => e.id),
    };
  }

  destroy(): void {
    this.offHub();
    this.stopListening(true);
    this.bridge.detach(this);
    for (const b of [this.reroll, this.schemeBtn, this.send, this.mic, this.holdBtn, this.speakerBtn, this.kbdBtn, this.hangup, this.answerBtn, this.declineBtn, this.doneBtn]) b.destroy();
    for (const c of this.cards) c.destroy();
    for (const l of [this.name, this.status, this.phase, this.delta]) l.destroy();
    this.chat.destroy();
    this.history.destroy();
    this.info.destroy();
    this.live.destroy();
    this.portrait.destroy();
    this.g.destroy();
  }

  // ------------------------------------------------------------------ Zustand

  private get desk(): number {
    return this.ctx.os.env.desk;
  }

  private get hub() {
    return this.ctx.os.env.phone;
  }

  private get services() {
    return this.ctx.host.s;
  }

  /** Modus aus dem Zustand des Platzes ableiten; bei Wechsel neu anordnen. */
  private syncMode(force: boolean): void {
    const view = this.hub.calls.view(this.desk);
    const session = this.hub.session(this.desk);
    let mode: Mode;
    if (session && session.active) mode = 'call';
    else if (view.kind === 'ringing') mode = 'ringing';
    else if (session) mode = 'ended';
    else mode = 'idle';
    if (!force && mode === this.mode && session === this.session) return;
    const newCall = session !== this.session;
    this.mode = mode;
    this.session = session;
    if (newCall) {
      this.noticeTime = 0;
      if (session?.aiNotice) this.notice(t(`calls.phone.ai.${session.aiNotice}`));
      this.micIssue = null;
      this.micState = 'idle';
      this.chat.clear();
      this.hand = [];
      this.lastTrust = null;
      this.lastMood = null;
      this.bridge.setValue(this, '');
    }
    if (mode !== 'call') this.stopListening(true);
    this.historyCount = -1;
    this.relayout();
    // Neuer Anruf: Tastatur-Spieler können sofort tippen.
    if (mode === 'call' && newCall && this.services.device.kind === 'keyboard') this.pendingFocus = true;
  }

  private syncHeader(dt: number): void {
    const s = this.session;
    if (!s) return;
    const c = s.conversation;
    const th = this.ctx.host.theme();
    const mood: Mood = c?.currentMood ?? this.lastMood ?? 'neutral';
    this.portrait.setTexture(portraitTexture(this.ctx.host.scene, s.caller, mood));
    const trust = Math.round(c ? c.trust : (s.record?.trust ?? 0));
    if (this.lastTrust !== null && trust !== this.lastTrust) {
      const d = trust - this.lastTrust;
      this.delta.setText(`${d > 0 ? '+' : ''}${d}`).setColor(d > 0 ? 'mint' : 'red');
      this.deltaTime = 1.6;
    }
    if (this.lastMood !== null && mood !== this.lastMood && c) {
      if (GOOD_MOODS.has(mood) && !GOOD_MOODS.has(this.lastMood)) this.services.sfx.moodUp();
      else if (!GOOD_MOODS.has(mood) && GOOD_MOODS.has(this.lastMood)) this.services.sfx.moodDown();
    }
    this.lastTrust = trust;
    this.lastMood = mood;
    this.deltaTime = Math.max(0, this.deltaTime - dt);
    this.delta.setVisible(this.deltaTime > 0 && this.mode === 'call');
    const r = this.headerRect;
    const statusText = t('calls.phone.status', { mood: t(`calls.moods.${mood}`), trust });
    fitLabel(this.status, statusText, Math.max(10, r.w - (this.status.main.x - r.x)));
    this.status.setColor(th.text);
    const phaseText =
      this.mode === 'ended'
        ? t(`calls.outcomeShort.${s.record?.outcome ?? 'hangup'}`)
        : c?.state === 'hold'
          ? t('calls.phone.onHold')
          : c?.scheme
            ? t('calls.phone.phaseScheme', { phase: t(`calls.phase.${c.phase}`), scheme: t(`schemes.${c.scheme.id}.name`), time: clock(c.time) })
            : t('calls.phone.phase', { phase: t(`calls.phase.${c?.phase ?? 'einstieg'}`), time: clock(c?.time ?? 0) });
    const engineTag = this.mode === 'call' && s.engine === 'ai' ? ` · ${t('calls.phone.ai.tag')}` : '';
    fitLabel(this.phase, phaseText + engineTag, Math.max(10, r.w - (this.phase.main.x - r.x)));
    this.phase.setColor(th.textDim);
    this.delta.setPosition(Math.round(this.status.main.x + this.status.width + 3 * this.ctx.host.u()), this.status.main.y);
    this.holdBtn.setActive(c?.state === 'hold');
    this.speakerBtn.setActive(s.speaker).setIcon(s.speaker ? 'os-icon-speakerOn' : 'os-icon-speaker');
    this.mic.setActive(this.listening).setIcon(this.listening ? 'os-icon-micOn' : 'os-icon-mic').setLabel(t(`calls.phone.micState.${this.micState}`));
    const active = this.mode === 'call' && c?.state === 'active';
    for (const k of this.cards) k.setEnabled(active && !s.thinking);
    this.reroll.setEnabled(active && !s.thinking);
    this.schemeBtn.setLabel(c?.scheme ? t(`schemes.${c.scheme.id}.name`) : t('calls.phone.scheme'));
    this.send.setEnabled(active);
    // Immer bedienbar: Geht die Erkennung nicht, führt der Knopf zum Tastatur-Diktat.
    this.mic.setEnabled(active);
    this.drawHeader();
  }

  private syncCards(): void {
    const s = this.session;
    if (!s) return;
    this.hand = s.hand;
    this.cards.forEach((k, i) => k.setCard(s.hand[i]?.text ?? ''));
  }

  private syncHistory(): void {
    const hist = this.hub.calls.history.filter((r) => r.desk === this.desk);
    if (hist.length === this.historyCount) return;
    this.historyCount = hist.length;
    const items: ListItem[] = hist
      .slice(-30)
      .reverse()
      .map((r) => ({
        id: `call-${r.id}`,
        label: t(`callers.${r.callerId}.short`),
        right: r.outcome === 'missed' ? t('calls.outcomeShort.missed') : `${t(`calls.outcomeShort.${r.outcome}`)} · ${r.trust} %`,
        dim: r.outcome === 'missed',
      }));
    this.history.setItems(items);
    this.info.setText(items.length === 0 ? t('calls.phone.noCalls') : '');
  }

  // ------------------------------------------------------------------ Eingaben

  private handleActions(): void {
    const win = this.ctx.win;
    if (!win.active || win.minimized || this.ctx.os.overlayOpen) return;
    const inp = this.services.input;
    if (this.mode === 'call') {
      CARD_ACTIONS.forEach((a, i) => {
        if (inp.justPressed(a)) this.playCard(i);
      });
      if (inp.justPressed('hold')) this.toggleHold();
      if (inp.justPressed('hangup')) this.hangUp();
      // Halten zum Sprechen (V / RT) bzw. Antippen bei Sprachaktivierung.
      const ptt = this.services.settings.get().micMode === 'ptt';
      if (inp.justPressed('talk')) {
        if (ptt) this.startListening();
        else if (this.listening) this.stopListening(false);
        else this.startListening();
      } else if (ptt && this.listening && this.pttByKey && !inp.isDown('talk')) this.stopListening(false);
    } else if (this.mode === 'ringing') {
      if (inp.justPressed('hangup')) this.decline();
    }
  }

  private playCard(i: number): void {
    const s = this.session;
    const card = s?.hand[i];
    if (!s || !card || this.mode !== 'call' || s.conversation?.state !== 'active' || s.thinking) return;
    this.services.sfx.send();
    this.hub.say(this.desk, card.text, 'card', card);
  }

  /** Skript-App der gewählten Masche bzw. die Maschen-Übersicht öffnen (SCH-17). */
  private openScheme(): void {
    const c = this.session?.conversation;
    if (c?.scheme) this.ctx.os.open('script', c.scheme.id);
    else this.ctx.os.open('schemes');
  }

  private rerollCards(): void {
    const s = this.session;
    if (!s || this.mode !== 'call') return;
    s.deal(true);
    this.services.sfx.move();
  }

  private submitTyped(): void {
    const text = this.bridge.value.trim();
    if (!text) {
      this.bridge.focus(this);
      return;
    }
    this.bridge.setValue(this, '');
    this.say(text, 'typed');
  }

  private say(text: string, source: 'typed' | 'voice'): void {
    if (this.mode !== 'call') return;
    this.services.sfx.send();
    this.hub.say(this.desk, text, source);
  }

  private toggleHold(): void {
    const c = this.session?.conversation;
    if (!c || this.mode !== 'call') return;
    this.stopListening(true);
    this.hub.hold(this.desk, c.state !== 'hold');
    this.services.sfx.move();
  }

  private toggleSpeaker(): void {
    const s = this.session;
    if (!s || this.mode !== 'call') return;
    s.speaker = !s.speaker;
  }

  private toggleTyping(): void {
    const st = this.services.settings;
    st.update({ phoneTyping: !st.get().phoneTyping });
    this.relayout();
    if (st.get().phoneTyping) this.bridge.focus(this);
  }

  private hangUp(): void {
    if (this.mode !== 'call') return;
    this.stopListening(true);
    this.hub.hangUp(this.desk);
    this.services.sfx.hangUp();
  }

  private answer(): void {
    if (this.mode !== 'ringing') return;
    this.hub.answer(this.desk);
    this.services.sfx.pickUp();
  }

  private decline(): void {
    if (this.mode !== 'ringing') return;
    this.hub.decline(this.desk);
    this.services.sfx.hangUp();
  }

  private dismiss(): void {
    this.hub.dismiss(this.desk);
    this.services.sfx.back();
  }

  // ------------------------------------------------------------------ Hinweiszeile

  private setMic(text: string): void {
    this.micText = text;
  }

  /** Hinweis für ein paar Sekunden (KI-Status, Rückfall). */
  private notice(text: string): void {
    this.noticeText = text;
    this.noticeTime = 7;
  }

  /** Mikrofon hat Vorrang, dann „überlegt …“, dann Hinweise. */
  private syncLive(dt: number): void {
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    const s = this.session;
    let text = this.mode === 'call' ? this.micText : '';
    if (!text && this.mode === 'call' && s?.thinking) text = t('calls.phone.thinking', { name: t(`callers.${s.caller.id}.short`) });
    if (!text && this.noticeTime > 0 && this.mode === 'call') text = this.noticeText;
    if (text !== this.live.text) this.live.setText(text);
    this.live.setVisible(this.mode === 'call' && text !== '');
  }

  // ------------------------------------------------------------------ Spracheingabe

  /** Grund, warum es gerade nicht geht (Einstellung aus, Browser kann es nicht, früherer Fehler). */
  private micBlocked(): MicIssue | 'off' | null {
    if (!this.services.settings.get().speechInput) return 'off';
    return this.micIssue ?? SpeechInput.diagnose(window);
  }

  /** Touch: Antippen startet und beendet (Safari erlaubt das Mikrofon nur beim Loslassen, nicht beim Drücken). */
  private get tapToTalk(): boolean {
    const d = this.services.device;
    return d.formFactor !== 'desktop' || d.kind === 'touch' || this.services.settings.get().micMode === 'auto';
  }

  private micClick(): void {
    if (!this.tapToTalk) return;
    if (this.listening) this.stopListening(false);
    else this.startListening(true);
  }

  private micDown(): void {
    if (this.tapToTalk) return;
    this.pttByKey = false;
    this.startListening(true);
  }

  private micUp(): void {
    if (!this.tapToTalk && this.listening && !this.pttByKey) this.stopListening(false);
  }

  /** `fromGesture`: direkt aus Klick/Tippen (dann darf der Rückfall das Textfeld samt Tastatur öffnen). */
  private startListening(fromGesture = false): void {
    if (this.listening || this.mode !== 'call' || this.session?.conversation?.state !== 'active') return;
    const blocked = this.micBlocked();
    if (blocked) {
      this.typingFallback(blocked, fromGesture);
      return;
    }
    this.pttByKey = this.services.input.isDown('talk');
    // Wer spricht, unterbricht den Anrufer (laufende Sprachausgabe stört die Erkennung auf dem iPhone).
    this.services.voice.cancel();
    const ok = this.services.speech.start(this.tapToTalk ? 'auto' : 'ptt', {
      interim: (text) => {
        this.interim = text;
        this.setMic(t('calls.phone.hearing', { text }));
      },
      final: (text) => this.say(text, 'voice'),
      end: () => {
        this.listening = false;
        this.interim = '';
        if (this.micState !== 'error') {
          this.micState = 'idle';
          this.setMic('');
        }
      },
      error: (code) => {
        const issue = micIssueFor(code);
        if (!issue) return;
        this.micIssue = issue;
        this.micState = 'error';
        this.setMic(`${t(`calls.phone.micIssue.${issue}`)} ${t('calls.phone.micFallbackTap')}`);
        // Auf dem Handy reicht die Hinweiszeile: Eine Benachrichtigung läge genau über dem Mikrofon-Knopf.
        if (!this.ctx.os.compact) this.ctx.os.toast({ icon: 'mic', title: t('calls.phone.micDeniedTitle'), body: t(`calls.phone.micIssue.${issue}`) });
      },
    });
    if (!ok) {
      this.micIssue = 'failed';
      this.typingFallback('failed', fromGesture);
      return;
    }
    this.listening = true;
    this.micState = 'listening';
    this.setMic(t('calls.phone.listening'));
    this.services.sfx.micOn();
  }

  private stopListening(abort: boolean): void {
    if (!this.listening) return;
    if (abort) this.services.speech.abort();
    else this.services.speech.stop();
    this.services.sfx.micOff();
    if (abort) {
      this.listening = false;
      this.interim = '';
      this.micState = this.micIssue ? 'error' : 'idle';
      this.setMic('');
    } else if (this.micState === 'listening') {
      this.micState = 'processing';
      this.setMic(t('calls.phone.processing'));
    }
  }

  /**
   * Rückfall, wenn die Spracherkennung nicht geht: Grund nennen und das Textfeld öffnen, damit man
   * mit dem Mikrofon der Bildschirmtastatur diktieren kann. Fokus nur aus einer Geste (sonst zeigt
   * iOS keine Tastatur).
   */
  private typingFallback(issue: MicIssue | 'off', fromGesture: boolean): void {
    this.micState = issue === 'off' ? 'idle' : 'error';
    this.setMic(`${t(`calls.phone.micIssue.${issue}`)} ${t('calls.phone.micFallback')}`);
    const st = this.services.settings;
    if (this.ctx.os.compact && !st.get().phoneTyping) {
      st.update({ phoneTyping: true });
      this.relayout();
    }
    this.placeInput();
    if (fromGesture) this.bridge.focus(this);
    else this.pendingFocus = true;
  }

  // ------------------------------------------------------------------ Darstellung

  private typingVisible(): boolean {
    return this.mode === 'call' && (!this.ctx.os.compact || this.services.settings.get().phoneTyping);
  }

  private relayout(): void {
    const { w, h } = this.size;
    if (w <= 0 || h <= 0) return;
    const host = this.ctx.host;
    const u = host.u();
    const d = host.dpr();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const mode = this.mode;
    const wide = w >= h * 1.15;
    const compact = this.ctx.os.compact;

    // Sichtbarkeiten je Modus.
    const inCall = mode === 'call';
    const header = mode !== 'idle';
    this.portrait.setVisible(header);
    for (const l of [this.name, this.status, this.phase]) l.setVisible(header);
    this.delta.setVisible(false);
    this.chat.setVisible(mode === 'call' || mode === 'ended');
    for (const c of this.cards) c.setVisible(inCall);
    for (const b of [this.reroll, this.schemeBtn, this.holdBtn, this.speakerBtn, this.mic, this.hangup]) b.setVisible(inCall);
    this.kbdBtn.setVisible(inCall && compact);
    this.send.setVisible(inCall && this.typingVisible());
    this.answerBtn.setVisible(mode === 'ringing');
    this.declineBtn.setVisible(mode === 'ringing');
    this.doneBtn.setVisible(mode === 'ended');
    this.history.setVisible(mode === 'idle');
    this.info.setVisible(mode === 'idle' || mode === 'ended' || mode === 'ringing');
    this.live.setVisible(inCall);
    this.inputRect = null;

    // Kopf: Porträt + Name + Status + Phase.
    const ps = Math.max(1, Math.min(Math.round(u * 1.5), Math.floor((h * 0.28) / 32)));
    const pw = 32 * ps;
    const leftW = wide ? Math.round(w * 0.55) : w;
    let headerH = header ? pw + 2 * u : 0;
    if (header) {
      const s = this.session;
      const callerId = s?.caller.id ?? (this.hub.calls.view(this.desk) as { callerId?: string }).callerId ?? null;
      const def = callerId ? callerById(callerId) : undefined;
      if (def) this.portrait.setTexture(portraitTexture(host.scene, def, s?.conversation?.currentMood ?? 'neutral'));
      this.portrait.setScale(ps).setPosition(u, u);
      const tx = pw + 5 * u;
      const tw = leftW - tx;
      this.headerRect = { x: tx, y: 0, w: tw, h: headerH };
      fitLabel(this.name, def ? t(`callers.${def.id}.name`) : '', tw);
      this.name.setScale(u).setColor(host.theme().accent).setPosition(tx, 2 * u);
      // Zeilenhöhe fest (Beschriftungen können beim Anordnen noch leer sein).
      const lineH = this.lineHeight();
      this.status.setScale(u).setPosition(tx, 2 * u + lineH + 4 * u);
      // Unter Vertrauens- und Geduldsbalken (siehe drawHeader).
      this.phase.setScale(u).setPosition(tx, Math.round(2 * u + 2 * lineH + 17 * u));
      // Darunter der Fortschritt der Gesprächsphasen (CAL-14).
      headerH = Math.max(headerH, Math.round(this.phase.main.y + lineH + 6 * u));
      this.delta.setScale(u);
      if (mode === 'ringing') {
        this.status.setText(t('calls.popup.title'));
        this.phase.setText('');
      }
    }

    if (mode === 'idle') {
      const listY = 0;
      this.history.layout(0, listY, w, h);
      this.info.setStyle({ fontSize: `${Math.round(14 * d)}px`, color: PALETTE[host.theme().textDim], wordWrap: { width: w - 16 * u } });
      this.info.setPosition(Math.round(w / 2), Math.round(h / 2 - 10 * d));
      this.drawHeader();
      return;
    }

    if (mode === 'ringing') {
      const by = headerH + 2 * gap;
      const bw = (w - gap) / 2;
      const bh = Math.max(ch, Math.min(Math.round(h - by - gap), Math.round(ch * 1.6)));
      this.answerBtn.setIconScale(u).layout(0, by, bw, bh);
      this.declineBtn.setIconScale(u).layout(bw + gap, by, bw, bh);
      this.info.setText(t(`calls.popup.hint.${this.services.device.hintMode}`));
      this.info.setStyle({ fontSize: `${Math.round(13 * d)}px`, color: PALETTE[host.theme().textDim], wordWrap: { width: w - 16 * u } });
      this.info.setPosition(Math.round(w / 2), Math.round(by + bh + gap));
      this.drawHeader();
      return;
    }

    // Rechte Spalte (breit) bzw. untere Hälfte (schmal): Karten und Knöpfe.
    const typing = this.typingVisible();
    const inputH = typing ? ch : 0;
    let chatRect: Rect;
    let panel: Rect;
    if (wide) {
      const rw = w - leftW - gap;
      chatRect = { x: 0, y: headerH + gap, w: leftW, h: h - headerH - gap - (typing ? inputH + gap : 0) };
      panel = { x: leftW + gap, y: 0, w: rw, h };
      if (typing) this.placeInputRow({ x: 0, y: h - inputH, w: leftW, h: inputH });
    } else {
      const panelH = Math.round(h * 0.5);
      chatRect = { x: 0, y: headerH + gap, w, h: h - headerH - panelH - 2 * gap - (typing ? inputH + gap : 0) };
      panel = { x: 0, y: h - panelH - (typing ? inputH + gap : 0), w, h: panelH };
      if (typing) this.placeInputRow({ x: 0, y: h - inputH, w, h: inputH });
    }
    this.chat.layout(chatRect.x, chatRect.y, chatRect.w, Math.max(ch, chatRect.h));
    this.chat.setEmptyText('');
    // Deckender Hintergrund: Die Zeile liegt über dem Verlauf und muss lesbar bleiben.
    this.live.setStyle({ fontSize: `${Math.round(13 * d)}px`, wordWrap: { width: chatRect.w - 12 * u }, backgroundColor: PALETTE[host.theme().windowDark] });
    this.live.setPadding(Math.round(3 * u), Math.round(2 * u), Math.round(3 * u), Math.round(2 * u));
    this.live.setPosition(Math.round(chatRect.x + 2 * u), Math.round(chatRect.y + 2 * u));

    if (mode === 'ended') {
      const s = this.session;
      const rec = s?.record;
      let text = rec ? t(`calls.outcome.${rec.outcome}`) : '';
      const c = rec?.conversation;
      if (rec?.outcome === 'hangup' && c?.reason) text = t(`calls.reason.${c.reason}`);
      if (rec?.outcome === 'success' && c?.loot) text = t('calls.outcome.successLoot', { demand: t(`calls.demands.${c.loot.kind}`), value: c.loot.heard });
      if (rec) text += `\n\n${t('calls.phone.summary', { time: clock(rec.duration), trust: rec.trust })}`;
      this.info.setText(text);
      this.info.setStyle({ fontSize: `${Math.round(15 * d)}px`, color: PALETTE[host.theme().text], wordWrap: { width: panel.w - 8 * u } });
      this.info.setPosition(Math.round(panel.x + panel.w / 2), Math.round(panel.y + (wide ? headerH : 0) + 2 * gap));
      const bh = Math.max(ch, Math.round(ch * 1.3));
      this.doneBtn.layout(panel.x, panel.y + panel.h - bh, panel.w, bh);
      this.drawHeader();
      return;
    }

    // Steuerknöpfe unten im Bereich, darüber „Andere Karten“, darüber die Karten.
    const ctrl = compact ? [this.holdBtn, this.speakerBtn, this.mic, this.kbdBtn, this.hangup] : [this.holdBtn, this.speakerBtn, this.mic, this.hangup];
    const cy = panel.y + panel.h - ch;
    const cw = (panel.w - gap * (ctrl.length - 1)) / ctrl.length;
    const showLabels = cw >= 46 * u;
    ctrl.forEach((b, i) => b.setIconScale(u).setLabelVisible(showLabels).layout(panel.x + i * (cw + gap), cy, cw, ch));
    const ry = cy - gap - ch;
    const rw = Math.round((panel.w - gap) / 2);
    this.reroll.setIconScale(u).layout(panel.x, ry, rw, ch);
    this.schemeBtn.setIconScale(u).layout(panel.x + rw + gap, ry, panel.w - rw - gap, ch);
    const cardsH = ry - gap - panel.y;
    const cols = panel.w >= 300 * d ? 2 : 1;
    const rows = 4 / cols;
    const cw2 = (panel.w - gap * (cols - 1)) / cols;
    const chh = (cardsH - gap * (rows - 1)) / rows;
    this.cards.forEach((k, i) => k.layout(panel.x + (i % cols) * (cw2 + gap), panel.y + Math.floor(i / cols) * (chh + gap), cw2, Math.max(ch, chh)));
    this.syncCards();
    this.drawHeader();
  }

  /** Höhe einer Zeile Pixel-Schrift in der aktuellen Skalierung. */
  private lineHeight(): number {
    return FONT_CELL_HEIGHT * this.ctx.host.u();
  }

  private placeInputRow(r: Rect): void {
    const u = this.ctx.host.u();
    const sendW = Math.max(r.h, 24 * u);
    this.send.setIconScale(u).layout(r.x + r.w - sendW, r.y, sendW, r.h);
    this.inputRect = { x: r.x, y: r.y, w: r.w - sendW - 2 * u, h: r.h };
  }

  /** DOM-Eingabefeld über dem Canvas: nur sichtbar, wenn das Fenster vorne ist und nichts darüber liegt. */
  private placeInput(): void {
    const win = this.ctx.win;
    const r = this.inputRect;
    const show = r !== null && win.active && !win.minimized && !this.ctx.os.overlayOpen && this.mode === 'call';
    if (!show || !r) {
      this.bridge.place(this, null, this.ctx.host.dpr());
      return;
    }
    // Das aktive Fenster übernimmt das (einzige) Eingabefeld.
    if (this.bridge.ownedBy !== this) this.bridge.attach(this, this.inputOpts);
    const o = this.ctx.host.origin();
    const u = this.ctx.host.u();
    this.bridge.place(this, { x: o.x + r.x + u, y: o.y + r.y + u, w: r.w - 2 * u, h: r.h - 2 * u }, this.ctx.host.dpr());
  }

  private drawHeader(): void {
    const g = this.g;
    const host = this.ctx.host;
    const u = host.u();
    const th = host.theme();
    g.clear();
    if (this.mode === 'idle') return;
    const ps = this.portrait.scaleX;
    const pw = 32 * ps;
    // Porträt-Rahmen.
    g.fillStyle(hex('ink0'), 1).fillRect(0, 0, pw + 2 * u, pw + 2 * u);
    g.fillStyle(hex('ink2'), 1).fillRect(u, u, pw, pw);
    const r = this.headerRect;
    const c = this.session?.conversation;
    if (this.mode === 'call' || this.mode === 'ended') {
      // Vertrauensbalken, darunter die Geduld.
      const by = Math.round(this.status.main.y + this.lineHeight() + 3 * u);
      const bw = Math.max(10, r.w - 2 * u);
      const trust = (c?.trust ?? this.session?.record?.trust ?? 0) / 100;
      g.fillStyle(hex('ink0'), 1).fillRect(r.x, by, bw, 4 * u);
      g.fillStyle(hex(trust >= 0.6 ? 'mint' : trust >= 0.3 ? 'mustard' : 'red'), 1).fillRect(r.x + u, by + u, Math.round((bw - 2 * u) * Math.max(0, Math.min(1, trust))), 2 * u);
      const py = by + 6 * u;
      const pat = c ? c.patience : 0;
      g.fillStyle(hex('ink0'), 1).fillRect(r.x, py, bw, 2 * u);
      g.fillStyle(hex(pat < 0.35 ? 'red' : 'sky'), 1).fillRect(r.x, py, Math.round(bw * pat), 2 * u);
      // Phasen: erledigte grün, aktuelle in Akzentfarbe.
      const phase = c?.phase ?? (this.mode === 'ended' ? 'ende' : 'einstieg');
      const cur = PHASES.indexOf(phase);
      const fy = Math.round(this.phase.main.y + this.lineHeight() + 2 * u);
      const n = PHASES.length;
      const seg = (bw - (n - 1) * u) / n;
      for (let i = 0; i < n; i++) {
        const sx = Math.round(r.x + i * (seg + u));
        g.fillStyle(hex(i < cur ? 'mint' : i === cur ? th.accent : 'ink1'), 1).fillRect(sx, fy, Math.round(seg), 2 * u);
      }
    }
    // Eingabefeld-Hintergrund.
    if (this.inputRect) {
      const ir = this.inputRect;
      g.fillStyle(hex('ink0'), 1).fillRect(ir.x, ir.y, ir.w, ir.h);
      g.fillStyle(hex(th.windowDark), 1).fillRect(ir.x + u, ir.y + u, ir.w - 2 * u, ir.h - 2 * u);
    }
  }
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const phoneApp: AppDef = {
  id: 'phone',
  icon: 'phone',
  titleKey: 'os.apps.phone.title',
  shortKey: 'os.apps.phone.short',
  size: { w: 300, h: 210 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new PhoneView(ctx),
};
