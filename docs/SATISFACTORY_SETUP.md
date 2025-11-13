# Configuration Satisfactory

## Vue d'ensemble

Le support Satisfactory a été intégré au manager. Au lieu d'utiliser GameDig (qui se connecte au port UDP 48888), Satisfactory utilise une **API HTTPS propriétaire** sur le port **7777**.

## Configuration via API REST

Pour créer un watcher Satisfactory via l'API REST :

```bash
curl -X POST http://localhost:8080/api/watchers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon serveur Satisfactory",
    "targetContainer": "satisfactory-container",
    "gamedigType": "satisfactory",
    "host": "192.168.1.100",
    "port": 7777,
    "apiToken": "YOUR_API_TOKEN",
    "inactivityMinutes": 10,
    "checkIntervalSec": 60,
    "stopTimeoutSec": 60,
    "autostart": true
  }'
```

### Champs Satisfactory

- **`host`** : Adresse IP du serveur Satisfactory (ou nom du conteneur)
- **`port`** : Port HTTPS API (défaut: 7777)
- **`apiToken`** : Token d'authentification Satisfactory (obligatoire pour Satisfactory)

## Configuration via Docker Labels

Vous pouvez aussi utiliser des labels Docker :

```yaml
services:
  satisfactory:
    image: wolveix/satisfactory-server:latest
    container_name: satisfactory-server
    labels:
      autostop.enabled: "true"
      autostop.gamedig_type: "satisfactory"
      autostop.query_host: "192.168.1.100"
      autostop.query_port: "7777"
      autostop.api_token: "YOUR_API_TOKEN"
      autostop.inactivity_min: "10"
      autostop.interval_sec: "60"
      autostop.stop_timeout_sec: "60"
```

## Configuration JSON

Vous pouvez aussi éditer directement `data/config.json` :

```json
{
  "watchers": [
    {
      "id": "satisfactory-1",
      "name": "Mon serveur Satisfactory",
      "targetContainer": "satisfactory-server",
      "gamedigType": "satisfactory",
      "host": "192.168.1.100",
      "port": 7777,
      "apiToken": "YOUR_API_TOKEN",
      "inactivityMinutes": 10,
      "checkIntervalSec": 60,
      "stopTimeoutSec": 60,
      "autostart": true,
      "running": false
    }
  ]
}
```

## Authentification

### Obtenir votre API Token

Vous avez besoin d'un token valide pour accéder à l'API Satisfactory. Consultez la documentation du serveur Satisfactory pour savoir comment générer un token.

### Utiliser le token

Définissez le token dans votre configuration :

```json
"apiToken": "YOUR_API_TOKEN"
```

### Variable d'environnement

Vous pouvez aussi définir le token globalement pour tous les watchers Satisfactory :

```bash
export SATISFACTORY_API_TOKEN="YOUR_API_TOKEN"
```

## Variables d'environnement (optionnelles)

- `SATISFACTORY_API_TOKEN` : Token utilisé par défaut pour tous les watchers Satisfactory
- `DATA_DIR` : Répertoire contenant config.json (défaut: `/data`)
- `CONFIG_PATH` : Chemin complet vers config.json

## Dépannage

### La connexion est refusée

- Vérifier que le serveur Satisfactory répond sur `https://IP:7777/api/v1/`
- Vérifier les certificats SSL (le manager accepte les auto-signés)

### Erreur d'authentification

- Vérifier le mot de passe admin ou le token API
- Vérifier que les paramètres sont corrects dans la configuration

### Le nombre de joueurs ne s'actualise pas

- Vérifier que le serveur est bien disponible
- Vérifier les logs du manager (`/api/events`)
- Augmenter le timeout si nécessaire

## Exemple complet avec docker-compose

```yaml
version: '3.8'

services:
  satisfactory:
    image: wolveix/satisfactory-server:latest
    container_name: satisfactory-server
    ports:
      - "7777:7777/tcp"
      - "7777:7777/udp"
    environment:
      MAXPLAYERS: "4"
      PGID: "1000"
      PUID: "1000"
    labels:
      autostop.enabled: "true"
      autostop.gamedig_type: "satisfactory"
      autostop.query_host: "192.168.1.100"
      autostop.query_port: "7777"
      autostop.admin_password: "${SATISFACTORY_ADMIN_PASSWORD}"

  autostop-manager:
    image: ghcr.io/example/game-autostop-manager:latest
    container_name: game-autostop-manager
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/data
    environment:
      LABEL_PREFIX: "autostop."
      RESCAN_INTERVAL_SEC: "30"
      SATISFACTORY_API_TOKEN: "${SATISFACTORY_API_TOKEN}"
```
