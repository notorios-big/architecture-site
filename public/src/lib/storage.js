// src/lib/storage.js
const storage = {
  data: {},
  ok: false,
  init() {
    try {
      const k = '__t__';
      localStorage.setItem(k, k);
      localStorage.removeItem(k);
      this.ok = true;
    } catch {
      this.ok = false;
    }
  },
  getItem(k) {
    return this.ok ? localStorage.getItem(k) : (this.data[k] ?? null);
  },
  setItem(k, v) {
    this.ok ? localStorage.setItem(k, v) : (this.data[k] = v);
  },
  removeItem(k) {
    this.ok ? localStorage.removeItem(k) : delete this.data[k];
  }
};
storage.init();

// Hacer disponible globalmente
window.storage = storage;

