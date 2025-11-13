# 📖 Documentation Navigation Index

Welcome to the Game Auto-Stop Manager documentation! This guide will help you navigate all available resources.

## 🎯 Quick Navigation

### For Users
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Get started in 3 steps!
- **[README_FULL.md](./README_FULL.md)** - Features, deployment, usage

### For Developers
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Code structure, module breakdown, technical design
- **[DESIGN.md](./DESIGN.md)** - UI/UX design, styling, components, accessibility

### For Game Operators
- **[SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md)** - Satisfactory configuration guide

---

## 📄 Document Details

### 1. GETTING_STARTED.md
**Purpose**: Get up and running in 3 steps

**Contains**:
- Installation instructions
- Common setup scenarios
- Verification steps
- Troubleshooting
- Environment variables

**Best for**: "I want to start using this right now"

---

### 2. README_FULL.md
**Purpose**: Main entry point for users and operators

**Contains**:
- ✅ Feature overview
- ✅ Quick start guide (Unraid, Docker Compose, local dev)
- ✅ Usage instructions (web UI, Docker labels)
- ✅ Architecture overview
- ✅ Technologies used
- ✅ Configuration examples
- ✅ Deployment instructions

**Best for**: Getting started, understanding features, deployment

**Key Sections**:
- Features ✨
- Quick Start 🚀
- Usage 🎮
- Architecture 🏗️
- Configuration 📝
- Deployment 🚢

---

### 3. ARCHITECTURE.md
**Purpose**: Technical documentation for developers

**Contains**:
- ✅ Module breakdown (storage.js, docker.js, watcher-polling.js, manager.js)
- ✅ Module responsibilities and exports
- ✅ Dependency graph
- ✅ Code size metrics
- ✅ Benefits of modularization
- ✅ Refactoring stages completed
- ✅ Future enhancement ideas

**Best for**: Understanding code structure, making changes, contributing

**Module Details**:
- `storage.js` (~50 lines) - Config I/O with atomic writes
- `docker.js` (~190 lines) - Container operations
- `watcher-polling.js` (~190 lines) - Game polling + lifecycle
- `manager.js` (~230 lines) - Orchestration hub
- `satisfactory.js` (~130 lines) - Satisfactory API provider

**Dependency Graph**:
```
server.js
  └── manager.js (WatchManager)
       ├── storage.js
       ├── docker.js
       ├── watcher-polling.js
       └── satisfactory.js
```

---

### 4. DESIGN.md
**Purpose**: UI/UX and visual design documentation

**Contains**:
- ✅ Color scheme (dark theme)
- ✅ Typography and spacing system
- ✅ Component enhancements (buttons, forms, tables, modals)
- ✅ Micro-interactions and animations
- ✅ Responsive breakpoints
- ✅ Accessibility features (WCAG AA)
- ✅ Custom scrollbars
- ✅ CSS custom properties reference
- ✅ Browser support
- ✅ Future enhancements

**Best for**: UI/UX decisions, styling updates, accessibility

**Key Features**:
- 🌙 Dark theme (`#0f1419` - `#16202b`)
- 🎯 Modern blue accent (`#3b82f6`)
- ⚡ Smooth transitions (200ms cubic-bezier)
- 📱 Mobile responsive (breakpoints: 1024px, 768px, 480px)
- ♿ WCAG AA accessibility
- 🎮 Emoji icons for visual clarity

**Responsive Design**:
- Desktop: Two-column grid
- Tablet: Single column, adjusted spacing
- Mobile: Full width, stacked buttons

---

### 5. SATISFACTORY_SETUP.md
**Purpose**: Satisfactory-specific configuration guide

**Contains**:
- ✅ Why Satisfactory needs special handling (HTTPS, port 7777)
- ✅ How to get the API token
- ✅ Configuration in web UI vs Docker labels
- ✅ Required fields for Satisfactory watchers
- ✅ Troubleshooting tips
- ✅ Example configurations

**Best for**: Satisfactory server operators

**Key Info**:
- Port: 7777 (HTTPS)
- Auth: API token (not password)
- Config fields: `host`, `port`, `apiToken`
- Docker labels: `autostop.api_token`, `autostop.query_host`, `autostop.query_port`

---

## 🗺️ How to Use This Documentation

