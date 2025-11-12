// src/lib/group-merger.js
// Lógica para detectar y fusionar grupos similares (Paso 2.5)

/**
 * Calcula el embedding promedio de un grupo (LEGACY - no usado en el flujo optimizado)
 * NOTA: La implementación optimizada obtiene todos los embeddings en batch primero
 * @param {Object} group - Grupo con children que contienen embeddings
 * @returns {Array<number>} - Vector promedio de dimensión 3072
 */
const computeGroupEmbedding = (group) => {
  const children = group.children || [];

  // Filtrar solo keywords (no subgrupos) que tengan embedding
  const keywordsWithEmbeddings = children.filter(child =>
    !child.isGroup && child.embedding && Array.isArray(child.embedding)
  );

  if (keywordsWithEmbeddings.length === 0) {
    console.warn(`Grupo "${group.name}" no tiene keywords con embeddings`);
    return null;
  }

  // Calcular promedio elemento por elemento
  const embeddingDim = keywordsWithEmbeddings[0].embedding.length;
  const avgEmbedding = new Array(embeddingDim).fill(0);

  keywordsWithEmbeddings.forEach(kw => {
    kw.embedding.forEach((val, i) => {
      avgEmbedding[i] += val;
    });
  });

  avgEmbedding.forEach((_, i) => {
    avgEmbedding[i] /= keywordsWithEmbeddings.length;
  });

  return avgEmbedding;
};

/**
 * Construye matriz de similitud coseno entre grupos
 * @param {Array<Array<number>>} embeddings - Array de embeddings de grupos
 * @returns {Array<Array<number>>} - Matriz de similitud NxN
 */
const buildSimilarityMatrix = (embeddings) => {
  const n = embeddings.length;
  const similarities = [];

  for (let i = 0; i < n; i++) {
    similarities[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        similarities[i][j] = 1.0;
      } else if (j < i) {
        // Aprovechar simetría
        similarities[i][j] = similarities[j][i];
      } else {
        similarities[i][j] = window.cosine(embeddings[i], embeddings[j]);
      }
    }
  }

  return similarities;
};

/**
 * Encuentra cliques de grupos usando algoritmo greedy
 * Similar al algoritmo usado para keywords, pero aplicado a grupos
 * @param {Array<Object>} groups - Array de grupos
 * @param {Array<Array<number>>} embeddings - Embeddings de los grupos
 * @param {number} threshold - Umbral de similitud (default: 0.6)
 * @returns {Array<Array<number>>} - Array de cliques (cada clique es un array de índices)
 */
const findGroupCliques = (groups, embeddings, threshold = 0.6) => {
  console.log(`🔍 Buscando cliques con threshold ${threshold}...`);

  // 1. Construir matriz de similitud
  const similarities = buildSimilarityMatrix(embeddings);

  // 2. Calcular centralidad (degree) de cada grupo
  // Cuántas conexiones >= threshold tiene cada uno
  const degrees = groups.map((_, i) => {
    const degree = similarities[i].filter(s => s >= threshold).length - 1; // -1 para no contar consigo mismo
    return { index: i, degree };
  });

  // 3. Ordenar por centralidad descendente (más conectados primero)
  degrees.sort((a, b) => b.degree - a.degree);

  // 4. Aplicar algoritmo greedy-clique
  const cliques = [];
  const assigned = new Set();

  for (const { index: i } of degrees) {
    if (assigned.has(i)) continue;

    // Iniciar clique con este grupo
    const clique = [i];
    assigned.add(i);

    // Evaluar candidatos en orden de centralidad
    for (const { index: j } of degrees) {
      if (assigned.has(j)) continue;

      // Verificar que j forme un clique completo con todos los miembros actuales
      let isClique = true;
      for (const memberIdx of clique) {
        if (similarities[memberIdx][j] < threshold) {
          isClique = false;
          break;
        }
      }

      if (isClique) {
        clique.push(j);
        assigned.add(j);
      }
    }

    // Solo guardar cliques con 2+ grupos
    if (clique.length >= 2) {
      cliques.push(clique);
      console.log(`   ✓ Clique encontrado: ${clique.length} grupos (índices: ${clique.join(', ')})`);
    }
  }

  console.log(`✅ Total: ${cliques.length} cliques encontrados`);
  return cliques;
};

/**
 * Calcula el volumen total de un grupo (solo keywords directas)
 * @param {Object} group - Grupo
 * @returns {number} - Volumen total
 */
const calculateGroupVolume = (group) => {
  if (!group.children) return 0;
  return group.children.reduce((sum, child) => {
    if (child.isGroup) return sum; // No contar subgrupos
    return sum + (child.volume || 0);
  }, 0);
};

/**
 * Función principal: detecta y fusiona grupos similares
 * @param {Array<Object>} tree - Árbol de grupos actual
 * @param {number} threshold - Umbral de similitud (default: 0.6)
 * @param {Function} progressCallback - Callback para reportar progreso
 * @returns {Promise<Object>} - Sugerencias de fusión
 */
