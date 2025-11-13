# Game Auto-Stop Manager 🎮⏹️

> Automatically stop game server containers after inactivity. Perfect for Unraid and Docker-based deployments.

Un seul conteneur Docker qui pilote vos conteneurs de jeux et **arrête** chaque serveur après `X` minutes sans joueur, configurable via une **UI Web** moderne (aucun paramètre à taper dans Unraid).

## ✨ Caractéristiques

- 🎮 **Multi-jeux**: VRising, Valheim, Minecraft, Satisfactory, protocol-valve/Source, 7 Days to Die, etc.
- 🎯 **Multi-conteneurs**: Gérez plusieurs serveurs simultanément
- 🌐 **UI Web moderne**: Dark theme, dashboard responsive, actions rapides
- 🔍 **Real-time monitoring**: Logs en temps réel via SSE (Server-Sent Events)
- ⚙️ **Smart polling**: Gamedig pour les jeux standards, API HTTPS pour Satisfactory
- 💾 **Configuration persistante**: Sauvegarde atomique dans `/data/config.json`
- 🐳 **Docker-native**: Intégration Docker via `/var/run/docker.sock`
- 🔐 **Auth optionnelle**: Bearer token `ADMIN_TOKEN` pour sécuriser l'accès
- 🏷️ **Docker labels**: Sync automatique via labels de conteneurs
- 📦 **Architecture modulaire**: Séparation des concerns (storage, docker, polling)

## 📚 Documentation

Consultez la documentation complète pour les détails techniques:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Structure modulaire, module breakdown, dépendances
- **[DESIGN.md](./DESIGN.md)** - Design UI/UX, couleurs, composants, accessibilité
- **[SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md)** - Configuration Satisfactory (API HTTPS, tokens)
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start en 3 étapes

## 🚀 Démarrage Rapide

**👉 [GETTING_STARTED.md](./GETTING_STARTED.md)** - Pour démarrer en 3 étapes!

### Sur Unraid

1. **Créez un dossier de configuration**:
   ```bash
   mkdir -p /mnt/user/appdata/game-autostop-manager
   ```

2. **Déployez le conteneur Docker**:
   - Image: `ghcr.io/your-username/game-autostop-manager:latest`
   - Volumes:
     - `/var/run/docker.sock:/var/run/docker.sock` (Docker API)
     - `/mnt/user/appdata/game-autostop-manager:/data` (Configuration)
   - Port: `8080:8080`
   - Variables d'environnement (optionnel):
     - `ADMIN_TOKEN=votre_token_secret`
     - `LABEL_PREFIX=autostop.` (pour les labels Docker)
     - `RESCAN_INTERVAL_SEC=300` (rescan des labels)

3. **Accédez à l'interface**:
   ```
   http://<IP-unraid>:8080
   ```

### Avec Docker Compose

```yaml
version: '3.8'

services:
  game-autostop-manager:
    image: ghcr.io/your-username/game-autostop-manager:latest
    container_name: game-autostop-manager
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/data
    environment:
      - ADMIN_TOKEN=your_secret_token
      - NODE_ENV=production
    restart: unless-stopped
```

### Développement Local

```bash
# Installation
npm install

# Démarrage
npm start

# Mode développement (avec rechargement)
npm run dev
```

## 🎮 Utilisation

### Créer un Watcher

1. Remplissez le formulaire avec:
   - **Name**: Nom du serveur (ex: "V-Rising Server")
   - **Target Container**: Nom/ID du conteneur à monitorer
   - **Game Type**: Type de jeu (ex: "valheim", "minecraft", "satisfactory")
   - **Host/Port**: IP et port du serveur (auto-remplis pour les conteneurs)
   - **Inactivity Time**: Minutes sans joueurs avant arrêt (défaut: 10 min)
   - **Check Interval**: Fréquence des vérifications (défaut: 60 sec)
   - **Stop Timeout**: Délai avant forçage de l'arrêt (défaut: 60 sec)

2. Cliquez "Add Watcher"

### Configuration via Docker Labels

Vous pouvez aussi configurer via les labels du conteneur:

```bash
docker run \
  -l autostop.enabled=true \
  -l autostop.name="My Game Server" \
  -l autostop.gamedig_type=valheim \
  -l autostop.query_host=game-server \
  -l autostop.query_port=2456 \
  -l autostop.inactivity_min=15 \
  ...
```

Voir [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) pour les labels Satisfactory spécifiques.

## 🏗️ Architecture

Le projet est organisé en modules pour meilleure maintenabilité:

```
src/
├── manager.js          # Orchestration hub (230 lignes)
├── storage.js          # Config I/O (50 lignes)
├── docker.js           # Docker operations (190 lignes)
├── watcher-polling.js  # Polling logic (190 lignes)
└── providers/
    └── satisfactory.js # Satisfactory API (130 lignes)
```

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour les détails complets.

## 🎨 Interface Utilisateur

- **Dark Theme** moderne inspiré par Vercel, GitHub, VS Code
- **Responsive Design** adapté aux écrans mobiles
- **Real-time Logs** avec emoji indicators (ℹ️ ⚠️ ❌ 🐛)
- **Quick Actions** pour démarrer/arrêter les serveurs
- **Status Badges** avec couleur-coding (🟢 running / 🔴 stopped)

Voir [DESIGN.md](./DESIGN.md) pour tous les détails.

## 🛠️ Technologies

- **Runtime**: Node.js 18+
- **API**: Express.js
- **Docker**: dockerode
- **Server Query**: GameDig, custom Satisfactory API
- **Frontend**: Vanilla JavaScript (ES2015+)
- **Styling**: Modern CSS avec variables custom

## 📦 Dépendances

```json
{
  "axios": "1.7.7",
  "dockerode": "^4.0.2",
  "express": "^4.19.2",
  "gamedig": "^4.1.2",
  "morgan": "^1.10.0",
  "nanoid": "^4.0.2"
}
```

## 🔐 Sécurité

- Bearer token authentication (optionnel)
- HTTPS pour Satisfactory API (certificats auto-signés acceptés)
- Pas de stockage de mots de passe (tokens uniquement)
- Logs non exposés sans authentification

## 📝 Configuration

Exemple `config.json`:

```json
{
  "watchers": [
    {
      "id": "valheim-srv",
      "name": "Valheim Server",
      "targetContainer": "valheim",
      "gamedigType": "valheim",
      "queryHost": "192.168.1.100",
      "queryPort": 2456,
      "inactivityMinutes": 15,
      "checkIntervalSec": 60,
      "stopTimeoutSec": 60,
      "autostart": true
    }
  ]
}
```

## 🚢 Déploiement

### Build Docker

```bash
docker build -t game-autostop-manager .
docker run -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v appdata:/data \
  game-autostop-manager
```

### Images Multi-stage

Le `Dockerfile` utilise la technique multi-stage pour minimiser la taille:

1. **Build stage**: Construction Node.js
2. **Runtime stage**: Node.js léger avec dépendances uniquement

## 🤝 Contribution

Les contributions sont bienvenues! Consultez les documents MD pour comprendre l'architecture.

## 📄 Licence

Voir `../LICENSE` pour les détails.

## 📞 Support

- 🐛 Signaler un bug: Ouvrez une issue
- 💡 Suggestion: Discussion section
- 📖 Questions: Consultez les documents MD

---

**Fait avec ❤️ pour les administrateurs Unraid**
