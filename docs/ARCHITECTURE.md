# Architecture Overview

## Modularization Complete ✅

The `game-autostop-manager` has been refactored into a modular architecture for better maintainability and testability.

### Module Breakdown

#### 1. **storage.js** (~50 lines)
**Responsibility:** Configuration persistence

**Exported Functions:**
- `loadConfig(configPath)` - Load and normalize watcher config from disk
- `saveConfig(configPath, config)` - Atomically persist config (temp file → rename)

**Features:**
- Atomic writes to prevent partial file corruption
- Automatic normalization of legacy data (defaults for autostart, watchers array)
- Error resilience (returns empty config on failure)

#### 2. **docker.js** (~190 lines)
**Responsibility:** Docker container operations

**Exported Functions:**
- `getContainer(docker, ref)` - Get container by name/ID (null if not found)
- `isRunning(container)` - Check if container state is Running
- `stopGracefully(container, stopTimeoutSec, emitEvent)` - Stop with timeout
- `resolveContainerIPWithCache(docker, containerName, ipCache, cacheTTL, emitEvent)` - Get container IP with caching
- `listDockerContainers(docker)` - List all containers with metadata
- `containerAction(docker, idOrName, action)` - Execute container action (start/stop)

**Features:**
- IP resolution caching (5 min default TTL) to minimize Docker API calls
- Graceful error handling with event emission
- Consistent container reference handling

#### 3. **watcher-polling.js** (~190 lines)
**Responsibility:** Game server polling and lifecycle management

**Exported Functions:**
- `tickOne(watcher, container, watchers, docker, resolveContainerIPWithCache, stopGracefully, emitEvent)` - Single polling iteration
- `startWatcher(watcher, watchers, docker, getContainer, resolveContainerIPWithCache, stopGracefully, emitEvent)` - Start periodic polling
- `stopWatcher(id, watchers)` - Stop polling for a watcher
- `stopAllWatchers(watchers)` - Stop all active watchers

**Features:**
- Type-specific polling: GameDig for standard games, custom HTTPS API for Satisfactory
- Inactivity tracking with automatic server shutdown
- Graceful failure handling (query errors don't penalize inactivity counter)
- Immediate first poll on start, then interval-based

#### 4. **manager.js** (~230 lines) - **ORCHESTRATION HUB**
**Responsibility:** Coordination, CRUD operations, label sync, pub/sub

**Key Methods:**
- **Configuration:** `load()`, `save()` (delegates to storage.js)
- **CRUD:** `list()`, `create()`, `update()`, `remove()`, `autostart()`, `validate()`
- **Docker:** `getContainer()`, `isRunning()`, `stopGracefully()`, `resolveContainerIPWithCache()`, `listDockerContainers()`, `containerAction()` (all delegate to docker.js)
- **Polling:** `tickOne()`, `startWatcher()`, `stopWatcher()`, `stopAllWatchers()` (all delegate to watcher-polling.js)
- **Labels:** `syncFromDockerLabels()`, `scheduleRescan()`
- **Pub/Sub:** `subscribe()`, `emit()`

**Architecture:**
- Maintains state maps: `watchers` (runtime), `config` (persisted), `listeners` (pub/sub)
- Acts as glue layer between modules
- Provides high-level API for server.js

#### 5. **server.js** (~206 lines)
**Responsibility:** Express REST API

**Imports:** `WatchManager` from `manager.js`

**No changes required** - All internal manager.js methods maintain same signatures
Public API unchanged:
- `GET /api/watchers` - List watchers
- `POST /api/watchers` - Create watcher
- `PUT /api/watchers/:id` - Update watcher
- `DELETE /api/watchers/:id` - Delete watcher
- `POST /api/watchers/:id/start` - Start watcher
- `POST /api/watchers/:id/stop` - Stop watcher
- `GET /api/events` - SSE stream of events
- `GET /health` - Health check

---

## Module Dependency Graph

```
server.js
  └── manager.js (WatchManager)
       ├── storage.js (loadConfig, saveConfig)
       ├── docker.js (getContainer, isRunning, stopGracefully, ...)
       ├── watcher-polling.js (tickOne, startWatcher, stopWatcher, ...)
       └── satisfactory.js (pollSatisfactory) [unchanged]
```

## Code Size Reduction

| File | Before | After | Δ |
|------|--------|-------|---|
| manager.js | 593 lines | 230 lines | -363 lines |
| storage.js | - | 50 lines | +50 lines |
| docker.js | - | 190 lines | +190 lines |
| watcher-polling.js | - | 190 lines | +190 lines |
| **Total modules** | 593 | 660 | +67 lines |

*Note: Manager.js is now more maintainable despite module overhead due to clear separation of concerns and improved testability.*

## Benefits

✅ **Single Responsibility** - Each module has one clear purpose
✅ **Testability** - Modules can be unit tested independently
✅ **Reusability** - Modules can be imported and used elsewhere
✅ **Maintainability** - Changes to one concern don't affect others
✅ **Readability** - ~230 line orchestrator is easier to understand than ~600 line monolith
✅ **No Breaking Changes** - Public API (WatchManager class) remains unchanged

## Refactoring Stages

1. ✅ Extract storage concerns → `storage.js`
2. ✅ Extract Docker concerns → `docker.js`
3. ✅ Extract polling concerns → `watcher-polling.js`
4. ✅ Refactor manager.js to use modules
5. ✅ Verify server.js still works (imports unchanged)

## Running the Application

No changes to startup:
```bash
npm start           # Production
npm run dev         # Development
```

All existing configuration and environment variables work unchanged.

## Future Enhancements

With this modular structure, it's now easier to:
- Add new polling providers (create `providers/*.js` and import in watcher-polling.js)
- Mock dependencies for unit testing
- Implement persistence layers (swap storage.js)
- Add Docker compose or Kubernetes support (enhance docker.js)
- Create CLI tools using individual modules
