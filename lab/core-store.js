export const CORE_STORAGE = Object.freeze({ draft: 'recorder.core.studio.draft.v2', library: 'recorder.core.studio.library.v2' });
export class CoreStore {
  constructor() { this.error = null; this.restored = false; this.lastSaved = null; this.items = []; }
  read(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (error) { this.error = `无法读取本机作品：${error.message}`; return fallback; }
  }
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); this.error = null; return true; }
    catch (error) { this.error = error.name === 'QuotaExceededError' ? '本机空间不足，草稿未保存。请导出配置备份。' : '此浏览器无法保存本机草稿。请导出配置备份。'; return false; }
  }
  loadDraft() { return this.read(CORE_STORAGE.draft, null); }
  saveDraft(config) {
    const savedAt = new Date().toISOString();
    if (!this.write(CORE_STORAGE.draft, { config, savedAt })) return false;
    this.lastSaved = savedAt; return true;
  }
  loadLibrary() {
    const items = this.read(CORE_STORAGE.library, []);
    this.items = Array.isArray(items) ? items.filter(item => item && typeof item.id === 'string' && typeof item.thumbnail === 'string' && item.thumbnail.startsWith('data:image/') && item.config).slice(0, 6) : [];
    return this.items;
  }
  add(config, thumbnail) {
    if (this.items.length >= 6) throw new Error('收藏已满。请在「我的收藏」移除一件，或导出配置备份。');
    const item = { id: globalThis.crypto?.randomUUID?.() || `core-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: config.title, savedAt: new Date().toISOString(), thumbnail, config };
    const next = [item, ...this.items];
    if (!this.write(CORE_STORAGE.library, next)) throw new Error(this.error);
    this.items = next; return item;
  }
  remove(id) {
    const next = this.items.filter(item => item.id !== id);
    if (!this.write(CORE_STORAGE.library, next)) throw new Error(this.error);
    this.items = next;
  }
  inspect() { return { keys: CORE_STORAGE, restored: this.restored, lastSaved: this.lastSaved, error: this.error, count: this.items.length, items: this.items.map(item => ({ id: item.id, name: item.name, seed: item.config.seed, preset: item.config.preset, phase: item.config.phase, thumbnailBytes: item.thumbnail.length, savedAt: item.savedAt })) }; }
}

export class CoreHistory {
  constructor(snapshot) { this.entries = [structuredClone(snapshot)]; this.cursor = 0; }
  commit(snapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(this.entries[this.cursor])) return false;
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(structuredClone(snapshot));
    if (this.entries.length > 40) this.entries.shift();
    this.cursor = this.entries.length - 1; return true;
  }
  back() { if (!this.cursor) return null; return structuredClone(this.entries[--this.cursor]); }
  forward() { if (this.cursor >= this.entries.length - 1) return null; return structuredClone(this.entries[++this.cursor]); }
  inspect() { return { length: this.entries.length, cursor: this.cursor, canUndo: this.cursor > 0, canRedo: this.cursor < this.entries.length - 1 }; }
}
