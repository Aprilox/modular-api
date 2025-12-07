/**
 * Routes d'authentification admin
 */

import bcrypt from 'bcryptjs';
import { checkRateLimit, resetRateLimit } from '../services/rateLimiter.js';

// Configuration du rate limiting pour le login
const LOGIN_RATE_LIMIT = {
  requests: 5,      // 5 tentatives max
  window: 900       // par 15 minutes
};

export default async function authRoutes(fastify, options) {
  const prisma = fastify.prisma;

  /**
   * GET /auth/status - Vérifier si l'application est configurée
   */
  fastify.get('/status', async (request, reply) => {
    const config = await prisma.config.findUnique({ where: { id: 'main' } });
    return { 
      configured: !!config,
      needsSetup: !config
    };
  });

  /**
   * POST /auth/setup - Configuration initiale (premier mot de passe)
   */
  fastify.post('/setup', {
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    // Vérifier si déjà configuré
    const existingConfig = await prisma.config.findUnique({ where: { id: 'main' } });
    
    if (existingConfig) {
      return reply.status(400).send({ 
        error: 'Already Configured', 
        message: 'L\'application est déjà configurée' 
      });
    }
    
    const { password } = request.body;
    
    // Hasher le mot de passe
    const adminHash = await bcrypt.hash(password, 12);
    
    // Générer un secret JWT
    const crypto = await import('crypto');
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    
    // Créer la config
    await prisma.config.create({
      data: {
        id: 'main',
        adminHash,
        jwtSecret
      }
    });
    
    return { 
      success: true, 
      message: 'Configuration initiale terminée ! Vous pouvez maintenant vous connecter.' 
    };
  });

  /**
   * POST /auth/login - Connexion admin
   * Protection anti-bruteforce : 5 tentatives max par 15 minutes
   */
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    
    // Vérifier le rate limit anti-bruteforce
    const rateLimitResult = checkRateLimit(clientIp, {
      routeId: 'auth-login',
      ...LOGIN_RATE_LIMIT
    });
    
    if (!rateLimitResult.allowed) {
      reply.header('Retry-After', rateLimitResult.retryAfter);
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(rateLimitResult.retryAfter / 60)} minute(s).`,
        retryAfter: rateLimitResult.retryAfter
      });
    }
    
    const { password } = request.body;
    
    // Récupérer la config
    const config = await prisma.config.findUnique({ where: { id: 'main' } });
    
    if (!config) {
      return reply.status(500).send({ 
        error: 'Server Error', 
        message: 'Application non configurée' 
      });
    }
    
    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, config.adminHash);
    
    if (!valid) {
      return reply.status(401).send({ 
        error: 'Unauthorized', 
        message: `Mot de passe incorrect. ${rateLimitResult.remaining} tentative(s) restante(s).`
      });
    }
    
    // Connexion réussie : réinitialiser le rate limit pour cette IP
    resetRateLimit(clientIp, 'auth-login');
    
    // Générer le JWT
    const token = fastify.jwt.sign(
      { admin: true },
      { expiresIn: '24h' }
    );
    
    // Définir le cookie
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 heures
    });
    
    return { 
      success: true, 
      message: 'Connexion réussie',
      token 
    };
  });

  /**
   * POST /auth/logout - Déconnexion admin
   */
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true, message: 'Déconnexion réussie' };
  });

  /**
   * GET /auth/verify - Vérifier le token
   */
  fastify.get('/verify', async (request, reply) => {
    try {
      await request.jwtVerify();
      return { valid: true, admin: true };
    } catch (err) {
      return reply.status(401).send({ valid: false });
    }
  });

  /**
   * POST /auth/change-password - Changer le mot de passe admin
   */
  fastify.post('/change-password', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body;
    
    const config = await prisma.config.findUnique({ where: { id: 'main' } });
    
    // Vérifier l'ancien mot de passe
    const valid = await bcrypt.compare(currentPassword, config.adminHash);
    if (!valid) {
      return reply.status(401).send({ 
        error: 'Unauthorized', 
        message: 'Mot de passe actuel incorrect' 
      });
    }
    
    // Hasher le nouveau mot de passe
    const newHash = await bcrypt.hash(newPassword, 12);
    
    // Mettre à jour
    await prisma.config.update({
      where: { id: 'main' },
      data: { adminHash: newHash }
    });
    
    return { success: true, message: 'Mot de passe modifié avec succès' };
  });
}

