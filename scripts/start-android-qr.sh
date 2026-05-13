#!/usr/bin/env bash
set -e

BACKEND_PORT="${1:-4000}"
METRO_PORT="${2:-8081}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/app/resqher-mobile"
BACKEND_DIR="$REPO_ROOT/backend"
MOBILE_ENV_PATH="$MOBILE_DIR/.env"

echo "=== ResQher Android QR Launcher ==="
echo "Repository: $REPO_ROOT"

# Free ports
stop_port() {
  local port="$1"
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Stopping process $pid on port $port..."
    kill -9 $pid 2>/dev/null || true
  else
    echo "Port $port is free."
  fi
}

stop_port "$BACKEND_PORT"
stop_port "$METRO_PORT"

# Clear Expo/Metro cache
echo "Clearing Expo and Metro caches..."
rm -rf "$MOBILE_DIR/.expo" "$MOBILE_DIR/node_modules/.cache"
find /tmp -maxdepth 1 \( -name 'metro-*' -o -name 'haste-map-*' -o -name 'react-native-packager-cache-*' \) -exec rm -rf {} + 2>/dev/null || true

# Detect LAN IP
get_lan_ip() {
  ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}'
}
LAN_IP=$(get_lan_ip)
LAN_IP="${LAN_IP:-127.0.0.1}"
API_URL="http://${LAN_IP}:${BACKEND_PORT}"

# Write EXPO_PUBLIC_API_URL to .env (handles BOM, deduplicates)
update_env() {
  local line="EXPO_PUBLIC_API_URL=$API_URL"
  python3 - <<PYEOF
import os, sys
path = "$MOBILE_ENV_PATH"
new_line = "$line"
if not os.path.exists(path):
    with open(path, 'w') as f:
        f.write(new_line + '\n')
    print("Created .env with API URL: $API_URL")
    sys.exit(0)
with open(path, 'rb') as f:
    raw = f.read().lstrip(b'\xef\xbb\xbf')
lines = raw.decode('utf-8').splitlines()
lines = [l for l in lines if l.strip() and not l.startswith('EXPO_PUBLIC_API_URL=')]
lines.append(new_line)
with open(path, 'w', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print("Updated EXPO_PUBLIC_API_URL to $API_URL")
PYEOF
}
update_env

# Start backend in a new terminal (gnome-terminal, xterm, or background)
echo "Starting backend..."
if command -v gnome-terminal &>/dev/null; then
  gnome-terminal -- bash -c "cd '$BACKEND_DIR' && npm run dev; exec bash" &
elif command -v xterm &>/dev/null; then
  xterm -e "cd '$BACKEND_DIR' && npm run dev" &
else
  # Fallback: run in background and log to file
  ( cd "$BACKEND_DIR" && npm run dev ) > /tmp/resqher-backend.log 2>&1 &
  echo "Backend running in background (log: /tmp/resqher-backend.log)"
fi

# Wait for backend health
HEALTH_URL="$API_URL/api/health"
echo "Waiting for backend at $HEALTH_URL..."
TIMEOUT=25
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -sf "$HEALTH_URL" -o /dev/null 2>/dev/null; then
    echo "Backend is reachable at $HEALTH_URL"
    break
  fi
  sleep 0.7
  ELAPSED=$((ELAPSED + 1))
done
if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "Warning: Backend health check did not pass yet. Expo will still start."
fi

# Fix Expo package versions
echo "Fixing Expo package versions..."
cd "$MOBILE_DIR"
npx expo install --fix

# Start Expo
echo "Starting Expo (QR in this terminal)..."
npx expo start --clear
