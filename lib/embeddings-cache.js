// lib/embeddings-cache.js
// Sistema de caché persistente para embeddings

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_FILE = path.join(__dirname, '../data/embeddings.json');

/**
 * Estructura del caché:
 * {
 *   "version": "1.0",
 *   "model": "text-embedding-3-large",
 *   "dimension": 3072,
 *   "embeddings": {
 *     "keyword-hash-123": {
 *       "id": "emb-uuid-123",
 *       "keyword": "dupe good girl",
 *       "embedding": [...3072 floats],
 *       "volume": 1200,
 *       "createdAt": "2024-01-15T10:30:00Z",
 *       "updatedAt": "2024-01-15T10:30:00Z"
 *     }
 *   },
 *   "stats": {
 *     "totalEmbeddings": 150,
 *     "lastUpdated": "2024-01-15T10:30:00Z"
 *   }
 * }
 */

class EmbeddingsCache {
  constructor() {
    this.cache = this.loadCache();
  }

  /**
   * Genera un hash único para una keyword
   */
  hashKeyword(keyword) {
    const normalized = keyword.toLowerCase().trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Genera un ID único para un embedding
   */
  generateId() {
    return `emb-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Carga el caché desde el archivo JSON
   */
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(data);
        console.log(`📦 Caché cargado: ${parsed.stats?.totalEmbeddings || 0} embeddings`);
        return parsed;
      }
    } catch (error) {
      console.warn('⚠️ Error al cargar caché, creando uno nuevo:', error.message);
    }

    // Retornar estructura vacía si no existe o hay error
    return {
      version: '1.0',
      model: 'text-embedding-3-large',
      dimension: 3072,
      embeddings: {},
      stats: {
        totalEmbeddings: 0,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Guarda el caché al archivo JSON
   */
  saveCache() {
    try {
      // Asegurar que el directorio existe
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Actualizar stats
      this.cache.stats.totalEmbeddings = Object.keys(this.cache.embeddings).length;
      this.cache.stats.lastUpdated = new Date().toISOString();

      // Escribir archivo
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
      console.log(`💾 Caché guardado: ${this.cache.stats.totalEmbeddings} embeddings`);
      return true;
    } catch (error) {
      console.error('❌ Error al guardar caché:', error.message);
      return false;
    }
  }

  /**
   * Busca un embedding por keyword
   * @returns {Object|null} El embedding o null si no existe
   */
  get(keyword) {
    const hash = this.hashKeyword(keyword);
    return this.cache.embeddings[hash] || null;
  }

  /**
   * Busca múltiples embeddings
   * @returns {Object} { found: [embeddings], missing: [keywords] }
   */
  getBatch(keywords) {
    const found = [];
    const missing = [];

    for (const keyword of keywords) {
      const cached = this.get(keyword);
      if (cached) {
        found.push({ keyword, ...cached });
      } else {
        missing.push(keyword);
      }
    }

    console.log(`🔍 Caché: ${found.length} encontrados, ${missing.length} faltantes`);
    return { found, missing };
  }

  /**
   * Guarda un embedding en el caché
   */
  set(keyword, embedding, volume = 0) {
    const hash = this.hashKeyword(keyword);
    const now = new Date().toISOString();

    const existing = this.cache.embeddings[hash];

    this.cache.embeddings[hash] = {
      id: existing?.id || this.generateId(),
      keyword: keyword.trim(),
      embedding,
      volume,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    return this.cache.embeddings[hash];
  }

  /**
   * Guarda múltiples embeddings
   * @param {Array} items - Array de { keyword, embedding, volume }
   */
  setBatch(items) {
    let saved = 0;

    for (const item of items) {
      this.set(item.keyword, item.embedding, item.volume || 0);
      saved++;
    }

    this.saveCache();
    console.log(`✅ Guardados ${saved} nuevos embeddings en caché`);
    return saved;
  }

  /**
   * Actualiza el volumen de una keyword
   */
  updateVolume(keyword, volume) {
    const hash = this.hashKeyword(keyword);
    if (this.cache.embeddings[hash]) {
      this.cache.embeddings[hash].volume = volume;
      this.cache.embeddings[hash].updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Actualiza volúmenes de múltiples keywords
   */
  updateVolumes(keywordVolumeMap) {
    let updated = 0;

    for (const [keyword, volume] of Object.entries(keywordVolumeMap)) {
      if (this.updateVolume(keyword, volume)) {
        updated++;
      }
    }

    if (updated > 0) {
      this.saveCache();
      console.log(`📊 Actualizados volúmenes de ${updated} keywords`);
    }

    return updated;
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats() {
    return {
      ...this.cache.stats,
      model: this.cache.model,
      dimension: this.cache.dimension,
      version: this.cache.version
    };
  }

  /**
   * Limpia embeddings antiguos (opcional, para mantenimiento)
   * @param {number} daysOld - Días de antigüedad para considerar obsoleto
   */
  cleanup(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let removed = 0;
    const embeddings = this.cache.embeddings;

    for (const hash in embeddings) {
      const updatedAt = new Date(embeddings[hash].updatedAt);
      if (updatedAt < cutoffDate) {
        delete embeddings[hash];
        removed++;
      }
    }

    if (removed > 0) {
      this.saveCache();
      console.log(`🧹 Limpiados ${removed} embeddings antiguos`);
    }

    return removed;
  }

  /**
   * Exporta todos los embeddings
   */
  exportAll() {
    return Object.values(this.cache.embeddings);
  }

  /**
   * Importa embeddings (útil para migraciones)
   */
  importBatch(embeddings) {
    let imported = 0;

    for (const emb of embeddings) {
      if (emb.keyword && emb.embedding) {
        this.set(emb.keyword, emb.embedding, emb.volume || 0);
        imported++;
      }
    }

    this.saveCache();
    console.log(`📥 Importados ${imported} embeddings`);
    return imported;
  }
}

// Singleton instance
let cacheInstance = null;

function getCache() {
  if (!cacheInstance) {
    cacheInstance = new EmbeddingsCache();
  }
  return cacheInstance;
}

module.exports = {
  EmbeddingsCache,
  getCache
};
