/**
 * Fester Logik-Takt mit Akkumulator („Fix Your Timestep“).
 * Die Simulation läuft immer mit `step` Sekunden pro Schritt – unabhängig von 30, 60 oder 144 Hz.
 * `alpha` (0–1) erlaubt dem Renderer, zwischen zwei Logik-Zuständen zu interpolieren.
 */
export class FixedStepClock {
  readonly step: number;
  private readonly maxSteps: number;
  private readonly maxDelta: number;
  private acc = 0;
  private _alpha = 0;
  private _time = 0;
  private _steps = 0;

  constructor(hz: number, maxStepsPerFrame: number, maxFrameDelta: number) {
    if (hz <= 0) throw new Error('hz muss > 0 sein');
    this.step = 1 / hz;
    this.maxSteps = Math.max(1, Math.floor(maxStepsPerFrame));
    this.maxDelta = maxFrameDelta;
  }

  /** Simulierte Gesamtzeit in s. */
  get time(): number {
    return this._time;
  }

  /** Bisher ausgeführte Logik-Schritte. */
  get totalSteps(): number {
    return this._steps;
  }

  get alpha(): number {
    return this._alpha;
  }

  /**
   * Schreitet um `frameDelta` Sekunden Echtzeit voran und ruft `fixedUpdate` so oft auf,
   * wie volle Schritte angefallen sind. Rückgabe: Anzahl ausgeführter Schritte.
   */
  advance(frameDelta: number, fixedUpdate: (dt: number) => void): number {
    if (!Number.isFinite(frameDelta) || frameDelta < 0) frameDelta = 0;
    this.acc += Math.min(frameDelta, this.maxDelta);
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) {
      fixedUpdate(this.step);
      this.acc -= this.step;
      this._time += this.step;
      this._steps++;
      n++;
    }
    // Bei Überlast den Rest verwerfen statt ewig hinterherzulaufen.
    if (n === this.maxSteps && this.acc >= this.step) this.acc = this.acc % this.step;
    this._alpha = this.acc / this.step;
    return n;
  }

  reset(): void {
    this.acc = 0;
    this._alpha = 0;
  }
}
