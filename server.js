// server.js (completo con endpoint de embeddings)
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

// Middlewares básicos
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // Aumentado para batches grandes

// Endpoint para embeddings (usando API de OpenAI con batching)
app.post('/api/embeddings', async (req, res) => {
  try {
    const { texts } = req.body;
    
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de textos' });
    }

    // Verificar que existe la API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OPENAI_API_KEY no configurada en el servidor' 
      });
    }

    // Procesar en lotes de 100 (límite seguro de OpenAI)
    const BATCH_SIZE = 100;
    const allEmbeddings = [];
    
    console.log(`Procesando ${texts.length} keywords en lotes de ${BATCH_SIZE}...`);
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      console.log(`Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}: procesando ${batch.length} items`);
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-large',
          input: batch
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error de OpenAI:', error);
        return res.status(response.status).json({ 
          error: error.error?.message || 'Error al obtener embeddings' 
        });
      }

      const data = await response.json();
      const batchEmbeddings = data.data.map(item => item.embedding);
      allEmbeddings.push(...batchEmbeddings);
      
      // Pequeña pausa entre lotes para no saturar la API
      if (i + BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Completado: ${allEmbeddings.length} embeddings generados`);
    res.json({ embeddings: allEmbeddings });
  } catch (error) {
    console.error('Error en /api/embeddings:', error);
    res.status(500).json({
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// Función auxiliar para cargar el contexto del nicho
const fs = require('fs');
const loadNicheContext = () => {
  try {
    const contextPath = path.join(__dirname, 'niche-context.json');
    if (fs.existsSync(contextPath)) {
      return JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️ No se pudo cargar niche-context.json:', error.message);
  }
  return null;
};

// ENDPOINT 1: Limpieza de grupos
// Analiza batches de ~50 grupos, saca palabras que no tienen sentido
// y las mueve a un grupo especial "LLM-POR-CLASIFICAR"
app.post('/api/clean-groups', async (req, res) => {
  try {
    const { groups, batchIndex = 0, totalBatches = 1 } = req.body;

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de grupos' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY no configurada en el servidor'
      });
    }

    console.log(`\n🧹 Limpiando batch ${batchIndex + 1}/${totalBatches} con ${groups.length} grupos...`);
    console.log(`   Modelo: claude-haiku-4-5 | Max tokens: 16384 | Temperatura: 0.2`);

    const anthropic = new Anthropic({ apiKey });
    const nicheContext = loadNicheContext();

    if (nicheContext) {
      console.log(`   ✓ Contexto del nicho cargado: ${nicheContext.nicho || 'desconocido'}`);
    } else {
      console.log(`   ⚠️ No se encontró niche-context.json, usando contexto genérico`);
    }

    // Preparar datos de grupos CON volúmenes de keywords
    const groupsData = groups.map((group, idx) => {
      const keywords = group.keywords || [];
      const keywordsList = keywords.map(kw => {
        // Manejar diferentes formatos de keyword
        if (typeof kw === 'string') {
          return { keyword: kw, volume: 0 };
        }
        return {
          keyword: kw.keyword || kw.name || '',
          volume: kw.volume || 0
        };
      }).filter(k => k.keyword);

      return {
        index: idx,
        name: group.name,
        keywords: keywordsList,
        volume: group.volume || 0
      };
    });

    const contextSection = nicheContext ? `
CONTEXTO DEL NICHO:
${JSON.stringify(nicheContext, null, 2)}

Usa este contexto para entender:
- Equivalencias de términos (ej: dupes = clones = réplicas)
- Categorías principales del nicho
- Reglas específicas de agrupación
- Ejemplos de buenos y malos grupos
` : '';

    const prompt = `Eres un experto en SEO y análisis de keywords. Tu tarea es LIMPIAR grupos de keywords, identificando palabras que NO pertenecen a cada grupo y asignando títulos representativos.

${contextSection}

OBJETIVO:
1. Para cada grupo, identifica keywords que NO tienen sentido semántico con el resto
2. Esas keywords "huérfanas" deben moverse al grupo "LLM-POR-CLASIFICAR"
3. RECUERDA: Un grupo representa UNA URL específica. Por ejemplo:
   - "perfumes amaderados hombre" → URL diferente a "perfumes frescos hombre"
   - "dupe good girl" → URL diferente a "dupe 212 vip"
   - Solo agrupa keywords que podrían responderse en la MISMA landing page
4. Un grupo debe mantener UNA ÚNICA intención de búsqueda y responder a UNA URL

GRUPOS A LIMPIAR:
${JSON.stringify(groupsData, null, 2)}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido. NO incluyas texto adicional, NO uses markdown (sin \`\`\`json), NO agregues explicaciones.

FORMATO DE RESPUESTA:
{
  "cleanedGroups": [
    {
      "groupIndex": 0,
      "keepKeywords": ["dupe good girl", "clon good girl"],
      "removeKeywords": [
        {"keyword": "perfume mujer dulce", "volume": 1200},
        {"keyword": "fragancia hombre", "volume": 800}
      ],
      "reason": "Las keywords removidas buscan intenciones diferentes y necesitan URLs separadas"
    }
  ],
  "toClassify": [
    {"keyword": "perfume mujer dulce", "volume": 1200},
    {"keyword": "fragancia hombre", "volume": 800}
  ]
}

REGLAS:
- Solo incluye grupos que necesiten limpieza
- toClassify debe contener TODAS las keywords removidas de todos los grupos CON SU VOLUMEN
- removeKeywords debe incluir el objeto completo de cada keyword con su volumen
- Si un grupo está bien, no lo incluyas en cleanedGroups
- NO sugieras títulos, trabajaremos con las keywords de mayor volumen

Responde AHORA con el JSON (sin texto adicional):`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16384,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    let cleaningSuggestions;

    // Estrategia multi-nivel para parsear JSON robusto
    let parseStrategy = '';
    try {
      // Intento 1: Parsear directo (más común cuando funciona bien)
      cleaningSuggestions = JSON.parse(responseText);
      parseStrategy = 'directo';
    } catch (e1) {
      try {
        // Intento 2: Extraer JSON con regex (por si hay texto antes/después)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta');
        cleaningSuggestions = JSON.parse(jsonMatch[0]);
        parseStrategy = 'regex';
      } catch (e2) {
        try {
          // Intento 3: Reparar JSON truncado (común con respuestas largas)
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta');

          let jsonStr = jsonMatch[0];
          // Remover comas finales sueltas
          jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
          // Si termina con coma, completar el array
          if (jsonStr.match(/,\s*$/)) {
            jsonStr = jsonStr.trim().replace(/,\s*$/, '') + ']}';
          }
          cleaningSuggestions = JSON.parse(jsonStr);
          parseStrategy = 'reparación';
        } catch (e3) {
          // Intento 4: Fallar con información útil
          console.error('❌ Error parseando respuesta después de 3 intentos:');
          console.error('  - Intento 1 (directo):', e1.message);
          console.error('  - Intento 2 (regex):', e2.message);
          console.error('  - Intento 3 (reparación):', e3.message);
          console.error('📄 Últimos 300 caracteres de respuesta:', responseText.slice(-300));
          console.error('📏 Longitud total de respuesta:', responseText.length);

          return res.status(500).json({
            error: 'Error al parsear respuesta del modelo',
            details: 'JSON malformado o incompleto después de múltiples intentos',
            responseLength: responseText.length,
            responseTail: responseText.slice(-300),
            attempts: [e1.message, e2.message, e3.message]
          });
        }
      }
    }

    console.log(`✅ Limpieza completada para batch ${batchIndex + 1} (parsing: ${parseStrategy})`);
    console.log('   - Grupos limpiados:', cleaningSuggestions.cleanedGroups?.length || 0);
    console.log('   - Keywords a clasificar:', cleaningSuggestions.toClassify?.length || 0);
    console.log('   - Respuesta:', `${responseText.length} caracteres`);

    res.json({
      success: true,
      batchIndex,
      suggestions: cleaningSuggestions,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error en /api/clean-groups:', error);
    res.status(500).json({
      error: 'Error interno del servidor: ' + error.message
    });
  }
});

// ENDPOINT 2: Clasificar keywords en BATCH desde LLM-POR-CLASIFICAR
// Procesa múltiples keywords a la vez para mayor velocidad
app.post('/api/classify-keywords-batch', async (req, res) => {
  try {
    const { keywordsBatch } = req.body;

    if (!Array.isArray(keywordsBatch) || keywordsBatch.length === 0) {
      return res.status(400).json({
        error: 'Se requiere un array de keywords con sus candidatos'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY no configurada'
      });
    }

    console.log(`\n🎯 Clasificando batch de ${keywordsBatch.length} keywords...`);

    const anthropic = new Anthropic({ apiKey });
    const nicheContext = loadNicheContext();

    const contextSection = nicheContext ? `
CONTEXTO DEL NICHO:
${JSON.stringify(nicheContext, null, 2)}
` : '';

    // Preparar el batch para el LLM
    const batchData = keywordsBatch.map((item, idx) => ({
      batchIndex: idx,
      keyword: item.keyword,
      candidates: item.candidateGroups
    }));

    // Debug: calcular tamaño del batch data
    const batchDataStr = JSON.stringify(batchData, null, 2);
    const batchDataTokens = Math.ceil(batchDataStr.length / 4); // Estimación aproximada
    const contextTokens = contextSection ? Math.ceil(contextSection.length / 4) : 0;

    console.log(`   📊 Debug de tokens:`);
    console.log(`      - Keywords en batch: ${keywordsBatch.length}`);
    console.log(`      - Candidatos totales: ${keywordsBatch.reduce((sum, kw) => sum + kw.candidateGroups.length, 0)}`);
    console.log(`      - Caracteres batchData: ${batchDataStr.length.toLocaleString()}`);
    console.log(`      - Tokens estimados batchData: ${batchDataTokens.toLocaleString()}`);
    console.log(`      - Tokens estimados contexto: ${contextTokens.toLocaleString()}`);
    console.log(`      - Tokens totales estimados: ${(batchDataTokens + contextTokens).toLocaleString()}`);

    const prompt = `Eres un experto en SEO. Debes clasificar MÚLTIPLES keywords en sus grupos más apropiados.

${contextSection}

KEYWORDS A CLASIFICAR (BATCH):
${batchDataStr}

Para cada keyword, analiza la intención de búsqueda y determina cuál grupo candidato es más apropiado.

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido. NO incluyas texto adicional, NO uses markdown, NO agregues explicaciones.

FORMATO DE RESPUESTA:
{
  "classifications": [
    {
      "batchIndex": 0,
      "selectedGroupIndex": 2,
      "confidence": 0.85,
      "reason": "La keyword busca dupes de Good Girl, coincide perfectamente con el grupo"
    },
    {
      "batchIndex": 1,
      "selectedGroupIndex": -1,
      "confidence": 0.9,
      "reason": "Esta keyword busca un producto diferente, requiere grupo nuevo",
      "suggestedGroupName": "Dupe Sauvage Dior"
    }
  ]
}

REGLAS:
- Devuelve una clasificación por cada keyword en el batch
- selectedGroupIndex: índice del grupo candidato elegido, o -1 si ninguno es apropiado
- Si selectedGroupIndex es -1, incluye suggestedGroupName para crear nuevo grupo
- Mantén el batchIndex para mapear cada respuesta a su keyword original

Responde AHORA con el JSON (sin texto adicional):`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    let batchClassification;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      batchClassification = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        error: 'Error al parsear respuesta',
        rawResponse: responseText
      });
    }

    console.log(`✅ Batch clasificado: ${batchClassification.classifications?.length || 0} keywords procesadas`);

    res.json({
      success: true,
      classifications: batchClassification.classifications,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error en /api/classify-keywords-batch:', error);
    res.status(500).json({
      error: 'Error interno: ' + error.message
    });
  }
});

