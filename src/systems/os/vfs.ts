/**
 * Virtuelles Dateisystem von MogelOS: Ordner, Dateien, Papierkorb.
 * Texte (Namen und Inhalte) sind i18n-Schlüssel; die Spiellogik kennt nur IDs.
 */
export type FolderId = 'docs' | 'pictures' | 'recordings' | 'downloads';
export const FOLDERS: readonly FolderId[] = ['docs', 'downloads', 'pictures', 'recordings'];

export interface VFile {
  id: string;
  folder: FolderId;
  kind: 'text';
  nameKey: string;
  contentKey: string;
}

export class VirtualFs {
  private readonly files: VFile[];
  private readonly trashed = new Map<string, VFile>();
  private readonly listeners = new Set<() => void>();

  constructor(files: readonly VFile[], trashed: readonly VFile[] = []) {
    this.files = files.map((f) => ({ ...f }));
    for (const f of trashed) this.trashed.set(f.id, { ...f });
  }

  list(folder: FolderId): VFile[] {
    return this.files.filter((f) => f.folder === folder);
  }

  trash(): VFile[] {
    return [...this.trashed.values()];
  }

  get(id: string): VFile | undefined {
    return this.files.find((f) => f.id === id) ?? this.trashed.get(id);
  }

  isTrashed(id: string): boolean {
    return this.trashed.has(id);
  }

  delete(id: string): boolean {
    const i = this.files.findIndex((f) => f.id === id);
    if (i < 0) return false;
    const [f] = this.files.splice(i, 1);
    this.trashed.set(f!.id, f!);
    this.emit();
    return true;
  }

  restore(id: string): boolean {
    const f = this.trashed.get(id);
    if (!f) return false;
    this.trashed.delete(id);
    this.files.push(f);
    this.emit();
    return true;
  }

  emptyTrash(): number {
    const n = this.trashed.size;
    this.trashed.clear();
    if (n) this.emit();
    return n;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
