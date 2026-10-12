import type { PaletteName } from '../config/palette';
import type { PortraitDef } from '../systems/conversation/caller';
import type { Mood } from '../systems/conversation/types';
import { SHADE } from './characters';
import { PixelGrid } from './PixelGrid';

/** Prozedurale Anrufer-Porträts (32×32) mit Gesichtsausdruck je Stimmung (NPC-26). */
export const PORTRAIT_SIZE = 32;

const SKIN: readonly PaletteName[] = ['skin1', 'sand', 'skin2', 'skin3'];
const HAIR: Readonly<Record<PortraitDef['hairColor'], PaletteName>> = {
  grau: 'fog', weiss: 'paper', braun: 'coffee', schwarz: 'ink1', blond: 'mustard', rot: 'rust', pink: 'rose', blau: 'sky',
};

interface Face {
  /** Mittelpunkt und Halbbreite des Kopfes. */
  cx: number;
  top: number;
  w: number;
  h: number;
}

export function buildPortrait(def: PortraitDef, mood: Mood): PixelGrid {
  const g = new PixelGrid(PORTRAIT_SIZE, PORTRAIT_SIZE);
  if (def.group) {
    // Lautsprecher-Familie: drei Köpfe, die durcheinanderreden.
    const looks: PortraitDef[] = [
      { ...def, hair: 'curly', hairColor: 'rot', group: false },
      { ...def, hair: 'short', hairColor: 'braun', beard: 'schnauz', group: false },
      { ...def, hair: 'spiky', hairColor: 'blond', hat: 'cap', group: false },
    ];
    drawBust(g, looks[1]!, mood, { cx: 16, top: 2, w: 5, h: 8 }, 'blue');
    drawBust(g, looks[0]!, mood, { cx: 6, top: 11, w: 5, h: 8 }, 'rose');
    drawBust(g, looks[2]!, mood, { cx: 26, top: 12, w: 5, h: 8 }, 'leaf');
    return g.outline('ink0');
  }
  drawBust(g, def, mood, { cx: 16, top: 6, w: 8, h: 17 }, def.shirt);
  return g.outline('ink0');
}

