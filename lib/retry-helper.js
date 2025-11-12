// lib/retry-helper.js
// Sistema de reintentos con exponential backoff para llamadas a APIs

/**
 * Ejecuta una función con reintentos automáticos
 *
 * @param {Function} fn - Función asíncrona a ejecutar
 * @param {Object} options - Opciones de configuración
 * @param {number} options.maxRetries - Número máximo de reintentos (default: 3)
 * @param {number} options.initialDelay - Delay inicial en ms (default: 1000)
 * @param {number} options.maxDelay - Delay máximo en ms (default: 30000)
 * @param {number} options.backoffMultiplier - Multiplicador para exponential backoff (default: 2)
 * @param {Function} options.shouldRetry - Función que determina si debe reintentar (default: siempre)
 * @param {Function} options.onRetry - Callback ejecutado antes de cada reintento
 * @returns {Promise} Resultado de la función
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    onRetry = () => {}
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Intentar ejecutar la función
      const result = await fn(attempt);

      // Si llegamos aquí, la función tuvo éxito
      if (attempt > 0) {
        console.log(`✅ Éxito después de ${attempt} reintento(s)`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        console.error(`❌ Fallo después de ${maxRetries} reintentos:`, error.message);
        throw error;
      }

      // Verificar si debemos reintentar este tipo de error
      if (!shouldRetry(error, attempt)) {
        console.error(`❌ Error no recuperable, no se reintenta:`, error.message);
        throw error;
      }

      // Calcular delay con exponential backoff
      const currentDelay = Math.min(delay, maxDelay);

      console.warn(
        `⚠️ Intento ${attempt + 1}/${maxRetries + 1} falló: ${error.message}`
      );
      console.log(`⏳ Reintentando en ${currentDelay}ms...`);

      // Callback antes de reintentar
      onRetry(error, attempt, currentDelay);

      // Esperar antes de reintentar
      await sleep(currentDelay);

      // Incrementar delay para el siguiente intento
      delay *= backoffMultiplier;
    }
  }

  // Este código nunca debería ejecutarse, pero por si acaso
  throw lastError;
}

/**
 * Helper para esperar un tiempo determinado
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determina si un error de OpenAI es recuperable
 */
function isOpenAIRetryable(error) {
  // Errores de red
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // Errores HTTP recuperables
  if (error.status) {
    // 429: Rate limit
    // 500, 502, 503, 504: Errores del servidor
    return [429, 500, 502, 503, 504].includes(error.status);
  }

  // Si tiene un response.status (fetch API)
  if (error.response?.status) {
    return [429, 500, 502, 503, 504].includes(error.response.status);
  }

  // Por defecto, reintentar errores de red
  return error.message?.includes('fetch failed') ||
         error.message?.includes('network') ||
         error.message?.includes('timeout');
}

/**
 * Determina si un error de Anthropic es recuperable
 */
function isAnthropicRetryable(error) {
  // Errores de red
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // El SDK de Anthropic puede lanzar errores con status
  if (error.status) {
    // 429: Rate limit
    // 500, 502, 503, 504: Errores del servidor
    // 529: Overloaded (específico de Anthropic)
    return [429, 500, 502, 503, 504, 529].includes(error.status);
  }

  // Errores de sobrecarga de Anthropic
  if (error.message?.includes('overloaded') || error.message?.includes('529')) {
    return true;
  }

  // Por defecto, reintentar errores de red
  return error.message?.includes('fetch failed') ||
         error.message?.includes('network') ||
         error.message?.includes('timeout');
}

/**
 * Wrapper específico para llamadas a OpenAI
 */
async function retryOpenAI(fn, options = {}) {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    shouldRetry: (error) => isOpenAIRetryable(error),
    onRetry: (error, attempt) => {
      console.log(`🔄 OpenAI retry ${attempt + 1}: ${error.message}`);
    },
    ...options
  });
}

/**
 * Wrapper específico para llamadas a Anthropic
 */
async function retryAnthropic(fn, options = {}) {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    shouldRetry: (error) => isAnthropicRetryable(error),
    onRetry: (error, attempt) => {
      console.log(`🔄 Anthropic retry ${attempt + 1}: ${error.message}`);
    },
    ...options
  });
}

/**
 * Extrae información útil de un error para logging
 */
function extractErrorInfo(error) {
  return {
    message: error.message,
    status: error.status || error.response?.status,
    code: error.code,
    type: error.type || error.constructor.name,
    stack: error.stack?.split('\n').slice(0, 3).join('\n') // Primeras 3 líneas del stack
  };
}

/**
 * Formatea un error para mostrar al usuario
 */
function formatUserError(error, context = 'operación') {
  const info = extractErrorInfo(error);

  // Errores de rate limit
  if (info.status === 429) {
    return `Has excedido el límite de uso de la API. Por favor, espera unos minutos e intenta de nuevo.`;
  }

  // Errores de autenticación
  if (info.status === 401 || info.status === 403) {
    return `Error de autenticación con la API. Verifica tu configuración.`;
  }

  // Errores del servidor
  if (info.status >= 500) {
    return `El servidor de la API está experimentando problemas. Intenta de nuevo en unos minutos.`;
  }

  // Errores de red
  if (info.code === 'ENOTFOUND' || info.code === 'ECONNRESET' || info.code === 'ETIMEDOUT') {
    return `Error de conexión a internet. Verifica tu conexión e intenta de nuevo.`;
  }

  // Error genérico
  return `Error en ${context}: ${info.message}`;
}

module.exports = {
  retryWithBackoff,
  retryOpenAI,
  retryAnthropic,
  isOpenAIRetryable,
  isAnthropicRetryable,
  extractErrorInfo,
  formatUserError,
  sleep
};
