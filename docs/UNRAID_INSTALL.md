# 🎮 Installation Complète sur Unraid - Guide Débutant

> Ce guide vous explique comment installer Game Auto-Stop Manager sur Unraid, étape par étape, pour un débutant complet.

## 📋 Prérequis

Avant de commencer, assurez-vous que:
- ✅ Vous avez accès à votre Unraid (via navigateur web)
- ✅ Docker est installé sur Unraid (normalement déjà là par défaut)
- ✅ Vous avez au moins 500 MB d'espace disque libre
- ✅ Vous avez les noms exacts de vos conteneurs de jeux

## 🚀 Étape 1: Préparer le Dossier de Configuration

Le dossier "données" stockera la configuration de Game Auto-Stop Manager.

### Sur Unraid (via Terminal ou SSH):

1. **Ouvrez un terminal** sur votre Unraid:
   - Allez sur: `http://<IP-UNRAID>/Terminal`
   - Ou connectez-vous en SSH: `ssh root@<IP-UNRAID>`

2. **Créez le dossier** (copier-coller cette commande):
```bash
mkdir -p /mnt/user/appdata/game-autostop-manager
```

3. **Vérifiez que le dossier est créé**:
```bash
ls -la /mnt/user/appdata/ | grep game-autostop
```

Vous devriez voir: `game-autostop-manager`

✅ **Terminé!** Le dossier est prêt.

---

## 📦 Étape 2: Créer l'Image Docker (Build)

### Première option: Via Git (Recommandé pour les débutants)

1. **Clonez le projet** (copier-coller):
```bash
cd /tmp
git clone https://github.com/k0nsun/game-autostop-manager.git
cd game-autostop-manager
```

2. **Vérifiez que vous êtes au bon endroit**:
```bash
pwd
# Devrait afficher: /tmp/game-autostop-manager

ls
# Devrait afficher: Dockerfile, package.json, README.md, etc.
```

3. **Lancez le build Docker** (cela peut prendre 2-3 minutes):
```bash
docker build -t k0nsun/game-autostop-manager:latest .
```

Vous verrez beaucoup de lignes défiler - c'est normal! ✅

4. **Vérifiez que l'image est créée**:
```bash
docker images | grep game-autostop
```

Vous devriez voir: `k0nsun/game-autostop-manager   latest`

✅ **L'image est prête!**

---

## 🐳 Étape 3: Lancer le Conteneur Docker

Maintenant qu'on a l'image, on la lance!

1. **Lancez le conteneur** (copier-coller):
```bash
docker run -d \
  --name=game-autostop-manager \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /mnt/user/appdata/game-autostop-manager:/data \
  k0nsun/game-autostop-manager:latest
```

2. **Vérifiez que le conteneur tourne**:
```bash
docker ps | grep game-autostop
```

Vous devriez voir une ligne avec `game-autostop-manager` et status `Up` ✅

---

## 🌐 Étape 4: Accéder à l'Interface Web

1. **Ouvrez votre navigateur**
2. **Allez à**: `http://<IP-UNRAID>:8080`
   - Remplacez `<IP-UNRAID>` par votre IP Unraid
   - Exemple: `http://192.168.1.100:8080`

3. **Vous devriez voir** la page Game Auto-Stop Manager avec:
   - Un bouton "➕ Add" en haut
   - Une table vide (pas encore de watchers)
   - Un onglet "📝 Events" et "📊 Activity"

✅ **L'interface fonctionne!**

---

## ⚙️ Étape 5: Configurer Votre Premier Watcher

Un "watcher" = surveillance d'un serveur de jeu pour l'arrêter automatiquement.

### Exemple: Configurer un serveur Valheim

1. **Cliquez sur "➕ Add"** en haut à gauche

2. **Remplissez le formulaire** avec:

| Champ | Exemple | Description |
|-------|---------|-------------|
| **Name** | `Valheim Server` | Nom du serveur (ce que vous voulez) |
| **Target Container** | `valheim` | Nom exact du conteneur (voir note ci-dessous) |
| **Game Type** | `valheim` | Type de jeu (dans la liste déroulante) |
| **Host** | `192.168.1.100` | IP du serveur de jeu |
| **Port** | `2456` | Port du serveur (dépend du jeu) |
| **Inactivity Time** | `15` | Minutes avant arrêt auto (exemple: 15 min) |
| **Check Interval** | `60` | Secondes entre chaque vérification |
| **Stop Timeout** | `60` | Secondes avant forçage de l'arrêt |