function drawBust(g: PixelGrid, d: PortraitDef, mood: Mood, f: Face, shirt: PaletteName): void {
  const skin = SKIN[d.skin]!;
  const skinD = SHADE[skin];
  const hair = HAIR[d.hairColor];
  const hairD = SHADE[hair];
  const small = f.w < 8;
  const left = f.cx - f.w;
  const right = f.cx + f.w - 1;
  const bottom = f.top + f.h;

  // Schultern und Hemd.
  const sy = bottom + (small ? 1 : 2);
  const sw = small ? f.w + 2 : f.w + 6;
  for (let y = sy; y < PORTRAIT_SIZE; y++) {
    const inset = Math.max(0, 2 - (y - sy));
    g.hline(f.cx - sw + inset, y, 2 * (sw - inset), shirt);
  }
  g.hline(f.cx - sw + 2, sy, 2 * (sw - 2), SHADE[shirt]);
  // Hals.
  g.rect(f.cx - (small ? 1 : 3), bottom - 1, small ? 2 : 6, sy - bottom + 2, skinD);
  if (d.extra === 'kragen' && !small) g.set(f.cx - 4, sy, 'white').set(f.cx - 3, sy + 1, 'white').set(f.cx + 3, sy, 'white').set(f.cx + 2, sy + 1, 'white');
  if (d.extra === 'perlen' && !small) for (let x = f.cx - 3; x <= f.cx + 2; x += 2) g.set(x, sy + 1, 'white');

  // Kopf (abgerundet) und Ohren.
  g.rect(left, f.top + 1, 2 * f.w, f.h - 2, skin).hline(left + 1, f.top, 2 * f.w - 2, skin).hline(left + 1, bottom - 1, 2 * f.w - 2, skin);
  g.vline(right, f.top + 2, f.h - 4, skinD);
  if (!small) g.rect(left - 1, f.top + 7, 1, 4, skinD).rect(right + 1, f.top + 7, 1, 4, skinD);

  // Haare.
  drawHair(g, d, f, hair, hairD);

  // Gesicht.
  const eyeY = f.top + Math.round(f.h * 0.42);
  const ex1 = f.cx - (small ? 2 : 4);
  const ex2 = f.cx + (small ? 1 : 3);
  drawEyes(g, mood, ex1, ex2, eyeY, small, skin);
  if (!small) g.rect(f.cx - 1, eyeY + 2, 2, 3, skinD);
  const mouthY = f.top + Math.round(f.h * (small ? 0.75 : 0.74));
  drawMouth(g, mood, f.cx, mouthY, small);
  if (!small && (mood === 'vertrauensvoll' || mood === 'amuesiert')) g.set(ex1 - 1, eyeY + 3, 'blush').set(ex2 + 2, eyeY + 3, 'blush');
  if (!small && mood === 'wuetend') g.rect(ex1 - 1, eyeY + 3, 2, 1, 'rose').rect(ex2 + 1, eyeY + 3, 2, 1, 'rose');
  if (!small && d.extra === 'sommersprossen') g.set(ex1, eyeY + 3, skinD).set(ex1 + 2, eyeY + 4, skinD).set(ex2, eyeY + 3, skinD).set(ex2 + 1, eyeY + 4, skinD);

  // Bart.
  if (d.beard && !small) {
    if (d.beard === 'voll') g.rect(left + 1, mouthY - 1, 2 * f.w - 2, bottom - mouthY + 1, hair).rect(f.cx - 2, mouthY, 4, 1, 'ink0');
    else if (d.beard === 'schnauz') g.rect(f.cx - 3, mouthY - 2, 6, 1, hair).set(f.cx - 4, mouthY - 1, hair).set(f.cx + 3, mouthY - 1, hair);
    else if (d.beard === 'kinn') g.rect(f.cx - 1, bottom - 2, 2, 3, hair);
    else g.dither(left + 1, mouthY - 1, 2 * f.w - 2, bottom - mouthY, skinD, 0);
  }
  if (d.beard === 'schnauz' && small) g.hline(f.cx - 1, mouthY - 1, 2, hair);

  // Brille.
  if (d.glasses && !small) {
    if (d.glasses === 'sonne') g.rect(ex1 - 2, eyeY - 1, 5, 3, 'ink0').rect(ex2 - 1, eyeY - 1, 5, 3, 'ink0').hline(ex1 + 3, eyeY, ex2 - ex1 - 4, 'ink0').set(ex1 - 1, eyeY - 1, 'slate');
    else if (d.glasses === 'monokel') g.frame(ex2 - 1, eyeY - 1, 4, 4, 'mustard').vline(ex2 + 2, eyeY + 3, 5, 'mustard');
    else {
      const c = d.glasses === 'dick' ? 'ink0' : 'ink2';
      g.frame(ex1 - 2, eyeY - 1, 5, 4, c).frame(ex2 - 1, eyeY - 1, 5, 4, c).hline(ex1 + 3, eyeY, ex2 - ex1 - 4, c);
    }
  }

  // Hüte.
  if (d.hat) drawHat(g, d.hat, f);

  // Extras.
  if (d.extra === 'ohrringe' && !small) g.set(left - 1, f.top + 11, 'mustard').set(right + 1, f.top + 11, 'mustard');
  if (d.extra === 'headset' && !small) g.rect(left - 2, f.top + 6, 2, 5, 'ink2').rect(left - 1, f.top + 11, 1, 3, 'ink2').hline(left - 1, f.top + 14, 4, 'ink2');
  if (d.extra === 'pflaster' && !small) g.rect(ex2, f.top + 2, 3, 2, 'sand').set(ex2 + 1, f.top + 2, 'paper');
  if ((d.extra === 'schweiss' || mood === 'aengstlich') && !small) g.set(right - 1, f.top + 4, 'sky').rect(right - 1, f.top + 5, 2, 2, 'sky');
  if (d.extra === 'zahnluecke' && !small && (mood === 'amuesiert' || mood === 'vertrauensvoll')) g.set(f.cx, mouthY + 1, 'ink0');

  // Stimmungs-Zeichen über dem Kopf.
  if (!small) {
    if (mood === 'verwirrt') g.rect(right - 1, 0, 3, 1, 'mustard').set(right + 1, 1, 'mustard').set(right, 2, 'mustard').set(right, 4, 'mustard');
    if (mood === 'gelangweilt') g.hline(right - 1, 1, 3, 'fog').set(right, 2, 'fog').hline(right - 1, 3, 3, 'fog');
    if (mood === 'wuetend') g.set(left, 1, 'red').set(left + 1, 2, 'red').set(left - 1, 3, 'red').set(right, 1, 'red').set(right - 1, 2, 'red').set(right + 1, 3, 'red');
  }
}

