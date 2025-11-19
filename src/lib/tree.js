// src/lib/tree.js - ES Module
import { totalGroupVolume } from './tree-helpers.js';

// Cache de volúmenes global
export const volumeCacheRef = { current: new Map() };

// Función auxiliar para verificar si un nodo contiene un descendiente
export const hasDescendant = (node, targetId) => {
  if (!node.children) return false;
  for (const child of node.children) {
    if (child.id === targetId) return true;
    if (child.isGroup && hasDescendant(child, targetId)) return true;
  }
  return false;
};

// Función auxiliar para ordenar solo un array de nodos (sin recursión)
export const sortChildren = (nodes) => {
  return [...nodes].sort((a, b) => {
    const aIsGroup = !!a?.isGroup;
    const bIsGroup = !!b?.isGroup;
    if (aIsGroup !== bIsGroup) return aIsGroup ? 1 : -1;

    // Usar totalGroupVolume para ordenar (incluye todos los descendientes)
    const volA = totalGroupVolume(a);
    const volB = totalGroupVolume(b);
    if (volB !== volA) return volB - volA;

    const labelA = (aIsGroup ? (a.name || '') : (a.keyword || '')).toLowerCase();
    const labelB = (bIsGroup ? (b.name || '') : (b.keyword || '')).toLowerCase();
    return labelA.localeCompare(labelB);
  });
};

// Función para ordenar solo un nodo específico y sus ancestros
export const sortOnlyAffectedNode = (tree, targetId) => {
  const walkAndSort = (nodes) => {
    return nodes.map(n => {
      const isTarget = n.id === targetId;
      const hasTargetInChildren = n.children && n.children.some(child =>
        child.id === targetId || (child.isGroup && hasDescendant(child, targetId))
      );

      if (n.isGroup && n.children) {
        const updatedChildren = walkAndSort(n.children);

        if (isTarget || hasTargetInChildren) {
          return {
            ...n,
            children: sortChildren(updatedChildren)
          };
        }

        return { ...n, children: updatedChildren };
      }
      return n;
    });
  };

  const sorted = walkAndSort(tree);
  return sortChildren(sorted);
};

// Función para ordenar recursivamente todos los nodos
export const sortGroupChildren = (nodes) => {
  volumeCacheRef.current.clear();

  const sortedNodes = [...nodes].sort((a, b) => {
    const aIsGroup = !!a?.isGroup;
    const bIsGroup = !!b?.isGroup;
    if (aIsGroup !== bIsGroup) return aIsGroup ? 1 : -1;
    // Usar totalGroupVolume para ordenar (incluye todos los descendientes)
    const volA = totalGroupVolume(a);
    const volB = totalGroupVolume(b);
    if (volB !== volA) return volB - volA;
    const labelA = (aIsGroup ? (a.name || '') : (a.keyword || '')).toLowerCase();
    const labelB = (bIsGroup ? (b.name || '') : (b.keyword || '')).toLowerCase();
    return labelA.localeCompare(labelB);
  }).map(n => {
    if (n.isGroup && n.children) {
      return { ...n, children: sortGroupChildren(n.children) };
    }
    return n;
  });
  return sortedNodes;
};

// Funciones auxiliares para manipular el árbol
export const findNode = (id, nodes) => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const x = findNode(id, n.children);
      if (x) return x;
    }
  }
  return null;
};

export const isDescendant = (rootId, target) => {
  if (!target?.children) return false;
  for (const ch of target.children) {
    if (ch.id === rootId) return true;
    if (isDescendant(rootId, ch)) return true;
  }
  return false;
};

export const removeNode = (id, nodes) => {
  let removed = null;
  const walk = (arr) => {
    const out = [];
    for (const n of arr) {
      if (n.id === id) {
        removed = n;
        continue;
      }
      if (n.children) {
        const res = walk(n.children);
        out.push({ ...n, children: res.arr });
        if (res.removed) removed = res.removed;
      } else out.push(n);
    }
    return { arr: out, removed };
  };
  return walk(nodes);
};

export const insertInto = (targetId, node, nodes) => {
  const walk = (arr) => arr.map(n => {
    if (n.id === targetId) {
      const kids = n.children ? [...n.children, node] : [node];
      return { ...n, children: kids };
    }
    if (n.children) return { ...n, children: walk(n.children) };
    return n;
  });
  return walk(nodes);
};
