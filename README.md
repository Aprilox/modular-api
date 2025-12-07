# 🛡️ Modular API

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/fastify-5.x-black" alt="Fastify">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

<p align="center">
  <strong>Plateforme API modulaire all-in-one</strong><br>
  Créez des routes API dynamiques avec exécution de code, authentification et rate limiting.
</p>

<p align="center">
  <img src=".github/assets/home.png" alt="Panel Admin" width="800">
</p>

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| 🛣️ **Routes dynamiques** | Créez des endpoints API à la volée via le panel |
| 💻 **Multi-langages** | JavaScript (Node.js) et Python |
| 🔐 **Authentification** | Public, API Key, Bearer Token, Header personnalisé |
| ⏱️ **Rate limiting** | Par IP ou par clé API, configurable par route |
| 🔑 **Gestion des clés API** | Permissions par route, compteur de requêtes |
| 📦 **Dépendances** | Installation et gestion des packages npm/pip |
| 📊 **Logs détaillés** | Historique des requêtes avec erreurs |
| 🗄️ **Multi-database** | SQLite, PostgreSQL, MySQL, MariaDB |
| 🎨 **IDE intégré** | Éditeur de code avec coloration syntaxique |
| 🚀 **Cache intelligent** | Cache des routes avec statistiques en temps réel |
| 🛡️ **Anti-bruteforce** | Protection contre les attaques par force brute |
| 🌐 **Variables d'env** | Variables d'environnement personnalisées par route |
| 💾 **Export/Import** | Sauvegarde et restauration de la configuration |
| ⚠️ **Gestion d'erreurs** | Gestionnaire d'erreurs global robuste |

---

## 🚀 Installation

```bash
# Cloner le projet
git clone https://github.com/Aprilox/modular-api.git
cd modular-api

# Installer les dépendances
pnpm install

# Configurer l'environnement
cp env.example .env

# Initialiser la base de données
pnpm run db:push

# Démarrer le serveur
pnpm start
```

Au premier lancement, accédez à **http://localhost:3000/panel/** pour configurer le mot de passe admin.

---

## 📖 Utilisation

### 1. Configuration initiale

Ouvrez **http://localhost:3000/panel/** et créez votre mot de passe admin.

### 2. Créer une route API

Dans le panel, créez une nouvelle route :

- **Path** : `/hello`
- **Méthode** : `GET`
- **Langage** : `JavaScript`

```javascript
const name = query.name || 'World';
json({ 
  message: `Hello ${name}!`,
  timestamp: new Date().toISOString()
});
```

### 3. Tester

```bash
curl http://localhost:3000/api/hello?name=Dev
# {"message":"Hello Dev!","timestamp":"2025-12-07T..."}
```

---

## 💻 Exemples de code

### JavaScript (Node.js)

```javascript
// Variables disponibles: request, params, query, body, headers
// Fonctions: json(data, status), respond(data, status, headers)
// process.env contient les variables d'environnement de la route

const axios = require('axios');

const response = await axios.get('https://api.example.com/data');
json({
  success: true,
  data: response.data
});
```

### JavaScript avec variables d'environnement

```javascript
// Utilise les variables définies dans le panel
const axios = require('axios');

const response = await axios.post('https://api.openai.com/v1/chat/completions', {
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: query.prompt || 'Hello!' }]
}, {
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_KEY}`
  }
});

json(response.data);
```

### Python

```python
# Variables disponibles: request, params, query, body, headers
# Fonctions: json_response(data, status), respond(data, status, headers)
# os.environ contient les variables d'environnement de la route

import random
from datetime import datetime

