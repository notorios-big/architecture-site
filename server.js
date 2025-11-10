// server.js (completo con endpoint de embeddings)
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

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