function drawHair(g: PixelGrid, d: PortraitDef, f: Face, c: PaletteName, cd: PaletteName): void {
  const left = f.cx - f.w;
  const w = 2 * f.w;
  const t = f.top;
  switch (d.hair) {
    case 'none':
    case 'bald':
      if (d.hair === 'bald') g.set(f.cx - 2, t + 1, 'white');
      g.rect(left, t + 5, 1, 4, c).rect(left + w - 1, t + 5, 1, 4, c);
      break;
    case 'short':
      g.rect(left, t - 1, w, 4, c).rect(left, t + 3, 1, 4, c).rect(left + w - 1, t + 3, 1, 4, c).hline(left + 2, t + 3, w - 6, cd);
      break;
    case 'side':
      g.rect(left, t - 1, w, 3, c).rect(left, t + 2, Math.ceil(w * 0.6), 2, c).rect(left, t + 4, 1, 5, c).rect(left + w - 1, t + 2, 1, 6, c);
      break;
    case 'long':
      g.rect(left - 1, t - 1, w + 2, 4, c).rect(left - 2, t + 3, 3, f.h + 2, c).rect(left + w - 1, t + 3, 3, f.h + 2, c).hline(left, t + 3, w, cd);
      break;
    case 'bun':
      g.rect(left, t - 1, w, 4, c).rect(f.cx - 3, t - 5, 6, 4, c).hline(f.cx - 2, t - 5, 4, 'white').rect(left, t + 3, 1, 3, c).rect(left + w - 1, t + 3, 1, 3, c);
      break;
    case 'curly':
      for (let x = left - 1; x <= left + w; x += 2) g.disc(x, t + 1, 2, c);
      g.rect(left - 2, t + 2, 3, 8, c).rect(left + w - 1, t + 2, 3, 8, c).dither(left, t, w, 3, cd, 1);
      break;
    case 'spiky':
      g.rect(left, t, w, 3, c);
      for (let x = left; x < left + w; x += 3) g.vline(x + 1, t - 3, 3, c).set(x + 1, t - 3, cd);
      break;
    case 'mohawk':
      g.rect(f.cx - 2, t - 5, 4, 7, c).vline(f.cx - 1, t - 5, 7, cd);
      break;
    case 'ponytail':
      g.rect(left, t - 1, w, 4, c).rect(left + w, t + 2, 3, 2, c).rect(left + w + 1, t + 4, 3, 7, c).rect(left, t + 3, 1, 3, c);
      break;
  }
}

function drawHat(g: PixelGrid, hat: NonNullable<PortraitDef['hat']>, f: Face): void {
  const left = f.cx - f.w;
  const w = 2 * f.w;
  const t = f.top;
  switch (hat) {
    case 'hexe':
      g.rect(left - 4, t + 1, w + 8, 2, 'ink2');
      for (let i = 0; i < 7; i++) g.hline(f.cx - 5 + i, t - i, 10 - i * 2 + (i > 3 ? 1 : 0), 'ink2');
      g.set(f.cx + 3, t - 7, 'ink2').set(f.cx + 4, t - 7, 'ink2').hline(left, t, w, 'violet');
      break;
    case 'helm':
      g.frame(left - 2, t - 2, w + 4, f.h + 2, 'paper').frame(left - 1, t - 1, w + 2, f.h, 'fog');
      g.hline(left, t - 2, w, 'white').set(left - 2, t + 8, 'red').set(left + w + 1, t + 8, 'red');
      break;
    case 'kappe':
      g.rect(left, t - 2, w, 4, 'fog').rect(left + w - 2, t + 1, 5, 1, 'fog').hline(left + 1, t - 2, w - 2, 'paper');
      break;
    case 'zylinder':
      g.rect(f.cx - 5, t - 7, 10, 8, 'ink1').rect(left - 2, t, w + 4, 2, 'ink1').hline(f.cx - 5, t - 2, 10, 'red');
      break;
    case 'muetze':
      g.rect(left, t - 2, w, 5, 'red').hline(left, t + 2, w, 'paper').disc(f.cx, t - 4, 2, 'paper');
      break;
    case 'stroh':
      g.rect(left - 4, t + 1, w + 8, 2, 'sand').rect(left + 1, t - 3, w - 2, 4, 'sand').hline(left + 1, t, w - 2, 'rust');
      break;
    case 'cap':
      g.rect(left, t - 2, w, 4, 'leaf').rect(left + w - 1, t + 1, 4, 1, 'leaf');
      break;
    case 'krone':
      g.rect(f.cx - 4, t - 3, 8, 3, 'mustard');
      for (let i = 0; i < 3; i++) g.set(f.cx - 4 + i * 3 + 1, t - 4, 'mustard');
      g.set(f.cx, t - 2, 'red');
      break;
  }
}

