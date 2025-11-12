// src/lib/api.js
// Cliente API mejorado con manejo de errores robusto

const getServerBase = () => {
  if (typeof window === 'undefined') return '';
  return (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '';
};

/**
 * Retry logic para el cliente
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones de retry
 */
const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 2,
    initialDelay = 1000,
    backoffMultiplier = 2
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        throw error;
      }

      // No reintentar errores 4xx (excepto 429)
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      console.warn(`⚠️ Intento ${attempt + 1}/${maxRetries + 1} falló: ${error.message}`);
      console.log(`⏳ Reintentando en ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
};

/**
 * Función auxiliar para hacer fetch con manejo de errores mejorado
 */
const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const resp = await fetch(url, options);

    if (!resp.ok) {
      let errorMessage = `Error ${resp.status}`;
      let details = '';

      try {
        const errorData = await resp.json();
        errorMessage = errorData?.error || errorMessage;
        details = errorData?.details || '';
      } catch {
        // Si no se puede parsear JSON, usar texto plano
        try {
          errorMessage = await resp.text();
        } catch {}
      }

      const error = new Error(errorMessage);
      error.status = resp.status;
      error.details = details;
      throw error;
    }

    return resp;
  } catch (error) {
    // Errores de red (sin conexión, timeout, etc.)
    if (!error.status) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        error.message = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
      } else if (error.message.includes('timeout')) {
        error.message = 'La solicitud tardó demasiado. Intenta de nuevo.';
      }
    }
    throw error;
  }
};

/**
 * Obtener embeddings con caché y retry logic
 * @param {Array<string>} texts - Keywords para generar embeddings
 * @param {Array<number>} volumes - Volúmenes opcionales de cada keyword
 */
const getEmbeddingsBatch = async (texts, volumes = []) => {
  const serverBase = getServerBase();

  return await retryWithBackoff(async (attempt) => {
    if (attempt > 0) {
      console.log(`🔄 Reintentando obtener embeddings (intento ${attempt + 1})...`);
    }

    const resp = await fetchWithErrorHandling(`${serverBase}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, volumes })
    });

    const data = await resp.json();
    const arr = data?.embeddings;

    if (!Array.isArray(arr) || !Array.isArray(arr[0])) {
      throw new Error('Respuesta sin embeddings válidos del servidor');
    }

    // Mostrar stats si están disponibles
    if (data.stats) {
      console.log(`📊 Embeddings: ${data.stats.cached} en caché, ${data.stats.generated} generados`);
    }

    return arr;
  }, {
    maxRetries: 2,
    initialDelay: 2000,
    backoffMultiplier: 2
  });
};

/**
 * Formatea un error para mostrar al usuario de forma amigable
 */
const formatErrorForUser = (error) => {
  // Si el error ya tiene un mensaje formateado del servidor
  if (error.message && !error.message.includes('Error') && error.message.length > 10) {
    return error.message;
  }

  // Errores específicos por código de estado
  if (error.status === 429) {
    return 'Has excedido el límite de uso. Espera unos minutos e intenta de nuevo.';
  }

  if (error.status === 401 || error.status === 403) {
    return 'Error de autenticación. Verifica la configuración del servidor.';
  }

  if (error.status >= 500) {
    return 'El servidor está experimentando problemas. Intenta de nuevo en unos minutos.';
  }

  // Errores de red
  if (error.message.includes('conexión') || error.message.includes('internet')) {
    return error.message;
  }

  // Error genérico
  return error.message || 'Ha ocurrido un error inesperado. Intenta de nuevo.';
};

// Hacer disponible globalmente
window.getEmbeddingsBatch = getEmbeddingsBatch;
window.fetchWithErrorHandling = fetchWithErrorHandling;
window.formatErrorForUser = formatErrorForUser;