### "I want to deploy the application"
1. Read [GETTING_STARTED.md](./GETTING_STARTED.md) - 3-step setup
2. Or [README.md](./README.md) - Comprehensive quick start
3. Refer to [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) if setting up Satisfactory

### "I want to understand the code"
1. Start with [README.md](./README.md) - Overview
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Module structure
3. Look at the actual code files in `../src/`

### "I want to modify the UI/styling"
1. Read [DESIGN.md](./DESIGN.md) - Full design system
2. Check CSS variables in `../public/style.css`
3. Refer to responsive breakpoints for mobile support

### "I'm setting up Satisfactory"
1. Read [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) completely
2. Get API token from your Satisfactory server
3. Configure watcher in web UI or via Docker labels

### "I want to contribute"
1. Read [README.md](./README.md) - Technologies section
2. Study [ARCHITECTURE.md](./ARCHITECTURE.md) - Module breakdown
3. Review [DESIGN.md](./DESIGN.md) - UI standards
4. Ensure code follows module separation of concerns

---

## 📊 Documentation Statistics

| Document | Lines | Focus | Audience |
|----------|-------|-------|----------|
| GETTING_STARTED.md | ~150 | Quick setup | New users |
| README.md | ~280 | Features, deployment | Everyone |
| ARCHITECTURE.md | ~280 | Code structure | Developers |
| DESIGN.md | ~450 | UI/UX, styling | Designers, frontend |
| SATISFACTORY_SETUP.md | ~150 | Satisfactory config | Satisfactory ops |
| **Total** | **~1,310** | **Complete coverage** | **All roles** |

---

## 🔄 Documentation Relationships

```
GETTING_STARTED.md (Quick entry)
├── For 3-minute setup
└── Mentions README.md for more

README.md (Main entry point)
├── For users → SATISFACTORY_SETUP.md
├── For developers → ARCHITECTURE.md
└── For designers → DESIGN.md

ARCHITECTURE.md (Code structure)
├── References ../src/manager.js, docker.js, etc.
└── Links to DESIGN.md for UI concerns

DESIGN.md (UI/UX system)
├── Explains ../public/style.css
└── References ../public/index.html

SATISFACTORY_SETUP.md (Game-specific)
└── Referenced from README.md
```

---

## 🔍 Finding Information

### By Topic

**Deployment**
- GETTING_STARTED.md → Complete 3-step guide
- README.md → Lancement (Unraid), Docker Compose sections
- Check Docker volumes and environment variables

**Configuration**
- README.md → Configuration section
- SATISFACTORY_SETUP.md → For Satisfactory specifically
- Check config.json example format

**API Integration**
- ARCHITECTURE.md → manager.js, watcher-polling.js modules
- SATISFACTORY_SETUP.md → API token information

**UI/UX**
- DESIGN.md → Complete UI documentation
- README.md → Screenshots/visual reference

**Troubleshooting**
- SATISFACTORY_SETUP.md → Troubleshooting section
- ARCHITECTURE.md → Module dependencies
- GETTING_STARTED.md → Common issues

---

## 💡 Tips for Different Roles

### System Administrator (Unraid)
1. Start with GETTING_STARTED.md (3 steps!)
2. Or README.md for comprehensive guide
3. Configure watchers via web UI
4. Reference SATISFACTORY_SETUP.md if using Satisfactory
5. Monitor logs via Events panel

### Developer (Backend)
1. Read ARCHITECTURE.md thoroughly
2. Understand module separation in ../src/
3. Review manager.js for orchestration
4. Check storage.js for config persistence

### Frontend Developer
1. Study DESIGN.md color system and components
2. Review ../public/style.css for CSS variables
3. Check ../public/app.js for form management
4. Test responsive breakpoints (1024px, 768px, 480px)

### Game Server Operator
1. Read README.md usage section
2. Follow SATISFACTORY_SETUP.md for your game
3. Configure via web UI (easy way)
4. Or use Docker labels (advanced)

---

## 🚀 Next Steps

- **Getting Started?** → [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Deploying?** → GETTING_STARTED.md + README.md Quick Start + Deployment sections
- **Coding?** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Styling?** → [DESIGN.md](./DESIGN.md)
- **Satisfactory?** → [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md)
- **Overview?** → [README.md](./README.md)

---

**Last Updated**: November 13, 2025  
**Status**: Complete ✅  
**Coverage**: All aspects of the application
