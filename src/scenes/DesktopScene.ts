import Phaser from 'phaser';
import { CallVoice } from '../audio/callVoice';
import { HoldMusic } from '../audio/holdMusic';
import { TUNING } from '../config/tuning';
import { currentRun } from '../core/run';
import { i18n, t } from '../i18n';
import type { ViewportState } from '../systems/viewport/viewportMath';
import { CrtTransition } from '../ui/os/CrtTransition';
import { MogelOS } from '../ui/os/MogelOS';
import { TextInputBridge } from '../ui/os/TextInputBridge';
import { BaseScene } from './BaseScene';

export interface DesktopData {
  desk: number;
  /** Wird nach dem Ausschalt-Effekt aufgerufen: Figur steht auf, Szene endet. */
  onLeave: () => void;
  onPause: () => void;
  /** Bildschirm vollständig an (true) bzw. beginnt auszugehen (false): Büro darunter muss nicht zeichnen. */
  onScreen: (on: boolean) => void;
}

/**
 * Bildschirm des Arbeitsplatz-PCs (OFF-17): MogelOS als eigene Szene über dem Büro.
 * Das Büro läuft darunter weiter (Countdown, später Anrufe und Gefahren).
 */
export class DesktopScene extends BaseScene {
  protected override readonly pausable = true;
  private os!: MogelOS;
  private crt!: CrtTransition;
  private voice!: CallVoice;
  private holdMusic!: HoldMusic;
  private opts!: DesktopData;
  private leaving = false;
  /** Tastatur/Gamepad erst ab dem zweiten Frame (der Tastendruck zum Hinsetzen zählt nicht). */
  private armed = false;

  constructor() {
    super('Desktop');
  }

  protected build(data?: unknown): void {
    this.opts = data as DesktopData;
    this.leaving = false;
    this.armed = false;
    // Phaser sortiert Zonen (ohne eigenes Rendering) sonst nicht nach Tiefe: Bei überlappenden
    // Fenstern muss immer das oberste den Klick bekommen – also nach Anzeigeliste und Containern sortieren.
    const input = this.input as Phaser.Input.InputPlugin & { sortDropZoneHandler: (a: unknown, b: unknown) => number };
    input.sortGameObjects = (objs: Phaser.GameObjects.GameObject[]) => {
      if (objs.length < 2) return objs;
      this.sys.depthSort();
      return objs.sort((a, b) => input.sortDropZoneHandler(a, b));
    };
    const run = currentRun();
    this.os = new MogelOS({
      scene: this,
      s: this.s,
      shift: () => run.shift,
      vfs: run.vfs,
      desk: this.opts.desk,
      phone: run.phone,
      notes: run.notes,
      onLeave: () => this.leave(),
      onPause: () => this.opts.onPause(),
    });
    this.voice = new CallVoice(this.s, run.phone, this.opts.desk);
    this.holdMusic = new HoldMusic(this.s.audio);
    this.crt = new CrtTransition(this, 20_000, TUNING.os.crtSeconds);
    this.crt.play('on', () => this.opts.onScreen(true));
    // Zurück an einen Platz mit laufendem (oder gerade beendetem) Gespräch: gleich das Telefon zeigen.
    if (run.phone.session(this.opts.desk)) this.os.open('phone');
    this.s.sfx.crtOn();
    run.desktopVisits++;
    if (run.desktopVisits === 1) {
      // Erste Sitzung des Tages: Chef-Mail mit der Quota.
      this.time.delayedCall(TUNING.os.crtSeconds * 1000 + 250, () =>
        this.os.toast({ icon: 'textfile', title: t('os.toast.bossMail.title'), body: t('os.toast.bossMail.body', { quota: i18n.formatMoney(run.shift.quota) }) }),
      );
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.set('os', null);
      this.voice.destroy();
      this.holdMusic.update(false);
      this.s.speech.abort();
      this.os.destroy();
      TextInputBridge.get().setSuspended(false);
    });
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    this.os.layout(vp);
  }

  protected override frameUpdate(dt: number): void {
    const paused = this.s.pause.paused;
    // Während der Pause gehen Klicks nicht an den Desktop unter dem Pausenmenü.
    this.input.enabled = !paused && !this.leaving;
    const accept = this.armed && !this.crt.running && !this.leaving;
    // Das DOM-Eingabefeld läge sonst über Pausenmenü und Röhren-Effekt.
    TextInputBridge.get().setSuspended(paused || this.crt.running || this.leaving);
    if (!paused) {
      this.os.update(dt, accept);
      this.voice.update(dt);
    }
    const call = currentRun().calls.conversation(this.opts.desk);
    this.holdMusic.update(!paused && call?.state === 'hold');
    this.crt.update(paused ? 0 : dt, this.scale.width, this.scale.height);
    this.armed = true;
    this.registry.set('os', this.os.snapshot(accept && !paused));
  }

  /** Aufstehen: Bildschirm aus, dann übernimmt das Büro. */
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.voice.stop();
    this.holdMusic.update(false);
    this.s.speech.abort();
    this.opts.onScreen(false);
    this.s.sfx.crtOff();
    this.crt.play('off', () => this.opts.onLeave());
  }
}
