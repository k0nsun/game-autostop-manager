# Game Auto-Stop Manager 🎮⏹️

> Automatically stop game server containers after inactivity. Perfect for Unraid and Docker-based deployments.

Un seul conteneur Docker qui pilote vos conteneurs de jeux et **arrête** chaque serveur après `X` minutes sans joueur, configurable via une **UI Web** moderne.

## 📚 Documentation

**👉 [Start with the docs/ folder →](./docs/)**

All documentation is now in the `docs/` folder for better organization:

| Document | Purpose |
|----------|---------|
| **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)** | ⚡ Get started in 3 steps |
| **[docs/UNRAID_INSTALL.md](./docs/UNRAID_INSTALL.md)** | 🎮 Complete Unraid install guide (débutant) |
| **[docs/README_FULL.md](./docs/README_FULL.md)** | 📖 Full user guide & deployment |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | 🏗️ Code structure & modules |
| **[docs/DESIGN.md](./docs/DESIGN.md)** | 🎨 UI/UX design system |
| **[docs/SATISFACTORY_SETUP.md](./docs/SATISFACTORY_SETUP.md)** | 🎮 Satisfactory configuration |
| **[docs/INDEX.md](./docs/INDEX.md)** | 🗺️ Documentation navigation |

## ✨ Quick Features

- � **Multi-game support**: Valheim, Minecraft, Satisfactory, and 70+ more
- 🌐 **Modern UI**: Dark theme, responsive design, real-time logs
- 🔍 **Smart polling**: GameDig for standard games, HTTPS API for Satisfactory
- � **Docker-native**: Full Docker integration via `/var/run/docker.sock`
- ⚙️ **Configuration**: Web UI, Docker labels, or JSON config
- 🏷️ **Auto-sync**: Automatic label detection and configuration
- 🔐 **Optional auth**: Bearer token protection (ADMIN_TOKEN)

## 🚀 Quick Start

### 3 Steps to Run

1. **Start the container**:
```bash
docker run -d \
  --name=game-autostop-manager \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v game-autostop-data:/data \
  ghcr.io/your-username/game-autostop-manager:latest
```

2. **Open the web interface**:
```
http://localhost:8080
```

3. **Add your first watcher**:
   - Fill the form with your game server details
   - Click "Add Watcher"
   - Done! 🎉

**→ [Detailed setup guide](./docs/GETTING_STARTED.md)**

## 📦 What's Inside

### Architecture
```
src/
├── manager.js           # Orchestration (230 lines)
├── storage.js           # Config persistence (50 lines)
├── docker.js            # Docker operations (190 lines)
├── watcher-polling.js   # Game polling (190 lines)
└── providers/
    └── satisfactory.js  # Satisfactory API (130 lines)
```

### Technologies
- **Backend**: Node.js 18+, Express.js, dockerode
- **Frontend**: Vanilla JavaScript, modern CSS (dark theme)
- **Docker**: Multi-stage build, efficient image
- **Monitoring**: GameDig + custom HTTPS API

### Supported Games
✅ Valheim  
✅ V Rising  
✅ Minecraft  
✅ 7 Days to Die  
✅ Satisfactory  
✅ Steam A2S (protocol-valve)  
✅ 70+ more via GameDig  

## 📖 Documentation

All documentation is organized in the `docs/` folder:

- **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)** - Quick 3-step setup ⚡
- **[docs/UNRAID_INSTALL.md](./docs/UNRAID_INSTALL.md)** - Complete Unraid guide for beginners 🎮
- **[docs/README_FULL.md](./docs/README_FULL.md)** - Complete user guide
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Technical design
- **[docs/DESIGN.md](./docs/DESIGN.md)** - UI/UX specifications
- **[docs/SATISFACTORY_SETUP.md](./docs/SATISFACTORY_SETUP.md)** - Satisfactory guide
- **[docs/INDEX.md](./docs/INDEX.md)** - Documentation navigator

## 🔧 For Developers

### Local Development
```bash
npm install
npm start         # Run server
npm run dev       # Watch mode
```

### Review Code
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Module breakdown
- [docs/DESIGN.md](./docs/DESIGN.md) - UI/UX system
- Source code is well-commented

## 🤝 Contributing

Contributions welcome! Please:

1. Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) to understand module structure
2. Review [docs/DESIGN.md](./docs/DESIGN.md) for UI standards
3. Keep modules separated by concern
4. Add comments to complex logic
5. Test before submitting

## 📋 Project Structure

```
game-autostop-manager/
├── docs/                           # 📚 Documentation (organized)
│   ├── README.md
│   ├── GETTING_STARTED.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── SATISFACTORY_SETUP.md
│   └── INDEX.md
├── src/                            # � Backend code
│   ├── manager.js
│   ├── storage.js
│   ├── docker.js
│   ├── watcher-polling.js
│   └── providers/satisfactory.js
├── public/                         # 🎨 Frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/                           # 📦 Config (mounted volume)
│   └── config.json
├── server.js                       # 🚀 Express API
├── package.json                    # � Dependencies
├── Dockerfile                      # 🐳 Docker build
├── LICENSE                         # ⚖️ MIT
└── README.md                       # 👈 This file
```

## 🔐 Security

- ✅ Bearer token authentication (optional via `ADMIN_TOKEN`)
- ✅ HTTPS for Satisfactory API (auto-signed certs accepted)
- ✅ No password storage (tokens/API keys only)
- ✅ Logs protected by authentication

## � License

MIT License - See [LICENSE](./LICENSE) for details

## 📞 Support

- 📖 Read the docs in `docs/`
- 🐛 Check troubleshooting in [docs/SATISFACTORY_SETUP.md](./docs/SATISFACTORY_SETUP.md#dépannage)
- 💬 Open an issue on GitHub

---

## 🎯 Next Steps

- **New user?** → [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) (3 steps!)
- **Want details?** → [docs/README_FULL.md](./docs/README_FULL.md)
- **Exploring code?** → [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Styling changes?** → [docs/DESIGN.md](./docs/DESIGN.md)
- **Satisfactory user?** → [docs/SATISFACTORY_SETUP.md](./docs/SATISFACTORY_SETUP.md)
- **Navigation help?** → [docs/INDEX.md](./docs/INDEX.md)

---

Made with ❤️ for Unraid enthusiasts and game server administrators.
