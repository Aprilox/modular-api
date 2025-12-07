/**
 * RouteCache - Service de mise en cache des routes API
 * Améliore les performances en évitant les requêtes DB répétées
 */

// Cache en mémoire pour les routes
const routeCache = new Map();
const CACHE_TTL = 60000; // 1 minute

// Métadonnées du cache
let cacheStats = {
  hits: 0,
  misses: 0,
  lastInvalidation: null
};

/**
 * Génère une clé de cache pour une route
 */
function generateCacheKey(path, method) {
  return `${method}:${path}`;
}

/**
 * Récupère une route depuis le cache
 * @returns {object|null} La route si trouvée et valide, null sinon
 */
export function getCachedRoute(path, method) {
  const key = generateCacheKey(path, method);
  const cached = routeCache.get(key);
  
  if (cached && Date.now() < cached.expiresAt) {
    cacheStats.hits++;
    return cached.route;
  }
  
  // Entrée expirée, la supprimer
  if (cached) {
    routeCache.delete(key);
  }
  
  cacheStats.misses++;
  return null;
}

/**
 * Met en cache une route
 */
export function setCachedRoute(path, method, route) {
  const key = generateCacheKey(path, method);
  routeCache.set(key, {
    route,
    expiresAt: Date.now() + CACHE_TTL,
    cachedAt: Date.now()
  });
}

/**
 * Invalide le cache pour une route spécifique
 */
export function invalidateRoute(path, method) {
  const key = generateCacheKey(path, method);
  routeCache.delete(key);
}

/**
 * Invalide tout le cache
 */
export function invalidateAllRoutes() {
  routeCache.clear();
  cacheStats.lastInvalidation = new Date();
}

/**
 * Récupère les statistiques du cache
 */
export function getCacheStats() {
  const totalRequests = cacheStats.hits + cacheStats.misses;
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: totalRequests > 0 ? ((cacheStats.hits / totalRequests) * 100).toFixed(2) + '%' : '0%',
    size: routeCache.size,
    lastInvalidation: cacheStats.lastInvalidation
  };
}

/**
 * Réinitialise les statistiques du cache
 */
export function resetCacheStats() {
  cacheStats = {
    hits: 0,
    misses: 0,
    lastInvalidation: cacheStats.lastInvalidation
  };
}

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of routeCache.entries()) {
    if (value.expiresAt < now) {
      routeCache.delete(key);
    }
  }
}, CACHE_TTL);

export default {
  getCachedRoute,
  setCachedRoute,
  invalidateRoute,
  invalidateAllRoutes,
  getCacheStats,
  resetCacheStats
};

