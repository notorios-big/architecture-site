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
app.use(express.json({ limit: '2mb' }));

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
// Analiza batches de ~100 grupos, saca palabras que no tienen sentido
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

    const anthropic = new Anthropic({ apiKey });
    const nicheContext = loadNicheContext();

    // Preparar datos de grupos
    const groupsData = groups.map((group, idx) => {
      const keywords = group.keywords || [];
      const keywordsList = keywords.map(kw => {
        if (typeof kw === 'string') return kw;
        if (kw.keyword) return kw.keyword;
        return kw.name || '';
      }).filter(k => k);

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
3. Para cada grupo limpio, sugiere el título más representativo basado en la keyword con mayor volumen o la más descriptiva
4. Un grupo debe mantener UNA ÚNICA intención de búsqueda

GRUPOS A LIMPIAR:
${JSON.stringify(groupsData, null, 2)}

Responde SOLO con un objeto JSON válido (sin markdown, sin explicaciones):
{
  "cleanedGroups": [
    {
      "groupIndex": 0,
      "suggestedTitle": "Dupe Good Girl Carolina Herrera",
      "keepKeywords": ["dupe good girl", "clon good girl"],
      "removeKeywords": ["perfume mujer dulce"],
      "reason": "La keyword 'perfume mujer dulce' es muy genérica y no menciona Good Girl"
    }
  ],
  "toClassify": ["perfume mujer dulce", "fragancia hombre", ...]
}

IMPORTANTE:
- Solo incluye grupos que necesiten limpieza
- toClassify debe contener TODAS las keywords removidas de todos los grupos
- Si un grupo está bien, no lo incluyas en cleanedGroups`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    let cleaningSuggestions;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      cleaningSuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parseando respuesta:', parseError);
      return res.status(500).json({
        error: 'Error al parsear respuesta del modelo',
        rawResponse: responseText
      });
    }

    console.log('✅ Limpieza completada para batch', batchIndex + 1);
    console.log('   - Grupos limpiados:', cleaningSuggestions.cleanedGroups?.length || 0);
    console.log('   - Keywords a clasificar:', cleaningSuggestions.toClassify?.length || 0);

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

// ENDPOINT 2: Clasificar keywords desde LLM-POR-CLASIFICAR
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

Responde SOLO con un objeto JSON válido:
{
  "selectedGroupIndex": 2,
  "confidence": 0.85,
  "reason": "La keyword busca dupes de Good Girl, coincide perfectamente con el grupo"
}

Si NINGÚN grupo es apropiado (la keyword necesita un grupo nuevo), responde:
{
  "selectedGroupIndex": -1,
  "confidence": 0.9,
  "reason": "Esta keyword busca un producto diferente (Sauvage), requiere grupo nuevo",
  "suggestedGroupName": "Dupe Sauvage Dior"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
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

Responde SOLO con un objeto JSON válido:
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

Si no hay jerarquías válidas, retorna: {"hierarchies": []}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
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