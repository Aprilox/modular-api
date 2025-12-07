/**
 * Routes d'administration
 * CRUD pour les routes API et les clés API
 */

import { generateApiKey } from '../services/apiKeyManager.js';

export default async function adminRoutes(fastify, options) {
  const prisma = fastify.prisma;

  // Middleware d'authentification admin pour toutes les routes
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ==========================================
  // ROUTES API - CRUD
  // ==========================================

  /**
   * GET /admin/routes - Liste toutes les routes
   */
  fastify.get('/routes', async (request, reply) => {
    const routes = await prisma.apiRoute.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { routes };
  });

  /**
   * GET /admin/routes/:id - Détails d'une route
   */
  fastify.get('/routes/:id', async (request, reply) => {
    const { id } = request.params;
    const route = await prisma.apiRoute.findUnique({ where: { id } });
    
    if (!route) {
      return reply.status(404).send({ error: 'Route not found' });
    }
    
    return { route };
  });

  /**
   * POST /admin/routes - Créer une nouvelle route
   */
  fastify.post('/routes', {
    schema: {
      body: {
        type: 'object',
        required: ['path', 'method', 'name', 'code', 'language'],
        properties: {
          path: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] },
          name: { type: 'string' },
          description: { type: 'string' },
          code: { type: 'string' },
          language: { type: 'string', enum: ['javascript', 'python', 'bash'] },
          authType: { type: 'string', enum: ['none', 'apikey', 'bearer', 'basic'], default: 'none' },
          rateLimitEnabled: { type: 'boolean', default: false },
          rateLimitRequests: { type: 'integer', default: 100 },
          rateLimitWindow: { type: 'integer', default: 60 },
          rateLimitBy: { type: 'string', enum: ['ip', 'apikey'], default: 'ip' },
          enabled: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    const data = request.body;
    
    // S'assurer que le path commence par /
    if (!data.path.startsWith('/')) {
      data.path = '/' + data.path;
    }
    
    // Vérifier si la route existe déjà
    const existing = await prisma.apiRoute.findFirst({
      where: { path: data.path, method: data.method }
    });
    
    if (existing) {
      return reply.status(409).send({ 
        error: 'Conflict', 
        message: `Une route ${data.method} ${data.path} existe déjà` 
      });
    }
    
    const route = await prisma.apiRoute.create({ data });
    
    return reply.status(201).send({ 
      success: true, 
      message: 'Route créée avec succès',
      route 
    });
  });

  /**
   * PUT /admin/routes/:id - Modifier une route
   */
  fastify.put('/routes/:id', async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    
    // S'assurer que le path commence par /
    if (data.path && !data.path.startsWith('/')) {
      data.path = '/' + data.path;
    }
    
    try {
      const route = await prisma.apiRoute.update({
        where: { id },
        data
      });
      
      return { success: true, route };
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ error: 'Route not found' });
      }
      throw err;
    }
  });

  /**
   * DELETE /admin/routes/:id - Supprimer une route
   */
  fastify.delete('/routes/:id', async (request, reply) => {
    const { id } = request.params;
    
    try {
      await prisma.apiRoute.delete({ where: { id } });
      return { success: true, message: 'Route supprimée' };
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ error: 'Route not found' });
      }
      throw err;
    }
  });

  // ==========================================
  // CLÉS API - CRUD
  // ==========================================

  /**
   * GET /admin/keys - Liste toutes les clés API
   */
  fastify.get('/keys', async (request, reply) => {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        key: true,
        authMethod: true,
        customHeader: true,
        permissions: true,
        quotaEnabled: true,
        quotaLimit: true,
        quotaPeriod: true,
        quotaUsed: true,
        quotaResetAt: true,
        enabled: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return { keys };
  });

  /**
   * POST /admin/keys - Créer une nouvelle clé API
   */
  fastify.post('/keys', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          authMethod: { type: 'string', enum: ['header', 'bearer', 'query', 'custom'], default: 'header' },
          customHeader: { type: 'string' },
          permissions: { type: 'string', default: '*' },
          quotaEnabled: { type: 'boolean', default: false },
          quotaLimit: { type: 'integer', default: 10000 },
          quotaPeriod: { type: 'string', enum: ['day', 'week', 'month'], default: 'month' },
          expiresAt: { type: 'string', format: 'date-time' },
          enabled: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    const data = request.body;
    data.key = generateApiKey();
    
    const apiKey = await prisma.apiKey.create({ data });
    
    return reply.status(201).send({ 
      success: true, 
      message: 'Clé API créée avec succès',
      apiKey 
    });
  });

  /**
   * PUT /admin/keys/:id - Modifier une clé API
   */
  fastify.put('/keys/:id', async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    
    // Ne pas permettre de modifier la clé elle-même
    delete data.key;
    
    try {
      const apiKey = await prisma.apiKey.update({
        where: { id },
        data
      });
      
      return { success: true, apiKey };
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ error: 'API key not found' });
      }
      throw err;
    }
  });

  /**
   * DELETE /admin/keys/:id - Supprimer une clé API
   */
  fastify.delete('/keys/:id', async (request, reply) => {
    const { id } = request.params;
    
    try {
      await prisma.apiKey.delete({ where: { id } });
      return { success: true, message: 'Clé API supprimée' };
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ error: 'API key not found' });
      }
      throw err;
    }
  });

  /**
   * POST /admin/keys/:id/regenerate - Régénérer une clé API
   */
  fastify.post('/keys/:id/regenerate', async (request, reply) => {
    const { id } = request.params;
    
    try {
      const apiKey = await prisma.apiKey.update({
        where: { id },
        data: { key: generateApiKey() }
      });
      
      return { success: true, apiKey };
    } catch (err) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ error: 'API key not found' });
      }
      throw err;
    }
  });

  // ==========================================
  // STATISTIQUES & LOGS
  // ==========================================

  /**
   * GET /admin/stats - Statistiques générales
   */
  fastify.get('/stats', async (request, reply) => {
    const [routesCount, keysCount, logsCount, recentLogs] = await Promise.all([
      prisma.apiRoute.count(),
      prisma.apiKey.count(),
      prisma.requestLog.count(),
      prisma.requestLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          route: { select: { name: true, path: true } },
          apiKey: { select: { name: true } }
        }
      })
    ]);
    
    // Stats des dernières 24h
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [requests24h, avgResponseTime] = await Promise.all([
      prisma.requestLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.requestLog.aggregate({
        where: { createdAt: { gte: last24h } },
        _avg: { responseTime: true }
      })
    ]);
    
    return {
      stats: {
        routes: routesCount,
        apiKeys: keysCount,
        totalRequests: logsCount,
        requests24h,
        avgResponseTime: Math.round(avgResponseTime._avg?.responseTime || 0)
      },
      recentLogs
    };
  });

  /**
   * GET /admin/logs - Logs des requêtes
   */
  fastify.get('/logs', async (request, reply) => {
    const { limit = 100, offset = 0, routeId, apiKeyId } = request.query;
    
    const where = {};
    if (routeId) where.routeId = routeId;
    if (apiKeyId) where.apiKeyId = apiKeyId;
    
    const [logs, total] = await Promise.all([
      prisma.requestLog.findMany({
        where,
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          route: { select: { name: true, path: true } },
          apiKey: { select: { name: true } }
        }
      }),
      prisma.requestLog.count({ where })
    ]);
    
    return { logs, total, limit: parseInt(limit), offset: parseInt(offset) };
  });

  /**
   * DELETE /admin/logs - Supprimer les logs
   */
  fastify.delete('/logs', async (request, reply) => {
    const { before } = request.query;
    
    const where = {};
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }
    
    const result = await prisma.requestLog.deleteMany({ where });
    
    return { success: true, deleted: result.count };
  });
}

