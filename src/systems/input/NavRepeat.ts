/**
 * Wiederholung beim Halten einer Richtung in Menüs (wie Tastatur-Autorepeat, aber auch für Sticks).
 * `update` liefert true in dem Frame, in dem ein Navigationsschritt ausgelöst werden soll.
 */
export class NavRepeat {
  private held = 0;
  private nextFire = 0;

  constructor(
    private readonly delay: number,
    private readonly interval: number,
  ) {}

  update(dt: number, isDown: boolean, justPressed: boolean): boolean {
    if (!isDown) {
      this.held = 0;
      return false;
    }
    if (justPressed || this.held === 0) {
      this.held = dt > 0 ? dt : 1e-6;
      this.nextFire = this.delay;
      return true;
    }
    this.held += dt;
    if (this.held >= this.nextFire) {
      this.nextFire += this.interval;
      return true;
    }
    return false;
  }

  reset(): void {
    this.held = 0;
  }
}
