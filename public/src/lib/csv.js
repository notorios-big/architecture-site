// src/lib/csv.js
const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseCSV = (text) => {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);
  const out = [];
  rows.forEach((line) => {
    let keyword = '', volume = '0';
    if (line.includes('"')) {
      const parts = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) {
          parts.push(cur);
          cur = '';
        } else cur += ch;
      }
      parts.push(cur);
      keyword = (parts[0] ?? '').trim();
      volume = (parts[1] ?? '0').trim();
    } else {
      const parts = line.split(',').map(s => s.trim());
      keyword = parts[0] ?? '';
      volume = parts[1] ?? '0';
    }
    if (keyword) out.push({
      id: uid('kw'),
      keyword,
      volume: Number(volume.replace(/\./g, '').replace(/\s/g, '')) || 0,
      isGroup: false
    });
  });
  return out;
};

// Hacer disponible globalmente
window.uid = uid;
window.parseCSV = parseCSV;

