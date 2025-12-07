/**
 * ApiKeyManager - Service de gestion des clés API
 */

import { nanoid } from 'nanoid';

/**
 * Génère une nouvelle clé API
 * Format: mapi_xxxxxxxxxxxxxxxxxxxx (32 caractères)
 */
export function generateApiKey() {
  return `mapi_${nanoid(32)}`;
}

/**
 * Valide le format d'une clé API
 */
export function isValidKeyFormat(key) {
  return typeof key === 'string' && /^mapi_[A-Za-z0-9_-]{32}$/.test(key);
}

/**
 * Vérifie si une clé API a les permissions pour une route
 */
export function hasPermission(apiKey, routeId) {
  if (!apiKey || !apiKey.enabled) {
    return false;
  }
  
  // Vérifier l'expiration
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return false;
  }
  
  // * = toutes les permissions
  if (apiKey.permissions === '*') {
    return true;
  }
  
  // Vérifier si la route est dans les permissions
  const permittedRoutes = apiKey.permissions.split(',').map(p => p.trim());
  return permittedRoutes.includes(routeId) || permittedRoutes.includes('*');
}

/**
 * Vérifie et met à jour le quota d'une clé API
 */
export async function checkAndUpdateQuota(prisma, apiKeyId) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });
  
  if (!apiKey || !apiKey.quotaEnabled) {
    return { allowed: true };
  }
  
  // Vérifier si le quota doit être réinitialisé
  const now = new Date();
  let shouldReset = false;
  
  if (!apiKey.quotaResetAt) {
    shouldReset = true;
  } else {
    const resetAt = new Date(apiKey.quotaResetAt);
    shouldReset = now >= resetAt;
  }
  
  if (shouldReset) {
    // Calculer la prochaine date de réinitialisation
    let nextReset;
    switch (apiKey.quotaPeriod) {
      case 'day':
        nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'week':
        nextReset = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        nextReset = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
    }
    
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { quotaUsed: 1, quotaResetAt: nextReset }
    });
    
    return { 
      allowed: true, 
      used: 1, 
      limit: apiKey.quotaLimit, 
      resetAt: nextReset 
    };
  }
  
  // Vérifier si le quota est dépassé
  if (apiKey.quotaUsed >= apiKey.quotaLimit) {
    return { 
      allowed: false, 
      used: apiKey.quotaUsed, 
      limit: apiKey.quotaLimit, 
      resetAt: apiKey.quotaResetAt,
      error: 'Quota exceeded'
    };
  }
  
  // Incrémenter le compteur
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { quotaUsed: { increment: 1 } }
  });
  
  return { 
    allowed: true, 
    used: apiKey.quotaUsed + 1, 
    limit: apiKey.quotaLimit, 
    resetAt: apiKey.quotaResetAt 
  };
}

/**
 * Extrait la clé API de la requête selon différentes méthodes
 */
export function extractApiKey(request, customHeader = null) {
  // Custom header
  if (customHeader) {
    const customKey = request.headers[customHeader.toLowerCase()];
    if (customKey) return customKey;
  }
  
  // Header X-API-Key
  const headerKey = request.headers['x-api-key'];
  if (headerKey) return headerKey;
  
  // Query parameter
  const queryKey = request.query?.api_key || request.query?.apikey;
  if (queryKey) return queryKey;
  
  // Bearer token
  const authHeader = request.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (isValidKeyFormat(token)) {
      return token;
    }
  }
  
  return null;
}

/**
 * Extrait la clé API selon la méthode spécifiée
 */
export function extractApiKeyByMethod(request, method, customHeader = null) {
  switch (method) {
    case 'header':
      return request.headers['x-api-key'];
    case 'bearer':
      const authHeader = request.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
      }
      return null;
    case 'query':
      return request.query?.api_key || request.query?.apikey;
    case 'custom':
      if (customHeader) {
        return request.headers[customHeader.toLowerCase()];
      }
      return null;
    default:
      return extractApiKey(request, customHeader);
  }
}

/**
 * Extrait les credentials Basic Auth
 */
export function extractBasicAuth(request) {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Basic ')) {
    return null;
  }
  
  try {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const [username, password] = decoded.split(':');
    return { username, password };
  } catch (e) {
    return null;
  }
}

export default {
  generateApiKey,
  isValidKeyFormat,
  hasPermission,
  checkAndUpdateQuota,
  extractApiKey,
  extractBasicAuth
};

