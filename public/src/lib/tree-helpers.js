// src/lib/tree-helpers.js
// Función para calcular volumen de grupo recursivamente
const directGroupVolume = (node) => {
  if (!node.children) return 0;
  const cache = window.volumeCacheRef.current;
  return node.children.reduce((sum, child) => {
    if (child?.isGroup) {
      const cached = cache.get(child.id);
      if (cached !== undefined) return sum + cached;
      const vol = directGroupVolume(child);
      cache.set(child.id, vol);
      return sum + vol;
    }
    return sum + (child?.volume || 0);
  }, 0);
};

// Función para obtener volumen de un nodo
const nodeVolume = (node) => {
  if (!node?.isGroup) return node?.volume || 0;
  const cache = window.volumeCacheRef.current;
  const cached = cache.get(node.id);
  if (cached !== undefined) return cached;
  const vol = directGroupVolume(node);
  cache.set(node.id, vol);
  return vol;
};

// Hacer disponible globalmente
window.nodeVolume = nodeVolume;

