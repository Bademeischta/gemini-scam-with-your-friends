import Phaser from 'phaser';
import { drawArt, HANDSET_ART, HANDSET_LEGEND, artSize, type ArtGrid, type Legend } from '../gfx/pixelArt';
import { whenSavesReady } from '../core/services';
import { registerPixelFont } from '../gfx/pixelFont';

export const TEX = {
  pixel: 'px',
  handset: 'handset',
} as const;

/**
 * Erzeugt alle Grund-Texturen per Code (Schrift, Sprites), wartet auf die Spielstände und startet den Titel.
 * Es werden keine Dateien geladen – alles entsteht hier.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    registerPixelFont(this);
    this.makePixel();
    this.makeArt(TEX.handset, HANDSET_ART, HANDSET_LEGEND);
    // Spielstände sind in der Regel nach wenigen Millisekunden geladen (IndexedDB).
    void whenSavesReady().then(() => this.scene.start('Title'));
  }

  private makePixel(): void {
    if (this.textures.exists(TEX.pixel)) return;
    const t = this.textures.createCanvas(TEX.pixel, 1, 1);
    if (!t) return;
    t.getContext().fillStyle = '#ffffff';
    t.getContext().fillRect(0, 0, 1, 1);
    t.refresh();
  }

  private makeArt(key: string, art: ArtGrid, legend: Legend): void {
    if (this.textures.exists(key)) return;
    const { width, height } = artSize(art);
    const t = this.textures.createCanvas(key, width, height);
    if (!t) return;
    drawArt(t.getContext(), art, legend, 0, 0, 1);
    t.refresh();
  }
}
