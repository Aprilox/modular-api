/**
 * Middleware d'authentification
 * Gère l'authentification admin et API
 */

import { extractApiKey, extractBasicAuth, hasPermission, checkAndUpdateQuota } from '../services/apiKeyManager.js';

/**
 * Middleware pour vérifier l'authentification admin (JWT)
 */
export function adminAuth(fastify) {
  return async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ 
        error: 'Unauthorized', 
        message: 'Token invalide ou expiré' 
      });
    }
  };
}

/**
 * Middleware pour vérifier l'authentification API
 * - Route publique (authType = 'none') : pas de vérification
 * - Route sécurisée (authType = 'apikey') : vérifie la clé API selon sa méthode d'auth
 */
export function apiAuth(prisma) {
  return async (request, reply) => {
    const route = request.dynamicRoute;
    
    if (!route) {
      return reply.status(404).send({ error: 'Route not found' });
    }
    
    // Pas d'authentification requise (route publique)
    if (route.authType === 'none') {
      return;
    }
    
    // Route sécurisée - rechercher la clé API
    // On essaie toutes les méthodes possibles pour trouver une clé valide
    let apiKey = null;
    let extractedKey = null;
    
    // 1. Essayer header X-API-Key
    extractedKey = request.headers['x-api-key'];
    if (extractedKey) {
      apiKey = await prisma.apiKey.findUnique({ where: { key: extractedKey } });
      if (apiKey && apiKey.authMethod === 'header') {
        // OK
      } else {
        apiKey = null;
      }
    }
    
    // 2. Essayer Bearer token
    if (!apiKey) {
      const authHeader = request.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
        apiKey = await prisma.apiKey.findUnique({ where: { key: extractedKey } });
        if (apiKey && apiKey.authMethod === 'bearer') {
          // OK
        } else {
          apiKey = null;
        }
      }
    }
    
    // 3. Essayer query parameter
    if (!apiKey) {
      extractedKey = request.query?.api_key || request.query?.apikey;
      if (extractedKey) {
        apiKey = await prisma.apiKey.findUnique({ where: { key: extractedKey } });
        if (apiKey && apiKey.authMethod === 'query') {
          // OK
        } else {
          apiKey = null;
        }
      }
    }
    
    // 4. Essayer les headers personnalisés
    if (!apiKey) {
      const customKeys = await prisma.apiKey.findMany({ 
        where: { authMethod: 'custom', enabled: true } 
      });
      for (const ck of customKeys) {
        if (ck.customHeader) {
          extractedKey = request.headers[ck.customHeader.toLowerCase()];
          if (extractedKey === ck.key) {
            apiKey = ck;
            break;
          }
        }
      }
    }
    
    // Aucune clé trouvée
    if (!apiKey) {
      return reply.status(401).send({ 
        error: 'Unauthorized', 
        message: 'Clé API requise' 
      });
    }
    
    // Vérifier si la clé est active
    if (!apiKey.enabled) {
      return reply.status(401).send({ 
        error: 'Unauthorized', 
        message: 'Clé API désactivée' 
      });
    }
    
    // Vérifier l'expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return reply.status(401).send({ 
        error: 'Unauthorized', 
        message: 'Clé API expirée' 
      });
    }
    
    // Vérifier les permissions
    if (!hasPermission(apiKey, route.id)) {
      return reply.status(403).send({ 
        error: 'Forbidden', 
        message: 'Clé API non autorisée pour cette route' 
      });
    }
    
    // Vérifier le quota
    const quotaResult = await checkAndUpdateQuota(prisma, apiKey.id);
    if (!quotaResult.allowed) {
      reply.header('X-Quota-Limit', quotaResult.limit);
      reply.header('X-Quota-Used', quotaResult.used);
      reply.header('X-Quota-Reset', quotaResult.resetAt?.toISOString());
      return reply.status(429).send({ 
        error: 'Quota Exceeded', 
        message: `Quota de ${quotaResult.limit} requêtes dépassé`,
        resetAt: quotaResult.resetAt
      });
    }
    
    // Stocker les infos de la clé API dans la requête
    request.apiKey = apiKey;
  };
}

export default { adminAuth, apiAuth };

