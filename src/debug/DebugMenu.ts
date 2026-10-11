import type Phaser from 'phaser';
import { currentRun, debugRun, hasRun } from '../core/run';
import { t } from '../i18n';

/**
 * Debug-Menü (nur Dev- und Test-Build, F9): Tag direkt wählen, Geld setzen, Quota überspringen,
 * Tag beenden, alles freischalten – damit sich spätere Tage testen lassen, ohne alles durchzuspielen.
 * Ein einfaches DOM-Panel über dem Spiel; im Produktions-Build wird diese Datei nicht geladen.
 */
export function installDebugMenu(game: Phaser.Game, doc: Document = document): void {
  const panel = doc.createElement('div');
  panel.id = 'debug-menu';
  panel.setAttribute('role', 'dialog');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '1000',
    background: 'rgba(16,14,24,0.94)',
    color: '#f4e9d2',
    font: '14px system-ui, sans-serif',
    padding: '10px',
    border: '2px solid #e8b64a',
    display: 'none',
    gap: '6px',
    minWidth: '220px',
  } satisfies Partial<CSSStyleDeclaration>);

  const title = doc.createElement('strong');
  title.textContent = t('debug.title');
  const hint = doc.createElement('small');
  hint.textContent = t('debug.hint');

  const row = (...els: HTMLElement[]): HTMLElement => {
    const d = doc.createElement('div');
    d.style.display = 'flex';
    d.style.gap = '6px';
    d.append(...els);
    return d;
  };
  const input = (id: string, value: number): HTMLInputElement => {
    const el = doc.createElement('input');
    el.type = 'number';
    el.id = id;
    el.value = String(value);
    el.style.width = '80px';
    return el;
  };
  const button = (id: string, label: string, fn: () => void): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.id = id;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      fn();
      sync();
    });
    return b;
  };

  const dayIn = input('debug-day', 1);
  const moneyIn = input('debug-money', 0);
  const unlockBtn = button('debug-unlock', t('debug.unlockAll'), () => debugRun.unlockAll(!debugRun.allUnlocked));
  const label = (key: string): HTMLElement => {
    const l = doc.createElement('span');
    l.textContent = t(key);
    l.style.minWidth = '40px';
    return l;
  };

  panel.append(
    title,
    row(label('debug.day'), dayIn, button('debug-go', t('debug.go'), () => startDay(game, Number(dayIn.value)))),
    row(label('debug.money'), moneyIn, button('debug-set-money', t('debug.set'), () => debugRun.setMoney(Number(moneyIn.value)))),
    button('debug-skip', t('debug.skipQuota'), () => debugRun.skipQuota()),
    button('debug-end', t('debug.endDay'), () => debugRun.endDaySoon()),
    unlockBtn,
    button('debug-close', t('debug.close'), () => setOpen(false)),
    hint,
  );
  doc.body.append(panel);

  function setOpen(on: boolean): void {
    panel.style.display = on ? 'grid' : 'none';
    if (!on || !hasRun()) return;
    const r = currentRun();
    dayIn.value = String(r.shift.day);
    moneyIn.value = String(r.shift.personal);
    sync();
  }

  function sync(): void {
    unlockBtn.textContent = t(debugRun.allUnlocked ? 'debug.unlockOff' : 'debug.unlockAll');
  }

  doc.defaultView?.addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    setOpen(panel.style.display === 'none');
  });
}

/** Tag direkt starten: Büro neu aufbauen (Run bleibt, Geld und Kundenkartei auch). */
function startDay(game: Phaser.Game, day: number): void {
  if (!Number.isFinite(day)) return;
  debugRun.setDay(day);
  const mgr = game.scene;
  for (const key of ['Desktop', 'OfficeHud', 'Review', 'Report', 'Pause']) if (mgr.isActive(key) || mgr.isPaused(key) || mgr.isSleeping(key)) mgr.stop(key);
  if (mgr.isActive('Office')) mgr.getScene('Office').scene.restart({ mode: 'day' });
  else {
    for (const key of ['Title', 'About', 'Stats']) if (mgr.isActive(key)) mgr.stop(key);
    mgr.start('Office', { mode: 'day' });
  }
}
