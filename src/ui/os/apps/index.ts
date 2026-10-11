import { calcApp } from './calc';
import { identomatApp, voucherApp } from './entryApps';
import { fernguckerApp } from './ferngucker';
import { filesApp } from './files';
import { karteiApp } from './kartei';
import { notesApp } from './notes';
import { phoneApp } from './phone';
import { plauderApp } from './plauder';
import { schemesApp, scriptApp } from './schemes';
import { settingsApp } from './settings';
import { trashApp } from './trash';
import type { AppDef } from './types';
import { viewerApp } from './viewer';
import { weatherApp } from './weather';

/**
 * Alle Apps von MogelOS in Desktop- und Startmenü-Reihenfolge: erst Telefon, Notizen und die
 * Maschen-Werkzeuge, dann die System-Apps. Weitere (Shop, Chat …) folgen ab M5.
 */
export const APPS: readonly AppDef[] = [
  phoneApp,
  notesApp,
  schemesApp,
  karteiApp,
  identomatApp,
  voucherApp,
  fernguckerApp,
  plauderApp,
  filesApp,
  trashApp,
  calcApp,
  weatherApp,
  settingsApp,
  viewerApp,
  scriptApp,
];

export function appById(id: string): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}
