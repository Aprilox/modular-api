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
      console.log('\n╔════════════════════════════════════════════╗');
      console.log('║  ⚠️  Application non configurée!           ║');
      console.log('║  Lancez: npm run setup                     ║');
      console.log('╚════════════════════════════════════════════╝\n');
      process.exit(1);
    }
    return config;
  } catch (e) {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  ⚠️  Base de données non initialisée!      ║');
    console.log('║  Lancez: npm run db:push                   ║');
    console.log('║  Puis:   npm run setup                     ║');
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

  // JWT
  await fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: {
      cookieName: 'token',
      signed: false
    }
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

