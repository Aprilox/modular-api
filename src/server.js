/**
 * Modular API - Serveur principal
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

// Routes
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Fastify
const fastify = Fastify({
  logger: true
});

/**
 * Vérifie si l'application est configurée
 */
async function checkSetup() {
  try {
    const config = await prisma.config.findUnique({ where: { id: 'main' } });
    if (!config) {
      console.log('\n╔════════════════════════════════════════════════════╗');
      console.log('║  ℹ️  Première utilisation détectée!                ║');
      console.log('║  Accédez au panel pour configurer le mot de passe  ║');
      console.log('╚════════════════════════════════════════════════════╝\n');
      return null; // Retourner null au lieu de quitter
    }
    return config;
  } catch (e) {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  ⚠️  Base de données non initialisée!      ║');
    console.log('║  Lancez: npm run db:push                   ║');
    console.log('╚════════════════════════════════════════════╝\n');
    process.exit(1);
  }
}

/**
 * Configure et démarre le serveur
 */
async function start() {
  // Vérifier la configuration
  const config = await checkSetup();
  
  // Décorer fastify avec prisma
  fastify.decorate('prisma', prisma);
  fastify.decorate('config', config);

  // CORS
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true
  });

  // Cookies
  await fastify.register(fastifyCookie);

  // JWT - utiliser un secret temporaire si pas encore configuré
  const jwtSecret = config?.jwtSecret || process.env.JWT_TEMP_SECRET || 'temp-secret-change-after-setup';
  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: 'token',
      signed: false
    }
  });
  
  // Headers de sécurité
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
  });

  // Fichiers statiques (panel admin)
  const panelPath = join(rootDir, 'panel');
  if (existsSync(panelPath)) {
    await fastify.register(fastifyStatic, {
      root: panelPath,
      prefix: '/panel/'
    });
    
    // Route pour /panel sans slash
    fastify.get('/panel', async (request, reply) => {
      return reply.redirect('/panel/');
    });
    
    // Servir index.html pour /panel/
    fastify.get('/panel/', async (request, reply) => {
      return reply.sendFile('index.html');
    });
  }

  // Routes d'authentification admin
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Routes admin API
  await fastify.register(adminRoutes, { prefix: '/admin' });

  // Routes API dynamiques (doit être en dernier)
  await fastify.register(apiRoutes, { prefix: '/api' });

  // Route racine - redirection vers le panel
  fastify.get('/', async (request, reply) => {
    return reply.redirect('/panel/');
  });

  // Gestion de la fermeture
  const gracefulShutdown = async () => {
    console.log('\n🛑 Arrêt du serveur...');
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Démarrer le serveur
  const port = parseInt(process.env.PORT || '3000');
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║     🚀 MODULAR API - Serveur démarré       ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`\n📡 API:   http://localhost:${port}/api`);
    console.log(`🎛️  Panel: http://localhost:${port}/panel/\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

