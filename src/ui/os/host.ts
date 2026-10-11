import type Phaser from 'phaser';
import type { Host } from './widgets';

export type HostBase = Pick<Host, 'scene' | 's' | 'focus' | 'theme' | 'u' | 'dpr'>;

/** Widget-Umgebung für einen Container, der direkt in der Szene liegt (Taskleiste, Menüs …). */
export function rootHost(base: HostBase, container: Phaser.GameObjects.Container, scope: string): Host & { moved(): void } {
  const listeners: (() => void)[] = [];
  return {
    ...base,
    container,
    scope,
    origin: () => ({ x: container.x, y: container.y }),
    onMove: (fn) => listeners.push(fn),
    moved: () => {
      for (const fn of listeners) fn();
    },
  };
}
