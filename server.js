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
          model: 'text-embedding-3-small',
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

// Endpoint para refinar grupos con Claude Sonnet 4.5
app.post('/api/refine-groups', async (req, res) => {
  try {
    const { groups, batchIndex = 0, totalBatches = 1 } = req.body;

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de grupos' });
    }

    // Verificar que existe la API key de Anthropic
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY no configurada en el servidor. Agrégala en el archivo .env'
      });
    }

    console.log(`\n🤖 Refinando batch ${batchIndex + 1}/${totalBatches} con ${groups.length} grupos...`);

    // Inicializar cliente de Anthropic
    const anthropic = new Anthropic({ apiKey });

    // Preparar datos de grupos para el prompt
    const groupsData = groups.map((group, idx) => {
      // Extraer solo keywords (ignorar subgrupos anidados)
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

    // Prompt optimizado para análisis de intención de búsqueda
    const prompt = `Eres un experto en SEO y análisis de intención de búsqueda. Tu tarea es refinar grupos de keywords para un sitio web, considerando que cada grupo semántico debe representar una landing page única.

CONTEXTO Y OBJETIVO:
- Cada grupo de keywords debe tener UNA ÚNICA intención de búsqueda
- Cada intención de búsqueda debe tener UNA ÚNICA URL/landing page
- Grupos con la misma intención deben FUSIONARSE
- Keywords con diferentes intenciones dentro de un grupo deben SEPARARSE
- Los nombres de grupos deben reflejar claramente la intención de búsqueda

CRITERIOS DE AGRUPACIÓN:
✅ MISMA INTENCIÓN (deben estar juntos):
- "para que sirve la moringa" + "beneficios de la moringa" → Ambos buscan información sobre beneficios
- "inspiración 212 men" + "dupe de 212 hombre" → Ambos buscan alternativas al mismo perfume
- "receta de brownies" + "como hacer brownies" → Ambos buscan la misma receta

❌ DIFERENTE INTENCIÓN (deben separarse):
- "dupe de 212 hombre" vs "dupe de one million" → Son productos diferentes, necesitan páginas separadas
- "comprar silla" vs "reparar silla" → Una es transaccional, otra informativa
- "historia del café" vs "como preparar café" → Una es informativa, otra es instructiva

GRUPOS A ANALIZAR:
${JSON.stringify(groupsData, null, 2)}

INSTRUCCIONES:
1. Analiza la intención de búsqueda de cada grupo
2. Identifica grupos que deberían fusionarse (misma intención)
3. Identifica keywords que deberían separarse de su grupo (diferente intención)
4. Sugiere nombres de grupos que reflejen mejor la intención

Responde SOLO con un objeto JSON válido (sin markdown, sin explicaciones) con esta estructura:
{
  "merges": [
    {
      "groupIndices": [0, 2, 5],
      "reason": "Todos buscan beneficios del producto X",
      "suggestedName": "Beneficios de X"
    }
  ],
  "splits": [
    {
      "groupIndex": 1,
      "reason": "Mezcla dos productos diferentes",
      "newGroups": [
        {
          "keywords": ["keyword1", "keyword2"],
          "suggestedName": "Nombre grupo 1"
        },
        {
          "keywords": ["keyword3", "keyword4"],
          "suggestedName": "Nombre grupo 2"
        }
      ]
    }
  ],
  "renames": [
    {
      "groupIndex": 3,
      "reason": "El nombre actual no refleja la intención",
      "suggestedName": "Nuevo nombre"
    }
  ],
  "keepAsIs": [4, 6, 7]
}

Si no hay cambios necesarios para alguna categoría, usa un array vacío [].
IMPORTANTE: Los índices deben corresponder a los índices del array de grupos proporcionado.`;

    // Llamar a Claude Sonnet 4.5
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extraer la respuesta
    const responseText = message.content[0].text;
    console.log('📝 Respuesta de Claude:', responseText);

    // Parsear el JSON de la respuesta
    let refinementSuggestions;
    try {
      // Intentar extraer JSON si viene envuelto en markdown
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        refinementSuggestions = JSON.parse(jsonMatch[0]);
      } else {
        refinementSuggestions = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Error parseando respuesta de Claude:', parseError);
      return res.status(500).json({
        error: 'Error al parsear la respuesta del modelo',
        rawResponse: responseText
      });
    }

    console.log('✅ Refinamiento completado para batch', batchIndex + 1);
    console.log('   - Fusiones:', refinementSuggestions.merges?.length || 0);
    console.log('   - Divisiones:', refinementSuggestions.splits?.length || 0);
    console.log('   - Renombres:', refinementSuggestions.renames?.length || 0);

    res.json({
      success: true,
      batchIndex,
      suggestions: refinementSuggestions,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Error en /api/refine-groups:', error);
    res.status(500).json({
      error: 'Error interno del servidor: ' + error.message
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