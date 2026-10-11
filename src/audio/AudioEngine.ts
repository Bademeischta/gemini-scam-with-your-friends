/**
 * Web-Audio-Grundgerüst: ein AudioContext, Master- und UI-Bus.
 * Der Kontext wird erst bei der ersten Nutzer-Geste erzeugt (Autoplay-Regeln der Browser)
 * und im Hintergrund angehalten. Alle Klänge entstehen per Code (siehe sfx.ts).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ui: GainNode | null = null;
  private world: GainNode | null = null;
  private voice: GainNode | null = null;
  private suspendedByApp = false;
  private masterVolume: number;
  private uiVolume: number;
  private voiceVolume: number;

  constructor(masterVolume: number, uiVolume: number, voiceVolume = 0.8) {
    this.masterVolume = masterVolume;
    this.uiVolume = uiVolume;
    this.voiceVolume = voiceVolume;
  }

  /** Gesamtlautstärke der Stimmen (Master × Stimmen), z. B. für die Sprachsynthese des Browsers. */
  get voiceLevel(): number {
    return this.masterVolume * this.voiceVolume;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get uiBus(): GainNode | null {
    return this.ui;
  }

  /** Geräusche der Spielwelt (Klingeln, Büro). */
  get worldBus(): GainNode | null {
    return this.world;
  }

  /** Stimmen der Anrufer (Brabbeln) und Warteschleifen-Musik. */
  get voiceBus(): GainNode | null {
    return this.voice;
  }

  get state(): AudioContextState | 'none' {
    return this.ctx?.state ?? 'none';
  }

  /** Bei Nutzer-Geste aufrufen: erzeugt bzw. weckt den Kontext. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.ui = this.ctx.createGain();
      this.ui.gain.value = this.uiVolume;
      this.ui.connect(this.master);
      this.world = this.ctx.createGain();
      this.world.gain.value = 0.9;
      this.world.connect(this.master);
      this.voice = this.ctx.createGain();
      this.voice.gain.value = this.voiceVolume;
      this.voice.connect(this.master);
    }
    if (this.ctx.state === 'suspended' && !this.suspendedByApp) void this.ctx.resume().catch(() => undefined);
  }

  /** Im Hintergrund stummschalten (Auto-Pause). */
  suspend(): void {
    this.suspendedByApp = true;
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    this.suspendedByApp = false;
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  setVolumes(master: number, ui: number, voice = this.voiceVolume): void {
    this.masterVolume = master;
    this.uiVolume = ui;
    this.voiceVolume = voice;
    if (this.master) this.master.gain.value = master;
    if (this.ui) this.ui.gain.value = ui;
    if (this.voice) this.voice.gain.value = voice;
  }

  /** Kurzer synthetischer Ton auf einem Bus; `pan` −1 (links) … 1 (rechts) für räumlichen Klang. */
  tone(bus: GainNode | null, freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0, pan = 0): void {
    const ctx = this.ctx;
    if (!ctx || !bus || ctx.state !== 'running' || vol <= 0) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    let panner: StereoPannerNode | null = null;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(bus);
    } else gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
  }

  /** Aktuelle Audio-Zeit (für Taktgeber wie die Warteschleifen-Musik). */
  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }
}
