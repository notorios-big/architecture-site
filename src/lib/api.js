// src/lib/api.js
// Cliente API mejorado con Axios y manejo de errores robusto

import axios from 'axios';

const getServerBase = () => {
  if (typeof window === 'undefined') return '';
  return (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : '';
};

// Configurar instancia de Axios
const apiClient = axios.create({
  baseURL: getServerBase(),
  timeout: 120000, // 2 minutos
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor para agregar logs
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // El servidor respondió con un código de error
      const customError = new Error(error.response.data?.error || error.message);
      customError.status = error.response.status;
      customError.details = error.response.data?.details || '';
      throw customError;
    } else if (error.request) {
      // La petición fue enviada pero no hubo respuesta
      const customError = new Error('Error de conexión. Verifica tu internet e intenta de nuevo.');
      customError.isNetworkError = true;
      throw customError;
    } else {
      // Algo pasó al configurar la petición
      throw error;
    }
  }
);

/**
 * Retry logic con backoff exponencial
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones de retry
 */
export const retryWithBackoff = async (fn, options = {}) => {
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
 * Obtener embeddings con caché y retry logic
 * @param {Array<string>} texts - Keywords para generar embeddings
 * @param {Array<number>} volumes - Volúmenes opcionales de cada keyword
 */
export const getEmbeddingsBatch = async (texts, volumes = []) => {
  return await retryWithBackoff(async (attempt) => {
    if (attempt > 0) {
      console.log(`🔄 Reintentando obtener embeddings (intento ${attempt + 1})...`);
    }

    const response = await apiClient.post('/api/embeddings', { texts, volumes });
    const data = response.data;
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
export const formatErrorForUser = (error) => {
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
  if (error.message.includes('conexión') || error.message.includes('internet') || error.isNetworkError) {
    return error.message;
  }

  // Error genérico
  return error.message || 'Ha ocurrido un error inesperado. Intenta de nuevo.';
};

// Exportar cliente de axios configurado
export default apiClient;
