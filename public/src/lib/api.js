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

/**
 * Refinar grupos usando Claude Sonnet 4.5
 * Procesa grupos en batches para evitar saturar el modelo
 * @param {Array} groups - Array de grupos a refinar
 * @param {number} batchSize - Cantidad de grupos por batch (default: 12)
 * @param {Function} onProgress - Callback de progreso (batchIndex, totalBatches)
 * @returns {Promise<Object>} Sugerencias agregadas de todos los batches
 */
const refineGroupsWithLLM = async (groups, batchSize = 12, onProgress = null) => {
  const serverBase = getServerBase();

  // Filtrar solo los grupos (no keywords sueltas)
  const onlyGroups = groups.filter(node => node.isGroup);

  if (onlyGroups.length === 0) {
    throw new Error('No hay grupos para refinar');
  }

  // Dividir en batches
  const batches = [];
  for (let i = 0; i < onlyGroups.length; i += batchSize) {
    batches.push(onlyGroups.slice(i, i + batchSize));
  }

  console.log(`🔍 Refinando ${onlyGroups.length} grupos en ${batches.length} batches...`);

  // Procesar cada batch
  const allSuggestions = {
    merges: [],
    splits: [],
    renames: [],
    keepAsIs: []
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    if (onProgress) {
      onProgress(i, batches.length);
    }

    // Preparar datos del batch
    const batchData = batch.map(group => ({
      id: group.id,
      name: group.name,
      volume: group.volume,
      keywords: (group.children || [])
        .filter(child => !child.isGroup)
        .map(child => child.keyword || child.name)
    }));

    // Llamar al endpoint
    const resp = await fetch(`${serverBase}/api/refine-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groups: batchData,
        batchIndex: i,
        totalBatches: batches.length
      })
    });

    if (!resp.ok) {
      let msg = 'HTTP ' + resp.status;
      try {
        const e = await resp.json();
        msg = e?.error || msg;
      } catch {}
      throw new Error('Error al refinar grupos: ' + msg);
    }

    const result = await resp.json();
    const suggestions = result.suggestions;

    // Ajustar índices relativos al batch a índices globales
    const batchOffset = i * batchSize;

    // Agregar sugerencias ajustando índices
    if (suggestions.merges) {
      suggestions.merges.forEach(merge => {
        allSuggestions.merges.push({
          ...merge,
          groupIndices: merge.groupIndices.map(idx => idx + batchOffset),
          groupIds: merge.groupIndices.map(idx => batch[idx].id)
        });
      });
    }

    if (suggestions.splits) {
      suggestions.splits.forEach(split => {
        allSuggestions.splits.push({
          ...split,
          groupIndex: split.groupIndex + batchOffset,
          groupId: batch[split.groupIndex].id
        });
      });
    }

    if (suggestions.renames) {
      suggestions.renames.forEach(rename => {
        allSuggestions.renames.push({
          ...rename,
          groupIndex: rename.groupIndex + batchOffset,
          groupId: batch[rename.groupIndex].id
        });
      });
    }

    if (suggestions.keepAsIs) {
      allSuggestions.keepAsIs.push(
        ...suggestions.keepAsIs.map(idx => idx + batchOffset)
      );
    }

    console.log(`✅ Batch ${i + 1}/${batches.length} completado`);
    console.log(`   Uso de tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);

    // Pequeña pausa entre batches para no saturar la API
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n📊 Resumen de sugerencias:');
  console.log(`   - ${allSuggestions.merges.length} fusiones de grupos`);
  console.log(`   - ${allSuggestions.splits.length} divisiones de grupos`);
  console.log(`   - ${allSuggestions.renames.length} renombres`);
  console.log(`   - ${allSuggestions.keepAsIs.length} grupos sin cambios`);

  return allSuggestions;
};

// Hacer disponible globalmente
window.getEmbeddingsBatch = getEmbeddingsBatch;
window.refineGroupsWithLLM = refineGroupsWithLLM;