const mergeGroupsWithLLM = async (tree, threshold = 0.6, progressCallback = null) => {
  console.log('\n════════════════════════════════════════════════════');
  console.log('🔄 PASO 2.5: DETECTAR Y FUSIONAR GRUPOS SIMILARES');
  console.log('════════════════════════════════════════════════════\n');

  try {
    // Filtrar solo grupos de nivel superior
    const groups = tree.filter(node => node.isGroup);

    if (groups.length < 2) {
      console.log('⚠️ Se necesitan al menos 2 grupos para fusionar');
      return { merges: [] };
    }

    console.log(`📊 Analizando ${groups.length} grupos...`);

    if (progressCallback) {
      progressCallback('Obteniendo embeddings de todas las keywords...');
    }

    // PASO 1: Obtener embeddings de TODAS las keywords de TODOS los grupos (batching eficiente)
    console.log('\n1️⃣ Obteniendo embeddings de todas las keywords en batches...');

    // 1.1 Recolectar TODAS las keywords de TODOS los grupos
    const groupKeywordMap = [];
    const allKeywords = [];

    groups.forEach((group, groupIdx) => {
      const keywords = (group.children || []).filter(child => !child.isGroup);

      if (keywords.length === 0) {
        console.warn(`   ⚠️ Grupo "${group.name}" sin keywords, saltando...`);
        groupKeywordMap.push({ group, originalIndex: groupIdx, keywordIndices: [] });
        return;
      }

      const startIdx = allKeywords.length;
      const keywordTexts = keywords.map(kw => kw.keyword || kw.name);
      allKeywords.push(...keywordTexts);
      const endIdx = allKeywords.length;

      groupKeywordMap.push({
        group,
        originalIndex: groupIdx,
        keywordIndices: Array.from({ length: endIdx - startIdx }, (_, i) => startIdx + i)
      });
    });

    console.log(`   📊 Total: ${allKeywords.length} keywords de ${groups.length} grupos`);

    if (allKeywords.length === 0) {
      console.log('⚠️ No hay keywords para procesar');
      return { merges: [] };
    }

    // 1.2 Obtener TODOS los embeddings en una sola llamada (el servidor hace batching de 100)
    const serverBase = (window.location.protocol === 'file:' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : '';

    if (progressCallback) {
      progressCallback(`Generando embeddings de ${allKeywords.length} keywords...`);
    }

    const allEmbeddings = await window.getEmbeddingsBatch(allKeywords);
    console.log(`   ✓ ${allEmbeddings.length} embeddings obtenidos`);

    // 1.3 Calcular promedio (np.mean) para cada grupo
    if (progressCallback) {
      progressCallback('Calculando embeddings promedio por grupo...');
    }

    console.log('\n   Calculando promedios por grupo...');
    const groupsWithEmbeddings = [];
    const embeddingDim = allEmbeddings[0].length;

    groupKeywordMap.forEach(({ group, originalIndex, keywordIndices }) => {
      if (keywordIndices.length === 0) return;

      // Calcular promedio de los embeddings de este grupo
      const avgEmbedding = new Array(embeddingDim).fill(0);

      keywordIndices.forEach(idx => {
        const emb = allEmbeddings[idx];
        emb.forEach((val, i) => {
          avgEmbedding[i] += val;
        });
      });

      avgEmbedding.forEach((_, i) => {
        avgEmbedding[i] /= keywordIndices.length;
      });

      groupsWithEmbeddings.push({ group, embedding: avgEmbedding, originalIndex });
    });

    console.log(`   ✓ ${groupsWithEmbeddings.length}/${groups.length} grupos con embeddings válidos`);

    if (groupsWithEmbeddings.length < 2) {
      console.log('⚠️ Muy pocos grupos con embeddings para fusionar');
      return { merges: [] };
    }

    if (progressCallback) {
      progressCallback('Construyendo grafo de similitud...');
    }

    // PASO 2: Encontrar cliques de grupos similares
    console.log('\n2️⃣ Construyendo grafo de similitud y encontrando cliques...');
    const embeddings = groupsWithEmbeddings.map(item => item.embedding);
    const cliques = findGroupCliques(groupsWithEmbeddings.map(i => i.group), embeddings, threshold);

    if (cliques.length === 0) {
      console.log('ℹ️ No se encontraron cliques para fusionar');
      return { merges: [] };
    }

    // Mapear índices de cliques a índices originales del árbol
    const cliquesWithOriginalIndices = cliques.map(clique =>
      clique.map(idx => groupsWithEmbeddings[idx].originalIndex)
    );

    if (progressCallback) {
      progressCallback(`Evaluando ${cliques.length} cliques con LLM...`);
    }

    // PASO 3: Pasar cliques a LLM para evaluación
    console.log(`\n3️⃣ Evaluando ${cliques.length} cliques con Sonnet...`);

    const serverBase = (window.location.protocol === 'file:' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : '';

    const response = await fetch(`${serverBase}/api/merge-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliques: cliquesWithOriginalIndices,
        groups: groups
      })
    });

    if (!response.ok) {
      let msg = 'HTTP ' + response.status;
      try {
        const e = await response.json();
        msg = e?.error || msg;
      } catch {}
      throw new Error('Servidor: ' + msg);
    }

    const result = await response.json();
    const merges = result.merges || [];

    console.log(`\n✅ Evaluación completada: ${merges.length} fusiones sugeridas`);
    merges.forEach((merge, idx) => {
      console.log(`   ${idx + 1}. "${merge.suggestedName}" (${merge.groupIndices.length} grupos, confianza: ${merge.confidence})`);
      console.log(`      Razón: ${merge.reason}`);
    });

    console.log(`\n📊 Tokens usados: ${result.usage?.inputTokens || 0} in / ${result.usage?.outputTokens || 0} out`);

    return { merges, usage: result.usage };

  } catch (error) {
    console.error('❌ Error en mergeGroupsWithLLM:', error);
    throw error;
  }
};

// Hacer disponible globalmente
window.computeGroupEmbedding = computeGroupEmbedding;
window.buildSimilarityMatrix = buildSimilarityMatrix;
window.findGroupCliques = findGroupCliques;
window.calculateGroupVolume = calculateGroupVolume;
window.mergeGroupsWithLLM = mergeGroupsWithLLM;