// ENDPOINT 2 (LEGACY): Clasificar keywords desde LLM-POR-CLASIFICAR
// Usa embeddings para pre-filtrar y luego LLM para decisión final
app.post('/api/classify-keywords', async (req, res) => {
  try {
    const { keyword, candidateGroups } = req.body;

    if (!keyword || !Array.isArray(candidateGroups)) {
      return res.status(400).json({
        error: 'Se requiere keyword y candidateGroups'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY no configurada'
      });
    }

    console.log(`\n🎯 Clasificando keyword: "${keyword}" entre ${candidateGroups.length} candidatos...`);

    const anthropic = new Anthropic({ apiKey });
    const nicheContext = loadNicheContext();

    const contextSection = nicheContext ? `
CONTEXTO DEL NICHO:
${JSON.stringify(nicheContext, null, 2)}
` : '';

    const prompt = `Eres un experto en SEO. Debes clasificar una keyword en el grupo más apropiado semánticamente.

${contextSection}

KEYWORD A CLASIFICAR:
"${keyword}"

GRUPOS CANDIDATOS (pre-filtrados por similitud de embeddings):
${JSON.stringify(candidateGroups, null, 2)}

Analiza la intención de búsqueda de la keyword y determina cuál grupo es más apropiado.

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido. NO incluyas texto adicional, NO uses markdown, NO agregues explicaciones.

FORMATO DE RESPUESTA:

Si encuentras un grupo apropiado:
{
  "selectedGroupIndex": 2,
  "confidence": 0.85,
  "reason": "La keyword busca dupes de Good Girl, coincide perfectamente con el grupo"
}

Si NINGÚN grupo es apropiado:
{
  "selectedGroupIndex": -1,
  "confidence": 0.9,
  "reason": "Esta keyword busca un producto diferente (Sauvage), requiere grupo nuevo",
  "suggestedGroupName": "Dupe Sauvage Dior"
}

Responde AHORA con el JSON (sin texto adicional):`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    let classification;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      classification = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        error: 'Error al parsear respuesta',
        rawResponse: responseText
      });
    }

    console.log('✅ Clasificación completada:', classification.selectedGroupIndex !== -1
      ? `Grupo ${classification.selectedGroupIndex}`
      : 'Crear nuevo grupo');

    res.json({
      success: true,
      classification,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error en /api/classify-keywords:', error);
    res.status(500).json({
      error: 'Error interno: ' + error.message
    });
  }
});

