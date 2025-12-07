/**
 * Setup - Premier lancement de l'application
 * Demande le mot de passe admin et initialise la configuration
 */

import { createInterface } from 'readline';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const prisma = new PrismaClient();

/**
 * Demande une entrée utilisateur via le terminal
 */
function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (hidden) {
      process.stdout.write(question);
      let password = '';
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (char) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          console.log();
          resolve(password);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007F' || char === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += char;
          process.stdout.write('*');
        }
      };
      
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * Génère un secret JWT aléatoire
 */
function generateJwtSecret() {
  return randomBytes(64).toString('hex');
}

/**
 * Met à jour le fichier .env
 */
function updateEnvFile(updates) {
  const envPath = join(rootDir, '.env');
  let content = '';
  
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf8');
  }
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    
    if (regex.test(content)) {
      content = content.replace(regex, newLine);
    } else {
      content += (content.endsWith('\n') || content === '' ? '' : '\n') + newLine + '\n';
    }
  }
  
  writeFileSync(envPath, content);
}

/**
 * Setup principal
 */
async function setup() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     🚀 MODULAR API - Configuration        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Vérifier si déjà configuré
  try {
    const existingConfig = await prisma.config.findUnique({ where: { id: 'main' } });
    if (existingConfig) {
      const reconfigure = await prompt('⚠️  Configuration existante détectée. Reconfigurer? (o/N): ');
      if (reconfigure.toLowerCase() !== 'o' && reconfigure.toLowerCase() !== 'oui') {
        console.log('\n✅ Configuration existante conservée.');
        process.exit(0);
      }
    }
  } catch (e) {
    // Table n'existe pas encore, c'est normal au premier lancement
  }

  // Demander le mot de passe admin
  console.log('📝 Configuration du compte administrateur\n');
  
  let password, confirmPassword;
  do {
    password = await prompt('Mot de passe admin: ', true);
    
    if (password.length < 8) {
      console.log('❌ Le mot de passe doit contenir au moins 8 caractères.\n');
      continue;
    }
    
    confirmPassword = await prompt('Confirmer le mot de passe: ', true);
    
    if (password !== confirmPassword) {
      console.log('❌ Les mots de passe ne correspondent pas.\n');
    }
  } while (password.length < 8 || password !== confirmPassword);

  // Hasher le mot de passe
  const adminHash = await bcrypt.hash(password, 12);
  
  // Générer le secret JWT
  const jwtSecret = generateJwtSecret();

  // Sauvegarder dans la base de données
  await prisma.config.upsert({
    where: { id: 'main' },
    update: { adminHash, jwtSecret },
    create: { id: 'main', adminHash, jwtSecret }
  });

  // Mettre à jour le fichier .env
  updateEnvFile({
    JWT_SECRET: jwtSecret
  });

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     ✅ Configuration terminée!             ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('\n🎉 Vous pouvez maintenant démarrer le serveur avec: npm start\n');
  
  await prisma.$disconnect();
  process.exit(0);
}

// Lancer le setup
setup().catch(async (e) => {
  console.error('\n❌ Erreur lors de la configuration:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});

