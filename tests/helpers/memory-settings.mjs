export function memorySettingsStore() {
  const entries = new Map(); let sequence = 0;
  return {
    async getWithMetadata(key) { return structuredClone(entries.get(key) || null); },
    async setJSON(key, data, conditions = {}) {
      const current = entries.get(key);
      if (conditions.onlyIfNew && current || conditions.onlyIfMatch && current?.etag !== conditions.onlyIfMatch) return { modified: false };
      const etag = `version-${++sequence}`;
      entries.set(key, { data: structuredClone(data), etag });
      return { modified: true, etag };
    },
  };
}