3. **Cliquez "Save"** ✅

### 📌 Comment trouver le nom exact du conteneur?

1. **Allez sur Unraid**: `http://<IP-UNRAID>`
2. **Onglet "Docker"**
3. **Cherchez votre conteneur de jeu** (ex: valheim, minecraft, etc.)
4. **Le nom exact** est en haut de la ligne

Ou en terminal:
```bash
docker ps | grep -i valheim
```

---

## ✅ Étape 6: Vérifier que Ça Marche

1. **Allez dans l'onglet "📝 Events"** (en haut à droite)

2. **Vous devriez voir**:
   - Des messages "Polling..." toutes les 60 secondes
   - Le nombre de joueurs connectés
   - Des messages comme "Players: 2/10"

3. **Si vous voyez des erreurs**:
   - Vérifiez le nom du conteneur
   - Vérifiez que l'IP et le port sont corrects
   - Essayez de vous connecter manuellement au serveur

✅ **Si tout fonctionne, c'est bon!**

---

## 🎮 Étape 7: Ajouter Vos Autres Serveurs

Répétez l'Étape 5 pour chaque serveur de jeu que vous avez.

### Ports communs par jeu:

| Jeu | Port | Game Type |
|-----|------|-----------|
| Valheim | 2456 | `valheim` |
| Minecraft | 25565 | `minecraft` |
| V Rising | 9876 | `vrising` |
| 7 Days to Die | 26900 | `7d2d` |
| Satisfactory | 7777 | `satisfactory` |
| **Autre** | À vérifier | À vérifier |

---

## 🔧 Étape 8: Configuration Avancée (Optionnel)

### Ajouter une Protection par Mot de Passe

1. **Arrêtez le conteneur**:
```bash
docker stop game-autostop-manager
```

2. **Relancez-le avec un token**:
```bash
docker run -d \
  --name=game-autostop-manager-new \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /mnt/user/appdata/game-autostop-manager:/data \
  -e ADMIN_TOKEN="votre_token_secret_ici" \
  k0nsun/game-autostop-manager:latest
```

3. **Supprimez l'ancien conteneur**:
```bash
docker rm game-autostop-manager
docker rename game-autostop-manager-new game-autostop-manager
```

Maintenant, vous devez entrer le token dans l'interface web.

---

## 🚨 Dépannage

### "Cannot access the interface"
- ✅ Vérifiez que le port 8080 est libre: `netstat -an | grep 8080`
- ✅ Vérifiez que le conteneur tourne: `docker ps | grep game-autostop`
- ✅ Vérifiez l'IP Unraid: Allez dans Unraid, Settings > Network

### "Server not found / Cannot connect"
- ✅ Vérifiez le nom du conteneur: `docker ps`
- ✅ Vérifiez l'IP du serveur: Ping-le: `ping 192.168.1.100`
- ✅ Vérifiez le port: Essayez `nc -zv 192.168.1.100 2456`

### "Status shows 'Error'"
- ✅ Cliquez sur "Error" pour voir le message complet
- ✅ Vérifiez les **Events** pour plus d'info
- ✅ Vérifiez les logs Docker: `docker logs game-autostop-manager`

---

## 📚 Prochaines Étapes

- 📖 Lire la [README complète](./README_FULL.md) pour les détails techniques
- 🎮 Configurer Satisfactory? Voir [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md)
- ⚙️ Comprendre l'architecture? Voir [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 💡 Conseils

- **Sauvegarder votre config**: Le fichier `/mnt/user/appdata/game-autostop-manager/config.json` contient vos watchers. Faites une sauvegarde!
- **Tester d'abord**: Testez avec une inactivité courte (5 min) avant de monter à 30 min
- **Logs utiles**: Consultez les "Events" dans l'interface pour voir ce qui se passe

---

## 🆘 Besoin d'aide?

1. Vérifiez les **Events** dans l'interface
2. Consultez les **Logs Docker**: `docker logs game-autostop-manager`
3. Lisez le [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) (troubleshooting)
4. Ouvrez une issue sur GitHub

---

**Bravo! Vous avez installé Game Auto-Stop Manager! 🎉**

Vos serveurs vont maintenant s'arrêter automatiquement après inactivité! ⏹️
