/**
 * Web-Audio-Grundgerüst: ein AudioContext, Master- und UI-Bus.
 * Der Kontext wird erst bei der ersten Nutzer-Geste erzeugt (Autoplay-Regeln der Browser)
 * und im Hintergrund angehalten. Alle Klänge entstehen per Code (siehe sfx.ts).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ui: GainNode | null = null;
  private suspendedByApp = false;
  private masterVolume: number;
  private uiVolume: number;

  constructor(masterVolume: number, uiVolume: number) {
    this.masterVolume = masterVolume;
    this.uiVolume = uiVolume;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get uiBus(): GainNode | null {
    return this.ui;
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

  setVolumes(master: number, ui: number): void {
    this.masterVolume = master;
    this.uiVolume = ui;
    if (this.master) this.master.gain.value = master;
    if (this.ui) this.ui.gain.value = ui;
  }

  /** Kurzer synthetischer Ton auf einem Bus. */
  tone(bus: GainNode | null, freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !bus || ctx.state !== 'running') return;
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
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