// ENDPOINT 3: Generar conexiones padre-hijo
// Crea jerarquías lógicas entre grupos
app.post('/api/generate-hierarchies', async (req, res) => {
  try {
    const { groups } = req.body;

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de grupos' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY no configurada'
      });
    }

    console.log(`\n🌳 Generando jerarquías para ${groups.length} grupos...`);

    const anthropic = new Anthropic({ apiKey });
    const nicheContext = loadNicheContext();

    const groupsData = groups.map((group, idx) => ({
      index: idx,
      name: group.name,
      keywordsCount: group.keywords?.length || 0,
      sampleKeywords: (group.keywords || []).slice(0, 5),
      volume: group.volume || 0
    }));

    const contextSection = nicheContext ? `
CONTEXTO DEL NICHO:
${JSON.stringify(nicheContext, null, 2)}

ESPECIALMENTE REVISA LA SECCIÓN: jerarquias_logicas
` : '';

    const prompt = `Eres un experto en arquitectura de información y SEO. Debes crear conexiones padre-hijo entre grupos de keywords.

${contextSection}

REGLAS PARA JERARQUÍAS:
1. Un grupo PADRE debe ser una categoría/listado general
2. Los grupos HIJOS deben ser productos/subcategorías específicas que pertenecen al padre
3. Ejemplos VÁLIDOS:
   - Padre: "Dupes Carolina Herrera" → Hijos: ["Dupe Good Girl", "Dupe 212 VIP"]
   - Padre: "Perfumes Dulces Mujer" → Hijos: ["Dupe Good Girl", "Dupe La Vie Est Belle"]
4. NO crear jerarquías si los grupos son del mismo nivel de especificidad
5. Solo crear jerarquías cuando tenga sentido semántico Y de arquitectura web

GRUPOS DISPONIBLES:
${JSON.stringify(groupsData, null, 2)}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido. NO incluyas texto adicional, NO uses markdown, NO agregues explicaciones.

FORMATO DE RESPUESTA:

Si hay jerarquías válidas:
{
  "hierarchies": [
    {
      "parentIndex": 0,
      "childrenIndices": [3, 5, 8],
      "reason": "El grupo 0 es categoría general, los hijos son productos específicos de esa categoría",
      "confidence": 0.9
    }
  ]
}

Si NO hay jerarquías válidas:
{
  "hierarchies": []
}

Responde AHORA con el JSON (sin texto adicional):`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    let hierarchySuggestions;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      hierarchySuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        error: 'Error al parsear respuesta',
        rawResponse: responseText
      });
    }

    console.log('✅ Jerarquías generadas:', hierarchySuggestions.hierarchies?.length || 0);

    res.json({
      success: true,
      suggestions: hierarchySuggestions,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error en /api/generate-hierarchies:', error);
    res.status(500).json({
      error: 'Error interno: ' + error.message
    });
  }
});

