# Game Auto-Stop Manager (Unraid)

Un seul conteneur Docker qui pilote vos conteneurs de jeux et **arrête** chaque serveur après `X` minutes sans joueur, configurable via une **UI Web** (aucun paramètre à taper dans Unraid).

## Caractéristiques
- Multi-jeux / multi-conteneurs (VRising, Valheim, protocol-valve/Source, Minecraft, etc.)
- UI Web minimale (ajout/édition des watchers, démarrage/arrêt du watcher).
- Test de requête via Gamedig (via API), journal en temps réel (SSE).
- Persistance dans `/data/config.json`.
- Contrôle Docker via `/var/run/docker.sock` (dockerode).
- Auth optionnelle via `ADMIN_TOKEN` (Bearer).

## Lancement (Unraid)
1. Créez un dossier pour la config: `/mnt/user/appdata/game-autostop-manager`.
2. Déployez le conteneur en mappant:
   - Volume: `/var/run/docker.sock:/var/run/docker.sock`
   - Volume: `/mnt/user/appdata/game-autostop-manager:/data`
   - Port: `8080:8080`
   - (Optionnel) Variable: `ADMIN_TOKEN=monsecret`
3. Ouvrez `http://<IP-unraid>:8080`.

## Dockerfile (multi-stage)
Voir `Dockerfile` dans le repo.
