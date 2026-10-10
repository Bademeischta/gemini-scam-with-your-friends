import { calcApp } from './calc';
import { filesApp } from './files';
import { settingsApp } from './settings';
import { trashApp } from './trash';
import type { AppDef } from './types';
import { viewerApp } from './viewer';
import { weatherApp } from './weather';

/** Alle Apps von MogelOS in Desktop- und Startmenü-Reihenfolge. Weitere folgen ab M3. */
export const APPS: readonly AppDef[] = [filesApp, trashApp, calcApp, weatherApp, settingsApp, viewerApp];

export function appById(id: string): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}
