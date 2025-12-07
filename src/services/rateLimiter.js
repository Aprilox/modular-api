/**
 * RateLimiter - Service de limitation des requêtes
 * Supporte la limitation par IP ou par clé API
 */

// Store en mémoire pour le rate limiting
// Format: { key: { count: number, resetAt: timestamp } }
const store = new Map();

// Nettoyer périodiquement les entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) {
      store.delete(key);
    }
  }
}, 60000); // Toutes les minutes

/**
 * Génère une clé unique pour le rate limiting
 */
function generateKey(identifier, routeId) {
  return `${routeId}:${identifier}`;
}

/**
 * Vérifie si une requête est autorisée selon les limites
 * @param {string} identifier - IP ou clé API
 * @param {object} config - Configuration du rate limiting
 * @returns {object} - { allowed: boolean, remaining: number, resetAt: timestamp, retryAfter?: number }
 */
export function checkRateLimit(identifier, config) {
  const { 
    routeId, 
    requests = 100, 
    window = 60,  // secondes
    enabled = true 
  } = config;
  
  if (!enabled) {
    return { allowed: true, remaining: Infinity, resetAt: null };
  }
  
  const key = generateKey(identifier, routeId);
  const now = Date.now();
  const windowMs = window * 1000;
  
  let entry = store.get(key);
  
  // Si pas d'entrée ou entrée expirée, créer une nouvelle
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs
    };
  }
  
  // Incrémenter le compteur
  entry.count++;
  store.set(key, entry);
  
  const remaining = Math.max(0, requests - entry.count);
  const allowed = entry.count <= requests;
  
  const result = {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    limit: requests,
    window
  };
  
  if (!allowed) {
    result.retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  }
  
  return result;
}

/**
 * Réinitialise le rate limit pour un identifiant
 */
export function resetRateLimit(identifier, routeId) {
  const key = generateKey(identifier, routeId);
  store.delete(key);
}

/**
 * Obtient les statistiques de rate limiting pour un identifiant
 */
export function getRateLimitStats(identifier, routeId) {
  const key = generateKey(identifier, routeId);
  return store.get(key) || null;
}

/**
 * Middleware Fastify pour le rate limiting
 */
export function createRateLimitMiddleware(getRouteConfig) {
  return async (request, reply) => {
    const routeConfig = await getRouteConfig(request);
    
    if (!routeConfig || !routeConfig.rateLimitEnabled) {
      return; // Pas de rate limiting pour cette route
    }
    
    // Déterminer l'identifiant (IP ou clé API)
    let identifier;
    if (routeConfig.rateLimitBy === 'apikey' && request.apiKey) {
      identifier = request.apiKey;
    } else {
      identifier = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    }
    
    const result = checkRateLimit(identifier, {
      routeId: routeConfig.id,
      requests: routeConfig.rateLimitRequests,
      window: routeConfig.rateLimitWindow,
      enabled: routeConfig.rateLimitEnabled
    });
    
    // Ajouter les headers de rate limiting
    reply.header('X-RateLimit-Limit', result.limit);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    
    if (!result.allowed) {
      reply.header('Retry-After', result.retryAfter);
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Limite de ${result.limit} requêtes par ${result.window} secondes dépassée`,
        retryAfter: result.retryAfter
      });
    }
  };
}

export default { 
  checkRateLimit, 
  resetRateLimit, 
  getRateLimitStats, 
  createRateLimitMiddleware 
};

