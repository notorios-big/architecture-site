// src/lib/api.js
const getServerBase = () => {
  if (typeof window === 'undefined') return '';
  return (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000' 
    : '';
};

const getEmbeddingsBatch = async (texts) => {
  const serverBase = getServerBase();
  const resp = await fetch(`${serverBase}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts })
  });

  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    try {
      const e = await resp.json();
      msg = e?.error || msg;
    } catch {}
    throw new Error('Servidor: ' + msg);
  }

  const data = await resp.json();
  const arr = data?.embeddings;
  if (!Array.isArray(arr) || !Array.isArray(arr[0])) {
    throw new Error('Respuesta sin embeddings válidos');
  }
  return arr;
};

// Hacer disponible globalmente
window.getEmbeddingsBatch = getEmbeddingsBatch;

