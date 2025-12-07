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
 * Middleware pour vérifier l'authentification API selon le type de route
 */
export function apiAuth(prisma) {
  return async (request, reply) => {
    const route = request.dynamicRoute;
    
    if (!route) {
      return reply.status(404).send({ error: 'Route not found' });
    }
    
    // Pas d'authentification requise
    if (route.authType === 'none') {
      return;
    }
    
    // Authentification par clé API
    if (route.authType === 'apikey') {
      const key = extractApiKey(request);
      
      if (!key) {
        return reply.status(401).send({ 
          error: 'Unauthorized', 
          message: 'Clé API requise (header X-API-Key ou query param api_key)' 
        });
      }
      
      const apiKey = await prisma.apiKey.findUnique({ where: { key } });
      
      if (!apiKey || !apiKey.enabled) {
        return reply.status(401).send({ 
          error: 'Unauthorized', 
          message: 'Clé API invalide ou désactivée' 
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
      return;
    }
    
    // Authentification Bearer
    if (route.authType === 'bearer') {
      const authHeader = request.headers['authorization'];
      
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ 
          error: 'Unauthorized', 
          message: 'Bearer token requis' 
        });
      }
      
      const token = authHeader.slice(7);
      const apiKey = await prisma.apiKey.findUnique({ where: { key: token } });
      
      if (!apiKey || !apiKey.enabled) {
        return reply.status(401).send({ 
          error: 'Unauthorized', 
          message: 'Token invalide ou désactivé' 
        });
      }
      
      if (!hasPermission(apiKey, route.id)) {
        return reply.status(403).send({ 
          error: 'Forbidden', 
          message: 'Token non autorisé pour cette route' 
        });
      }
      
      const quotaResult = await checkAndUpdateQuota(prisma, apiKey.id);
      if (!quotaResult.allowed) {
        return reply.status(429).send({ 
          error: 'Quota Exceeded', 
          message: `Quota dépassé`,
          resetAt: quotaResult.resetAt
        });
      }
      
      request.apiKey = apiKey;
      return;
    }
    
    // Authentification Basic
    if (route.authType === 'basic') {
      const credentials = extractBasicAuth(request);
      
      if (!credentials) {
        reply.header('WWW-Authenticate', 'Basic realm="API"');
        return reply.status(401).send({ 
          error: 'Unauthorized', 
          message: 'Authentification Basic requise' 
        });
      }
      
      // Le "username" est le nom de la clé, le "password" est la clé elle-même
      const apiKey = await prisma.apiKey.findUnique({ 
        where: { key: credentials.password } 
      });
      
      if (!apiKey || !apiKey.enabled) {
        reply.header('WWW-Authenticate', 'Basic realm="API"');
        return reply.status(401).send({ 
          error: 'Unauthorized', 
          message: 'Credentials invalides' 
        });
      }
      
      if (!hasPermission(apiKey, route.id)) {
        return reply.status(403).send({ 
          error: 'Forbidden', 
          message: 'Non autorisé pour cette route' 
        });
      }
      
      const quotaResult = await checkAndUpdateQuota(prisma, apiKey.id);
      if (!quotaResult.allowed) {
        return reply.status(429).send({ 
          error: 'Quota Exceeded', 
          message: `Quota dépassé`,
          resetAt: quotaResult.resetAt
        });
      }
      
      request.apiKey = apiKey;
      return;
    }
    
    // Type d'authentification inconnu
    return reply.status(500).send({ 
      error: 'Server Error', 
      message: 'Type d\'authentification non configuré' 
    });
  };
}

export default { adminAuth, apiAuth };

