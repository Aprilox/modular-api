# Modular API

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
</p>

Plateforme API modulaire all-in-one. Créez des routes API dynamiques avec exécution de code multi-langages, authentification configurable et rate limiting.

## ✨ Fonctionnalités

- 🛣️ **Routes dynamiques** - Créez des endpoints à la volée via le panel web
- 🌐 **Multi-langages** - JavaScript, Python, Bash (PowerShell sur Windows)
- 🔐 **Authentification flexible** - Public, API Key, Bearer Token, Basic Auth
- ⏱️ **Rate limiting** - Par IP ou par clé API, configurable par route
- 🔑 **Gestion des clés API** - Permissions granulaires et quotas
- 📊 **Logs & Analytics** - Suivi des requêtes en temps réel
- 🗄️ **Multi-database** - SQLite, PostgreSQL, MySQL, MariaDB
- 🎨 **Panel moderne** - Interface web avec éditeur de code intégré

## 🚀 Installation

```bash
# Cloner le projet
git clone https://github.com/Aprilox/modular-api.git
cd modular-api

# Installer les dépendances
npm install

# Configurer l'environnement
cp env.example .env

# Initialiser la base de données
npm run db:push

# Configurer le mot de passe admin
npm run setup

# Démarrer le serveur
npm start
```

Le serveur démarre sur **http://localhost:3000**

## 📖 Utilisation rapide

### 1. Accéder au panel

Ouvrez **http://localhost:3000/panel/** et connectez-vous.

### 2. Créer une route

```javascript
// Route: GET /hello
// Langage: JavaScript

const name = query.name || 'World';
json({ message: `Hello ${name}!` });
```

### 3. Tester

```bash
curl http://localhost:3000/api/hello?name=Dev
# {"message":"Hello Dev!"}
```

## 💻 Exemples de code

### JavaScript
```javascript
json({ 
  message: "Hello!",
  params: params,
  query: query 
});
```

### Python
```python
import random
json_response({
    'number': random.randint(1, 100)
})
```

## ⚙️ Configuration

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL de la base de données | `file:./data.db` |
| `PORT` | Port du serveur | `3000` |
| `CODE_TIMEOUT` | Timeout d'exécution (ms) | `5000` |

### Bases de données supportées

```env
# SQLite (défaut)
DATABASE_URL="file:./data.db"

# PostgreSQL
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# MySQL / MariaDB
DATABASE_URL="mysql://user:pass@localhost:3306/db"
```

## 📁 Structure

```
modular-api/
├── src/
│   ├── server.js          # Serveur Fastify
│   ├── setup.js           # Configuration initiale
│   ├── routes/            # Routes API
│   ├── services/          # Logique métier
│   └── middleware/        # Middlewares
├── panel/                 # Interface web
├── prisma/                # Schéma BDD
└── env.example
```

## 🔒 Sécurité

- Mot de passe admin hashé (bcrypt)
- JWT avec expiration 24h
- Exécution de code sandboxée avec timeout
- Rate limiting intégré

## 📝 Scripts

| Commande | Description |
|----------|-------------|
| `npm start` | Démarrer le serveur |
| `npm run dev` | Mode développement |
| `npm run setup` | Configurer l'admin |
| `npm run db:push` | Sync base de données |
| `npm run db:studio` | Interface Prisma |

## 📄 Licence

MIT