// ENDPOINT 4: Fusionar grupos similares (Paso 2.5)
// Detecta cliques de grupos similares y decide cuáles fusionar
app.post('/api/merge-groups', async (req, res) => {
  try {
    const { cliques, groups } = req.body;

    if (!Array.isArray(cliques) || !Array.isArray(groups)) {
      return res.status(400).json({
        error: 'Se requieren arrays de cliques y groups'
      });
    }

    if (cliques.length === 0) {
      return res.json({
        success: true,
        merges: [],
        usage: { inputTokens: 0, outputTokens: 0 }
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY no configurada'
      });
    }

    console.log(`\n🔄 Evaluando ${cliques.length} cliques para posible fusión...`);

    const anthropic = new Anthropic({ apiKey });
    const nicheContext = loadNicheContext();

    const contextSection = nicheContext ? `
CONTEXTO DEL NICHO:
${JSON.stringify(nicheContext, null, 2)}
` : '';

    // Preparar datos de cliques para el LLM
    const cliquesData = cliques.map((cliqueIndices, cliqueIdx) => {
      const cliqueGroups = cliqueIndices.map(groupIdx => {
        const group = groups[groupIdx];
        return {
          originalIndex: groupIdx,
          name: group.name,
          volume: group.volume || 0,
          keywordsCount: group.children?.length || 0,
          topKeywords: (group.children || [])
            .slice(0, 5)
            .map(kw => ({
              keyword: kw.keyword || kw.name,
              volume: kw.volume || 0
            }))
        };
      });

      return {
        cliqueIndex: cliqueIdx,
        groups: cliqueGroups
      };
    });

    const prompt = `Eres un experto en SEO y arquitectura de contenido. Tu tarea es evaluar cliques de grupos similares y decidir si deberían fusionarse en un único grupo.

${contextSection}

CONTEXTO:
- Un "clique" es un conjunto de grupos donde TODOS tienen alta similitud semántica entre sí (>= 0.6)
- Debes decidir si fusionar cada clique en un solo grupo o mantenerlos separados
- IMPORTANTE: Solo fusiona si representan la MISMA intención de búsqueda y URL

CRITERIOS PARA FUSIONAR:
✅ SÍ fusionar si:
- Buscan exactamente el mismo producto/servicio
- Podrían responderse con la MISMA landing page
- Son sinónimos o variaciones del mismo término
- Ejemplos: ["Dupe Good Girl", "Clon Good Girl Carolina Herrera", "Réplica Good Girl"]

❌ NO fusionar si:
- Buscan productos diferentes (aunque sean del mismo tipo)
- Requieren URLs distintas
- Son categorías vs productos específicos
- Ejemplos NO fusionar: ["Dupe Good Girl", "Dupe 212 VIP"] → diferentes productos

CLIQUES A EVALUAR:
${JSON.stringify(cliquesData, null, 2)}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido. NO incluyas texto adicional, NO uses markdown, NO agregues explicaciones.

FORMATO DE RESPUESTA:
{
  "decisions": [
    {
      "cliqueIndex": 0,
      "shouldMerge": true,
      "finalName": "Dupe Good Girl Carolina Herrera",
      "reason": "Los 3 grupos buscan dupes del mismo perfume",
      "confidence": 0.95
    },
    {
      "cliqueIndex": 1,
      "shouldMerge": false,
      "reason": "Cada grupo busca un producto diferente, requieren URLs separadas",
      "confidence": 0.9
    }
  ]
}

REGLAS:
- Devuelve una decisión por cada clique
- Si shouldMerge es true, incluye finalName (nombre del grupo fusionado)
- El finalName debe ser el más representativo o combinar los nombres existentes
- Confidence debe estar entre 0 y 1

Responde AHORA con el JSON (sin texto adicional):`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    let decisions;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      decisions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Error parseando respuesta:', parseError);
      console.error('📄 Respuesta:', responseText);
      return res.status(500).json({
        error: 'Error al parsear respuesta del modelo',
        rawResponse: responseText
      });
    }

    // Convertir decisiones a formato de merges
    const merges = decisions.decisions
      .filter(d => d.shouldMerge)
      .map(d => {
        const cliqueIndices = cliques[d.cliqueIndex];
        return {
          groupIndices: cliqueIndices,
          suggestedName: d.finalName,
          reason: d.reason,
          confidence: d.confidence
        };
      });

    console.log(`✅ Evaluación completada: ${merges.length}/${cliques.length} cliques para fusionar`);
    merges.forEach((merge, idx) => {
      console.log(`   ${idx + 1}. "${merge.suggestedName}" (${merge.groupIndices.length} grupos)`);
    });

    res.json({
      success: true,
      merges,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error en /api/merge-groups:', error);
    res.status(500).json({
      error: 'Error interno: ' + error.message
    });
  }
});

// Servir archivos estáticos desde ./public
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, p) => {
    if (p.endsWith('.jsx')) res.setHeader('Content-Type', 'application/javascript');
    if (p.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Salud
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    publicDir: PUBLIC_DIR,
    indexHtmlExists: true,
  });
});

// Entregar el SPA (raíz y cualquier ruta del front)
app.get(['/', '/*'], (_req, res) => {
  res.sendFile(INDEX_HTML);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('────────────────────────────────────────────');
  console.log(`Servidor listo: http://localhost:${PORT}`);
  console.log('Sirviendo estáticos desde:', PUBLIC_DIR);
  console.log('Index HTML:', INDEX_HTML);
  console.log('API Key configurada:', !!process.env.OPENAI_API_KEY);
  console.log('────────────────────────────────────────────');
});