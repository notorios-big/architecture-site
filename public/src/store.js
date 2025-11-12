// src/store.js
const { useState, useEffect, useCallback } = React;

const useStore = () => {
  const [keywords, setKeywords] = useState([]);
  const [tree, setTree] = useState(() => {
    const raw = window.storage.getItem('keywordTree');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  const [threshold, setThreshold] = useState(Number(window.storage.getItem('threshold') || 0.8));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [keywordModal, setKeywordModal] = useState(null);

  // Persistir threshold y tree
  useEffect(() => {
    window.storage.setItem('threshold', String(threshold));
  }, [threshold]);

  useEffect(() => {
    window.storage.setItem('keywordTree', JSON.stringify(tree));
  }, [tree]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const onCSV = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => setError('Error al leer el archivo CSV');
    reader.onload = (ev) => {
      try {
        const kws = window.parseCSV(String(ev.target.result || ''));
        if (!kws.length) {
          setError('CSV inválido: no hay filas válidas.');
          return;
        }
        setKeywords(kws);
        const sortedKws = [...kws].sort((a, b) => (b.volume || 0) - (a.volume || 0));
        const root = {
          id: 'root',
          name: 'Sin agrupar',
          isGroup: true,
          collapsed: false,
          children: sortedKws
        };
        setTree([root]);
        setError('');
        setSuccess(`${kws.length} keywords cargadas exitosamente`);
      } catch (err) {
        setError('Error al procesar CSV: ' + (err?.message || err));
      }
    };
    reader.readAsText(f);
  };

  const autoGroup = async () => {
    if (!keywords.length) {
      setError('Primero carga un CSV.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const texts = keywords.map(k => k.keyword);
      const embeddings = await window.getEmbeddingsBatch(texts);
      const withEmbeds = keywords.map((kw, i) => ({ ...kw, embedding: embeddings[i] }));

      // 1. Calcular matriz de similitud completa
      const similarities = [];
      for (let i = 0; i < withEmbeds.length; i++) {
        similarities[i] = [];
        for (let j = 0; j < withEmbeds.length; j++) {
          similarities[i][j] = window.cosine(withEmbeds[i].embedding, withEmbeds[j].embedding);
        }
      }

      // 2. Calcular centralidad (degree) de cada keyword
      // Cuántas conexiones >= threshold tiene cada una
      const degrees = withEmbeds.map((kw, i) => {
        const degree = similarities[i].filter(s => s >= threshold).length - 1; // -1 para no contar consigo misma
        return { index: i, degree };
      });

      // 3. Ordenar por centralidad descendente (más conectadas primero)
      degrees.sort((a, b) => b.degree - a.degree);

      // 4. Aplicar algoritmo greedy-clique con orden por centralidad
      const groups = [];
      const used = new Set();

      for (const { index: i } of degrees) {
        if (used.has(i)) continue;

        const base = withEmbeds[i];
        const g = [base];
        used.add(i);

        // Evaluar candidatos en orden de centralidad
        for (const { index: j } of degrees) {
          if (used.has(j)) continue;

          // Verificar que j forme un clique completo con todos los miembros de g
          let isClique = true;
          for (const member of g) {
            const memberIdx = withEmbeds.indexOf(member);
            if (similarities[memberIdx][j] < threshold) {
              isClique = false;
              break;
            }
          }

          if (isClique) {
            g.push(withEmbeds[j]);
            used.add(j);
          }
        }

        const top = g.reduce((m, x) => (x.volume > m.volume ? x : m), g[0]);
        groups.push({
          id: window.uid('group'),
          name: top.keyword,
          isGroup: true,
          collapsed: false,
          children: g.map(({ embedding, ...rest }) => rest),
        });
      }

      const sortedGroups = window.sortGroupChildren(groups);
      setTree(sortedGroups);
      setSuccess(`Agrupación completada: ${groups.length} grupos creados`);
    } catch (err) {
      setError('Error al agrupar: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = (id) => {
    const walk = (nodes) => nodes.map(n => {
      if (n.id === id) return { ...n, collapsed: !n.collapsed };
      if (n.children) return { ...n, children: walk(n.children) };
      return n;
    });
    setTree(prev => walk(prev));
  };

  const collapseAll = () => {
    const walk = (nodes) => nodes.map(n => {
      if (n.isGroup) {
        const collapsed = { ...n, collapsed: true };
        if (n.children) return { ...collapsed, children: walk(n.children) };
        return collapsed;
      }
      return n;
    });
    setTree(prev => walk(prev));
  };

  const renameNode = (id, name) => {
    const walk = (nodes) => nodes.map(n => {
      if (n.id === id) return { ...n, name };
      if (n.children) return { ...n, children: walk(n.children) };
      return n;
    });
    setTree(prev => walk(prev));
  };

  const deleteNode = (id) => {
    const del = (nodes) => nodes
      .filter(n => n.id !== id)
      .map(n => n.children ? ({ ...n, children: del(n.children) }) : n);
    setTree(prev => del(prev));
  };

  const onDrop = useCallback((target, dragged) => {
    if (!target.isGroup) return;
    if (target.id === dragged.id) return;

    setTree(prevTree => {
      const draggedTreeNode = window.findNode(dragged.id, prevTree);
      if (!draggedTreeNode) return prevTree;
      if (window.isDescendant(target.id, draggedTreeNode)) return prevTree;
      if (window.isDescendant(draggedTreeNode.id, target)) return prevTree;

      const removed = window.removeNode(draggedTreeNode.id, prevTree);
      const updated = window.insertInto(target.id, draggedTreeNode, removed.arr);

      window.volumeCacheRef.current.delete(target.id);
      window.volumeCacheRef.current.delete(draggedTreeNode.id);

      const sortedTree = window.sortOnlyAffectedNode(updated, target.id);
      return sortedTree;
    });

    setSuccess('Nodo movido correctamente');
  }, []);

  const addGroup = () => {
    const g = { id: window.uid('group'), name: 'Nuevo Grupo', isGroup: true, collapsed: false, children: [] };
    setTree(prev => Array.isArray(prev) ? [...prev, g] : [g]);
    setError('');
    setSuccess('Nuevo grupo creado');
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keyword-tree.json';
    a.click();
    URL.revokeObjectURL(url);
    setSuccess('Archivo exportado correctamente');
  };

  const importJSON = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => setError('Error al leer JSON');
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(String(ev.target.result || ''));
        if (!Array.isArray(obj)) throw new Error('Estructura inválida (se esperaba un array)');
        const sorted = window.sortGroupChildren(obj);
        setTree(sorted);
        setError('');
        setSuccess('Archivo importado correctamente');
      } catch (err) {
        setError('Import inválido: ' + (err?.message || err));
      }
    };
    reader.readAsText(f);
  };

  const clearAll = () => {
    if (!window.confirm('¿Estás seguro de que quieres borrar todo? Esta acción no se puede deshacer.')) {
      return;
    }
    setKeywords([]);
    setTree([]);
    setError('');
    setSuccess('Todo ha sido eliminado');
  };

  const toggleFlowNode = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Refinar grupos con LLM
  const refineGroups = async () => {
    const onlyGroups = tree.filter(node => node.isGroup);

    if (onlyGroups.length === 0) {
      setError('No hay grupos para refinar. Primero ejecuta el agrupamiento automático.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const suggestions = await window.refineGroupsWithLLM(
        tree,
        12,
        (batchIndex, totalBatches) => {
          setSuccess(`Procesando batch ${batchIndex + 1}/${totalBatches}...`);
        }
      );

      // Aplicar sugerencias al árbol
      let updatedTree = [...tree];

      // 1. Aplicar renombres primero (más simple)
      if (suggestions.renames && suggestions.renames.length > 0) {
        suggestions.renames.forEach(rename => {
          const groupId = rename.groupId;
          updatedTree = updatedTree.map(node => {
            if (node.id === groupId) {
              return { ...node, name: rename.suggestedName };
            }
            return node;
          });
        });
        console.log(`✅ Aplicados ${suggestions.renames.length} renombres`);
      }

      // 2. Aplicar splits (dividir grupos)
      if (suggestions.splits && suggestions.splits.length > 0) {
        suggestions.splits.forEach(split => {
          const groupId = split.groupId;
          const groupIndex = updatedTree.findIndex(n => n.id === groupId);

          if (groupIndex === -1) return;

          const originalGroup = updatedTree[groupIndex];
          const newGroups = split.newGroups.map(ng => {
            // Encontrar los nodos keyword correspondientes
            const keywordNodes = ng.keywords.map(kwText => {
              return originalGroup.children?.find(child =>
                (child.keyword === kwText || child.name === kwText)
              );
            }).filter(Boolean);

            return {
              id: window.uid('group'),
              name: ng.suggestedName,
              isGroup: true,
              collapsed: false,
              children: keywordNodes,
              volume: keywordNodes.reduce((sum, kw) => sum + (kw.volume || 0), 0)
            };
          });

          // Reemplazar el grupo original con los nuevos grupos
          updatedTree.splice(groupIndex, 1, ...newGroups);
        });
        console.log(`✅ Aplicadas ${suggestions.splits.length} divisiones`);
      }

      // 3. Aplicar merges (fusionar grupos)
      if (suggestions.merges && suggestions.merges.length > 0) {
        suggestions.merges.forEach(merge => {
          const groupIds = merge.groupIds;
          const groupsToMerge = groupIds.map(gid =>
            updatedTree.find(n => n.id === gid)
          ).filter(Boolean);

          if (groupsToMerge.length < 2) return;

          // Combinar todos los children
          const mergedChildren = [];
          groupsToMerge.forEach(group => {
            if (group.children) {
              mergedChildren.push(...group.children);
            }
          });

          // Crear nuevo grupo fusionado
          const mergedGroup = {
            id: window.uid('group'),
            name: merge.suggestedName,
            isGroup: true,
            collapsed: false,
            children: mergedChildren,
            volume: mergedChildren.reduce((sum, kw) => sum + (kw.volume || 0), 0)
          };

          // Eliminar grupos originales y agregar el fusionado
          updatedTree = updatedTree.filter(n => !groupIds.includes(n.id));
          updatedTree.push(mergedGroup);
        });
        console.log(`✅ Aplicadas ${suggestions.merges.length} fusiones`);
      }

      // Ordenar el árbol final
      const sortedTree = window.sortGroupChildren(updatedTree);
      setTree(sortedTree);

      // Mensaje de éxito con resumen
      const summary = [];
      if (suggestions.merges.length > 0) summary.push(`${suggestions.merges.length} fusiones`);
      if (suggestions.splits.length > 0) summary.push(`${suggestions.splits.length} divisiones`);
      if (suggestions.renames.length > 0) summary.push(`${suggestions.renames.length} renombres`);

      setSuccess(`Refinamiento completado: ${summary.join(', ')}`);
    } catch (err) {
      setError('Error al refinar grupos: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Fusionar grupos similares con LLM (Paso 2.5)
  const mergeSimilarGroups = async (threshold = 0.6) => {
    const onlyGroups = tree.filter(node => node.isGroup);

    if (onlyGroups.length < 2) {
      setError('Se necesitan al menos 2 grupos para detectar fusiones.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Llamar a la función de fusión con embeddings
      const result = await window.mergeGroupsWithLLM(
        tree,
        threshold,
        (message) => {
          setSuccess(message);
        }
      );

      const merges = result.merges || [];

      if (merges.length === 0) {
        setSuccess('No se encontraron grupos similares para fusionar');
        setLoading(false);
        return;
      }

      // Aplicar fusiones al árbol
      console.log(`\n4️⃣ Aplicando ${merges.length} fusiones...`);
      let updatedTree = [...tree];

      // IMPORTANTE: Crear un mapa de índice -> ID de grupo antes de empezar
      // porque los índices cambian después de cada fusión
      const onlyGroups = tree.filter(node => node.isGroup);
      const groupIdMap = new Map();
      onlyGroups.forEach((group, idx) => {
        groupIdMap.set(idx, group.id);
      });

      merges.forEach((merge, mergeIdx) => {
        console.log(`\n   Fusión ${mergeIdx + 1}/${merges.length}:`);

        const groupIndices = merge.groupIndices;

        // Convertir índices a IDs y buscar grupos en el árbol actual
        const groupIds = groupIndices.map(idx => groupIdMap.get(idx)).filter(Boolean);
        const groupsToMerge = groupIds
          .map(id => updatedTree.find(n => n.id === id))
          .filter(Boolean);

        if (groupsToMerge.length < 2) {
          console.warn(`   ⚠️ Solo se encontraron ${groupsToMerge.length} grupos, saltando...`);
          return;
        }

        console.log(`   Fusionando: ${groupsToMerge.map(g => `"${g.name}"`).join(' + ')}`);
        console.log(`   Nuevo nombre: "${merge.suggestedName}"`);

        // Combinar todos los children (keywords)
        const mergedChildren = [];
        const seenKeywords = new Set();

        groupsToMerge.forEach(group => {
          if (group.children) {
            group.children.forEach(child => {
              // Evitar duplicados basados en keyword
              const kwText = child.keyword || child.name || '';
              if (!child.isGroup && kwText && !seenKeywords.has(kwText.toLowerCase())) {
                seenKeywords.add(kwText.toLowerCase());
                mergedChildren.push(child);
              }
            });
          }
        });

        // Calcular volumen total del grupo fusionado
        const totalVolume = mergedChildren.reduce((sum, kw) => sum + (kw.volume || 0), 0);

        // Crear nuevo grupo fusionado
        const mergedGroup = {
          id: window.uid('group'),
          name: merge.suggestedName,
          isGroup: true,
          collapsed: false,
          children: mergedChildren,
          volume: totalVolume
        };

        console.log(`   ✓ Fusionado: ${mergedChildren.length} keywords, volumen: ${totalVolume.toLocaleString()}`);

        // Eliminar grupos originales del árbol
        const groupIdsToRemove = groupsToMerge.map(g => g.id);
        updatedTree = updatedTree.filter(n => !groupIdsToRemove.includes(n.id));

        // Agregar el grupo fusionado
        updatedTree.push(mergedGroup);
      });

      // Ordenar el árbol final
      const sortedTree = window.sortGroupChildren(updatedTree);
      setTree(sortedTree);

      // Mensaje de éxito
      const totalGroupsMerged = merges.reduce((sum, m) => sum + m.groupIndices.length, 0);
      setSuccess(`Fusión completada: ${merges.length} fusiones realizadas (${totalGroupsMerged} grupos → ${merges.length} grupos)`);

      console.log(`\n✅ Fusión de grupos completada`);
      console.log(`   - ${merges.length} fusiones realizadas`);
      console.log(`   - ${totalGroupsMerged} grupos originales → ${merges.length} grupos fusionados`);
      console.log(`   - Árbol final: ${sortedTree.length} nodos de nivel superior`);

    } catch (err) {
      console.error('❌ Error en mergeSimilarGroups:', err);
      setError('Error al fusionar grupos: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return {
    // Estado
    keywords,
    tree,
    threshold,
    loading,
    error,
    success,
    dragging,
    dragOver,
    editingId,
    editingText,
    expandedNodes,
    keywordModal,
    // Setters
    setThreshold,
    setError,
    setSuccess,
    setDragging,
    setDragOver,
    setEditingId,
    setEditingText,
    setKeywordModal,
    // Acciones
    onCSV,
    autoGroup,
    refineGroups,
    mergeSimilarGroups,
    toggleCollapse,
    collapseAll,
    renameNode,
    deleteNode,
    onDrop,
    addGroup,
    exportJSON,
    importJSON,
    clearAll,
    toggleFlowNode
  };
};

// Hacer disponible globalmente
window.useStore = useStore;

