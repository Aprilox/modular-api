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
  <img src="docs/screenshot.png" alt="Panel Admin" width="800">
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

const axios = require('axios');

const response = await axios.get('https://api.example.com/data');
json({
  success: true,
  data: response.data
});
```

### Python

```python
# Variables disponibles: request, params, query, body, headers
# Fonctions: json_response(data, status), respond(data, status, headers)

import random
from datetime import datetime

json_response({
    'number': random.randint(1, 100),
    'generated_at': datetime.now().isoformat()
})
```

---

## ⚙️ Configuration

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL de connexion BDD | `file:./data.db` |
| `PORT` | Port du serveur | `3000` |
| `CODE_TIMEOUT` | Timeout d'exécution (ms) | `5000` |
| `ENABLE_JAVASCRIPT` | Activer JavaScript | `true` |
| `ENABLE_PYTHON` | Activer Python | `true` |

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
│   ├── server.js           # Serveur Fastify principal
│   ├── routes/
│   │   ├── api.js          # Routes API dynamiques
│   │   ├── admin.js        # API d'administration
│   │   └── auth.js         # Authentification
│   ├── services/
│   │   ├── codeRunner.js   # Exécution de code
│   │   └── dependencyManager.js
│   └── middleware/
│       └── auth.js         # Middleware d'authentification
├── panel/                  # Interface web admin
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── prisma/
│   └── schema.prisma       # Schéma de base de données
└── env.example
```

---

## 🔒 Sécurité

- ✅ Mot de passe admin hashé (bcrypt)
- ✅ JWT avec expiration 24h
- ✅ Exécution de code sandboxée avec timeout
- ✅ Rate limiting configurable
- ✅ Headers de sécurité HTTP
- ✅ Protection CSRF sur les formulaires

---

## 📝 Commandes

| Commande | Description |
|----------|-------------|
| `pnpm start` | Démarrer le serveur |
| `pnpm run dev` | Mode développement (hot reload) |
| `pnpm run db:push` | Synchroniser le schéma BDD |
| `pnpm run db:studio` | Interface Prisma Studio |

---

## 🤝 Contribution

Les PRs sont les bienvenues ! N'hésitez pas à ouvrir une issue pour discuter des changements.

---

## 📄 Licence

MIT © [Aprilox](https://github.com/Aprilox)
