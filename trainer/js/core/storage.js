// Storage adapter. Everything the app persists goes through here, so the
// localStorage backend can later be swapped for a synced account backend
// without touching the modules.

const PREFIX = 'svenka:';
const EXPORT_FORMAT = 'svenka-backup';
const EXPORT_VERSION = 1;

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.warn('storage.set failed', key, err);
    }
  },

  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },

  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
      }
    } catch { /* ignore */ }
    return out;
  },

  // The API key is deliberately left out of exports so backups can be shared safely.
  exportAll() {
    const data = {};
    for (const k of this.keys()) data[k] = this.get(k);
    if (data.settings) data.settings = { ...data.settings, apiKey: '' };
    return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data };
  },

  importAll(payload) {
    if (!payload || payload.format !== EXPORT_FORMAT || typeof payload.data !== 'object') {
      throw new Error('Filen är inte en giltig Svenka-backup.');
    }
    const currentKey = this.get('settings', {})?.apiKey || '';
    for (const [k, v] of Object.entries(payload.data)) this.set(k, v);
    // Keep the key that is already on this device.
    const settings = this.get('settings', {});
    if (!settings.apiKey && currentKey) this.set('settings', { ...settings, apiKey: currentKey });
  },

  clearAll() {
    for (const k of this.keys()) this.remove(k);
  },
};
