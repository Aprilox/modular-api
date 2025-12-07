/**
 * Routes API dynamiques
 * Gère toutes les routes créées par l'utilisateur
 */

import { executeCode } from '../services/codeRunner.js';
import { apiAuth } from '../middleware/auth.js';
import { checkRateLimit } from '../services/rateLimiter.js';

export default async function apiRoutes(fastify, options) {
  const prisma = fastify.prisma;

  /**
   * Route /api - Page d'accueil de l'API
   */
  fastify.get('/', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  /**
   * Route catch-all pour les API dynamiques
   * Capture toutes les requêtes sous /api/*
   */
  fastify.all('/*', async (request, reply) => {
    const startTime = Date.now();
    
    // Extraire le path (sans /api)
    const path = '/' + (request.params['*'] || '');
    const method = request.method;
    
    // Chercher la route correspondante
    let route = await findMatchingRoute(prisma, path, method);
    
    if (!route) {
      return reply.status(404).send({ 
        error: 'Not Found', 
        message: `Route ${method} ${path} non trouvée` 
      });
    }
    
    if (!route.enabled) {
      return reply.status(503).send({ 
        error: 'Service Unavailable', 
        message: 'Cette route est désactivée' 
      });
    }
    
    // Stocker la config de la route pour les middlewares
    request.dynamicRoute = route;
    
    // Vérifier l'authentification
    const authMiddleware = apiAuth(prisma);
    const authResult = await authMiddleware(request, reply);
    if (reply.sent) return; // L'auth a renvoyé une erreur
    
    // Vérifier le rate limiting
    if (route.rateLimitEnabled) {
      const identifier = route.rateLimitBy === 'apikey' && request.apiKey 
        ? request.apiKey.key 
        : request.ip;
      
      const rateLimitResult = checkRateLimit(identifier, {
        routeId: route.id,
        requests: route.rateLimitRequests,
        window: route.rateLimitWindow,
        enabled: route.rateLimitEnabled
      });
      
      reply.header('X-RateLimit-Limit', rateLimitResult.limit);
      reply.header('X-RateLimit-Remaining', rateLimitResult.remaining);
      reply.header('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetAt / 1000));
      
      if (!rateLimitResult.allowed) {
        reply.header('Retry-After', rateLimitResult.retryAfter);
        
        await logRequest(prisma, request, route, 429, Date.now() - startTime, 'Rate limit exceeded');
        
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: `Limite de ${rateLimitResult.limit} requêtes par ${rateLimitResult.window} secondes dépassée`,
          retryAfter: rateLimitResult.retryAfter
        });
      }
    }
    
    // Extraire les paramètres de route (ex: /users/:id -> { id: '123' })
    const params = extractParams(route.path, path);
    
    // Préparer le contexte pour l'exécution du code
    const context = {
      request: {
        method,
        path,
        url: request.url
      },
      params,
      query: request.query || {},
      body: request.body || {},
      headers: request.headers || {}
    };
    
    // Exécuter le code
    const result = await executeCode(route.language, route.code, context);
    
    const responseTime = Date.now() - startTime;
    
    // Extraire le message d'erreur si présent
    let errorMessage = null;
    if (result.status >= 400 && result.body) {
      if (typeof result.body === 'object' && result.body.error) {
        errorMessage = result.body.error;
      } else if (typeof result.body === 'string') {
        errorMessage = result.body;
      }
    }
    
    // Logger la requête
    await logRequest(prisma, request, route, result.status, responseTime, errorMessage);
    
    // Appliquer les headers de la réponse
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        reply.header(key, value);
      }
    }
    
    // Ajouter le temps d'exécution dans les headers
    reply.header('X-Execution-Time', `${result.executionTime}ms`);
    reply.header('X-Response-Time', `${responseTime}ms`);
    
    return reply.status(result.status).send(result.body);
  });
}

/**
 * Trouve une route correspondant au path et à la méthode
 * Supporte les paramètres dynamiques (ex: /users/:id)
 */
async function findMatchingRoute(prisma, path, method) {
  // D'abord chercher une correspondance exacte
  let route = await prisma.apiRoute.findFirst({
    where: { path, method }
  });
  
  if (route) return route;
  
  // Sinon chercher les routes avec paramètres
  const routes = await prisma.apiRoute.findMany({
    where: { method }
  });
  
  for (const r of routes) {
    if (matchPath(r.path, path)) {
      return r;
    }
  }
  
  return null;
}

/**
 * Vérifie si un path correspond à un pattern avec paramètres
 */
function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      continue; // Paramètre dynamique, match tout
    }
    if (patternParts[i] !== pathParts[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extrait les paramètres d'un path selon un pattern
 */
function extractParams(pattern, path) {
  const params = {};
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].slice(1);
      params[paramName] = pathParts[i];
    }
  }
  
  return params;
}

/**
 * Enregistre une requête dans les logs
 */
async function logRequest(prisma, request, route, statusCode, responseTime, errorMessage = null) {
  try {
    // Tronquer les données pour éviter les logs trop gros
    const truncate = (str, max = 2000) => {
      if (!str) return null;
      const s = typeof str === 'string' ? str : JSON.stringify(str);
      return s.length > max ? s.substring(0, max) + '...' : s;
    };
    
    // Filtrer les headers sensibles
    const safeHeaders = { ...request.headers };
    delete safeHeaders['authorization'];
    delete safeHeaders['x-api-key'];
    delete safeHeaders['cookie'];
    
    await prisma.requestLog.create({
      data: {
        path: request.url,
        method: request.method,
        ip: request.ip || request.headers['x-forwarded-for'] || 'unknown',
        userAgent: request.headers['user-agent'],
        requestHeaders: truncate(safeHeaders),
        requestBody: truncate(request.body),
        statusCode,
        responseTime,
        errorMessage: truncate(errorMessage, 500),
        routeId: route?.id,
        apiKeyId: request.apiKey?.id
      }
    });
  } catch (err) {
    // Ne pas faire échouer la requête si le log échoue
    console.error('Erreur lors du log:', err.message);
  }
}