json_response({
    'number': random.randint(1, 100),
    'generated_at': datetime.now().isoformat()
})
```

---

## 🔐 Types d'authentification

| Type | Description | Usage |
|------|-------------|-------|
| **Public** | Aucune authentification requise | APIs ouvertes |
| **API Key** | Clé dans header `X-API-Key` | Applications tierces |
| **Bearer Token** | Token JWT dans `Authorization: Bearer <token>` | Auth utilisateur |
| **Header personnalisé** | Header custom + valeur | Intégrations spécifiques |

---

## 🛡️ Sécurité

| Protection | Description |
|------------|-------------|
| ✅ **Mot de passe hashé** | bcrypt avec salt |
| ✅ **JWT sécurisé** | Expiration 24h, secret aléatoire |
| ✅ **Anti-bruteforce** | 5 tentatives / 15 min sur le login |
| ✅ **Code sandboxé** | Exécution isolée avec timeout |
| ✅ **Rate limiting** | Configurable par route (IP ou API Key) |
| ✅ **Headers sécurité** | X-Content-Type-Options, X-Frame-Options, etc. |
| ✅ **CORS configurable** | Origines autorisées personnalisables |

---

## 🚀 Cache des routes

Le cache améliore les performances en stockant les configurations de routes en mémoire.

- **TTL** : 1 minute par défaut
- **Invalidation** : Automatique lors des modifications
- **Stats** : Visible dans le dashboard (hit rate, taille cache)

---

## 💾 Export / Import

### Export

Depuis **Paramètres > Export**, téléchargez un fichier JSON contenant :
- Toutes les routes (code, auth, rate limit, envVars)
- Toutes les clés API (permissions, quotas)
- Liste des dépendances installées

### Import

Depuis **Paramètres > Import** :
- **Fusionner** : Ajoute/met à jour sans supprimer l'existant
- **Écraser** : Remplace toute la configuration
- **Annuler** : Ferme sans importer

> 💡 Après un import, utilisez "Installer les dépendances manquantes" pour installer les packages requis.

---

## ⚙️ Configuration

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL de connexion BDD | `file:./data.db` |
| `PORT` | Port du serveur | `3000` |
| `HOST` | Adresse d'écoute | `0.0.0.0` |
| `CODE_TIMEOUT` | Timeout d'exécution (ms) | `5000` |
| `ENABLE_JAVASCRIPT` | Activer JavaScript | `true` |
| `ENABLE_PYTHON` | Activer Python | `true` |
| `JWT_SECRET` | Secret JWT (auto-généré si absent) | - |

### Variables par route

Dans le panel, cochez "Variables d'environnement personnalisées" et entrez du JSON :

```json
{
  "OPENAI_KEY": "sk-xxx...",
  "API_SECRET": "my-secret-value"
}
```

Ces variables sont accessibles via `process.env` (JS) ou `os.environ` (Python).

### Bases de données

```env
# SQLite (défaut - recommandé pour démarrer)
DATABASE_URL="file:./data.db"

# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/modular_api"

# MySQL / MariaDB
DATABASE_URL="mysql://user:password@localhost:3306/modular_api"
```

---

## 📁 Structure du projet

```
modular-api/
├── src/
│   ├── server.js              # Serveur Fastify principal
│   ├── routes/
│   │   ├── api.js             # Routes API dynamiques
│   │   ├── admin.js           # API d'administration
│   │   └── auth.js            # Authentification (+ anti-bruteforce)
│   ├── services/
│   │   ├── codeRunner.js      # Exécution de code sandboxée
│   │   ├── dependencyManager.js # Gestion des packages npm/pip
│   │   ├── apiKeyManager.js   # Gestion des clés API
│   │   ├── rateLimiter.js     # Rate limiting
│   │   └── routeCache.js      # Cache des routes
│   └── middleware/
│       └── auth.js            # Middleware d'authentification
├── panel/                     # Interface web admin
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── prisma/
│   └── schema.prisma          # Schéma de base de données
└── env.example
```

---

## 📝 Commandes

| Commande | Description |
|----------|-------------|
| `pnpm start` | Démarrer le serveur |
| `pnpm run dev` | Mode développement (hot reload) |
| `pnpm run db:push` | Synchroniser le schéma BDD |
| `pnpm run db:studio` | Interface Prisma Studio |

---

## 📊 Dashboard

Le panel admin affiche :
- **Nombre de routes** actives
- **Nombre de clés API** créées  
- **Requêtes totales** traitées
- **Cache hit rate** (pourcentage de requêtes servies depuis le cache)

---

## 🔧 Dépendances

### Installation automatique

1. Allez dans l'onglet **Dépendances**
2. Cliquez sur **"Installer les dépendances manquantes"**
3. Suivez les logs en temps réel

### Installation manuelle

```bash
# JavaScript (npm/pnpm)
pnpm add axios lodash moment

# Python (pip)
pip install requests pandas numpy
```

---

## 🤝 Contribution

Les PRs sont les bienvenues ! N'hésitez pas à ouvrir une issue pour discuter des changements.

---

## 📄 Licence

MIT © [Aprilox](https://github.com/Aprilox)
