// src/lib/tree-helpers.js - ES Module
import { volumeCacheRef } from './tree.js';

// Función para calcular volumen de grupo SOLO con keywords directas
export const directGroupVolume = (node) => {
  if (!node.children) return 0;
  // Solo sumar las keywords directas (NO sumar subgrupos)
  return node.children.reduce((sum, child) => {
    // Si es un grupo, NO lo sumamos (solo keywords directas)
    if (child?.isGroup) return sum;
    // Si es una keyword, la sumamos
    return sum + (child?.volume || 0);
  }, 0);
};

// Función para calcular volumen TOTAL (recursivo, incluye todos los descendientes)
export const totalGroupVolume = (node) => {
  if (!node?.isGroup) return node?.volume || 0;

  if (!node.children) return 0;

  // Sumar TODAS las keywords de este grupo y todos sus subgrupos recursivamente
  return node.children.reduce((sum, child) => {
    if (child?.isGroup) {
      // Si es un grupo, sumamos recursivamente todo lo que tiene dentro
      return sum + totalGroupVolume(child);
    }
    // Si es una keyword, la sumamos
    return sum + (child?.volume || 0);
  }, 0);
};

// Función para obtener volumen de un nodo (solo keywords directas)
export const nodeVolume = (node) => {
  if (!node?.isGroup) return node?.volume || 0;
  const cache = volumeCacheRef.current;
  const cached = cache.get(node.id);
  if (cached !== undefined) return cached;
  const vol = directGroupVolume(node);
  cache.set(node.id, vol);
  return vol;
};
