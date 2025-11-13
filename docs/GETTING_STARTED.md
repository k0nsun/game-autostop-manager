# 🚀 Getting Started

Quick start guide for Game Auto-Stop Manager.

## Before You Start

✅ You have Docker installed
✅ You have Docker daemon running
✅ You know your server's IP address
✅ You have the container name of your game server

## Installation (3 Steps)

### Step 1: Run the Container

**For Unraid:**
```bash
docker run -d \
  --name=game-autostop-manager \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /mnt/user/appdata/game-autostop-manager:/data \
  ghcr.io/your-username/game-autostop-manager:latest
```

**For Docker Compose:**
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
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

### Step 2: Access the Web Interface

Open your browser and go to:
```
http://<your-server-ip>:8080
```

You should see the Game Auto-Stop Manager dashboard.

### Step 3: Add Your First Watcher

1. Click the **➕ Add** button
2. Fill in the form:
   - **Name**: e.g., "My Game Server"
   - **Target Container**: Name of your game server container
   - **Game Type**: Select from dropdown (valheim, minecraft, etc.)
   - **Host/Port**: Auto-filled if Docker container
   - **Inactivity Time**: Minutes before auto-stop (default: 10)
3. Click **Save**

That's it! Your server will now auto-stop after inactivity.

## Common Setup Scenarios

### Scenario 1: Valheim Server

1. Your Valheim container is named: `valheim-server`
2. Server runs on: `192.168.1.100:2456`
3. Add watcher:
   - Name: "Valheim Server"
   - Target Container: `valheim-server`
   - Game Type: `valheim`
   - Host: `192.168.1.100`
   - Port: `2456`
   - Inactivity: `15` minutes

### Scenario 2: Minecraft Server

1. Your Minecraft container is named: `minecraft`
2. Server runs on: `192.168.1.100:25565`
3. Add watcher:
   - Name: "Minecraft Server"
   - Target Container: `minecraft`
   - Game Type: `minecraft`
   - Host: `192.168.1.100`
   - Port: `25565`
   - Inactivity: `20` minutes

### Scenario 3: Satisfactory Server

⚠️ Satisfactory requires special setup!

1. Your Satisfactory container is named: `satisfactory`
2. Server runs on: `192.168.1.100:7777`
3. You have the API token
4. See [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) for detailed instructions

## Verify It's Working

1. Check the **Status** column:
   - 🟢 = Running and connected
   - 🔴 = Stopped
   - ⚠️ = Error (click for details)

2. Check the **Events** tab:
   - Should see polling events every 60 seconds
   - Should show player count updates

3. Check the **Logs** (if enabled):
   - Should see queries being executed
   - Should see player count updates

## Environment Variables (Optional)

If you want to customize behavior, add these to your Docker run command:

```bash
-e ADMIN_TOKEN="your-secret-token"    # Protect UI access
-e NODE_ENV="production"              # Production mode
-e LABEL_PREFIX="autostop."           # Docker label prefix
-e RESCAN_INTERVAL_SEC="300"          # How often to check labels
```

## Next Steps

- 📖 Read the full [README.md](./README.md) for advanced features
- 🎨 Check [DESIGN.md](./DESIGN.md) to understand UI components
- 🏗️ Study [ARCHITECTURE.md](./ARCHITECTURE.md) if you want to develop
- 🎮 See [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) if using Satisfactory

## Troubleshooting

### Can't access the web interface
- Check that port 8080 is not blocked by firewall
- Verify container is running: `docker ps | grep game-autostop`
- Check logs: `docker logs game-autostop-manager`

### Can't find my server
- Container name must be exact (check `docker ps`)
- Server must be reachable on the IP/port you specified
- Try connecting manually to verify connectivity

### Server not stopping automatically
- Check the **Logs** tab for errors
- Verify inactivity time is set correctly
- Check that the container can be accessed

## Uninstall

To remove Game Auto-Stop Manager:

```bash
# Stop and remove the container
docker stop game-autostop-manager
docker rm game-autostop-manager

# Remove the image (optional)
docker rmi ghcr.io/your-username/game-autostop-manager:latest

# Remove data (optional)
rm -rf /mnt/user/appdata/game-autostop-manager
```

## Get Help

- 💬 Check [SATISFACTORY_SETUP.md](./SATISFACTORY_SETUP.md) troubleshooting section
- 📚 Read the full documentation
- 🐛 Check logs in the web interface Events tab

---

Ready? Let's go! 🚀