function drawEyes(g: PixelGrid, mood: Mood, x1: number, x2: number, y: number, small: boolean, skin: PaletteName): void {
  const brow = (x: number, dy1: number, dy2: number): void => {
    if (small) return;
    g.set(x - 1, y - 2 + dy1, 'ink1').set(x, y - 2 + Math.round((dy1 + dy2) / 2), 'ink1').set(x + 1, y - 2 + dy2, 'ink1');
  };
  const dot = (x: number): void => {
    g.rect(x, y, small ? 1 : 2, small ? 1 : 2, 'ink0');
    if (!small) g.set(x, y, 'white');
  };
  switch (mood) {
    case 'vertrauensvoll':
    case 'amuesiert':
      for (const x of [x1, x2]) {
        g.set(x - (small ? 0 : 1), y + 1, 'ink0').set(x, y, 'ink0');
        if (!small) g.set(x + 1, y, 'ink0').set(x + 2, y + 1, 'ink0');
      }
      brow(x1, -1, -1);
      brow(x2 + 1, -1, -1);
      break;
    case 'misstrauisch':
      for (const x of [x1, x2]) g.hline(x - (small ? 0 : 1), y + 1, small ? 1 : 3, 'ink0');
      brow(x1, 1, 0);
      brow(x2 + 1, -1, -1);
      break;
    case 'verwirrt':
      dot(x1);
      g.rect(x2 - (small ? 0 : 1), y - 1, small ? 1 : 3, small ? 1 : 3, 'ink0');
      if (!small) g.set(x2, y, 'white');
      brow(x1, 0, 0);
      brow(x2 + 1, -2, -1);
      break;
    case 'genervt':
    case 'gelangweilt':
      for (const x of [x1, x2]) {
        g.rect(x, y, small ? 1 : 2, small ? 1 : 2, 'ink0');
        if (!small) g.hline(x - 1, y - 1, 4, SHADE[skin]);
      }
      brow(x1, 0, 0);
      brow(x2 + 1, 0, 0);
      break;
    case 'wuetend':
      dot(x1);
      dot(x2);
      brow(x1, -1, 1);
      brow(x2 + 1, 1, -1);
      if (!small) g.set(x1 - 1, y - 3, 'ink1').set(x2 + 2, y - 3, 'ink1');
      break;
    case 'aengstlich':
      for (const x of [x1, x2]) {
        if (small) g.set(x, y, 'ink0');
        else g.rect(x - 1, y - 1, 3, 3, 'white').set(x, y, 'ink0');
      }
      brow(x1, -2, -1);
      brow(x2 + 1, -1, -2);
      break;
    default:
      dot(x1);
      dot(x2);
      brow(x1, 0, 0);
      brow(x2 + 1, 0, 0);
  }
}

function drawMouth(g: PixelGrid, mood: Mood, cx: number, y: number, small: boolean): void {
  if (small) {
    if (mood === 'wuetend' || mood === 'genervt' || mood === 'misstrauisch') g.hline(cx - 1, y, 2, 'ink0');
    else if (mood === 'amuesiert' || mood === 'vertrauensvoll') g.hline(cx - 1, y + 1, 2, 'ink0').set(cx - 2, y, 'ink0').set(cx + 1, y, 'ink0');
    else g.set(cx, y, 'ink0');
    return;
  }
  switch (mood) {
    case 'vertrauensvoll':
      g.hline(cx - 2, y + 1, 4, 'ink0').set(cx - 3, y, 'ink0').set(cx + 2, y, 'ink0');
      break;
    case 'amuesiert':
      g.rect(cx - 3, y, 6, 2, 'ink0').hline(cx - 2, y + 2, 4, 'ink0').hline(cx - 2, y, 4, 'white').set(cx - 1, y + 1, 'red').set(cx, y + 1, 'red');
      break;
    case 'misstrauisch':
      g.hline(cx - 2, y, 3, 'ink0').set(cx + 1, y - 1, 'ink0');
      break;
    case 'verwirrt':
      g.set(cx - 3, y, 'ink0').set(cx - 2, y + 1, 'ink0').set(cx - 1, y, 'ink0').set(cx, y + 1, 'ink0').set(cx + 1, y, 'ink0');
      break;
    case 'genervt':
      g.hline(cx - 2, y, 4, 'ink0').set(cx - 3, y + 1, 'ink0').set(cx + 2, y + 1, 'ink0');
      break;
    case 'wuetend':
      g.rect(cx - 3, y, 6, 3, 'ink0').hline(cx - 2, y, 4, 'white').hline(cx - 2, y + 2, 4, 'white');
      break;
    case 'aengstlich':
      g.rect(cx - 1, y, 2, 2, 'ink0');
      break;
    case 'gelangweilt':
      g.hline(cx - 2, y + 1, 4, 'ink0');
      break;
    default:
      g.hline(cx - 2, y, 4, 'ink0');
  }
}
