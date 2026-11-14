#!/bin/bash
# Double-click this file in Finder to start MoneyWing for local development.
# It sets up the database the first time, starts the backend, then the app.
# Close this window (or press Ctrl+C) to stop everything.

cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

if ! pg_isready -q 2>/dev/null; then
  echo "❌ Postgres isn't running. Open Postgres.app, then double-click this file again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

# Install packages when package.json changed (e.g. a new step added one).
for dir in backend frontend; do
  if [ ! -d "$dir/node_modules" ] || [ "$dir/package.json" -nt "$dir/node_modules/.package-lock.json" ]; then
    echo "▶ Installing packages in $dir ..."
    (cd "$dir" && npm install) || { read -n 1 -s -r -p "npm install failed. Press any key to close..."; exit 1; }
  fi
done

# Create the database if needed and apply any new table changes.
bash backend/scripts/setup-db.sh || { read -n 1 -s -r -p "Database setup failed. Press any key to close..."; exit 1; }

echo "▶ Starting backend on http://localhost:3000 ..."
(cd backend && npm run dev) &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT

sleep 3
echo "▶ Starting app (opens in your browser) ..."
echo "   Signup codes appear below as a 💸 line."
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
if [ -n "$LAN_IP" ]; then
  echo "   📱 To test on a phone: join the same Wi-Fi as this Mac, open Expo Go"
  echo "      (iPhone: use the Camera app) and scan the QR code below."
  echo "      The phone will talk to the backend at http://$LAN_IP:3000"
fi
cd frontend && npx expo start --web
