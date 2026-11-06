#!/bin/bash
# Gets the local database ready. Safe to run any time:
#   - creates the 'moneywing' database if it doesn't exist yet
#   - applies any new table changes (prisma/migrations) that teammates added
#   - refreshes Prisma's generated code to match
# Run from anywhere:  bash ~/Desktop/money-wing/backend/scripts/setup-db.sh
set -e

# Use Postgres.app's tools even if they aren't on your PATH yet.
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
cd "$(dirname "$0")/.."

if ! pg_isready -q; then
  echo "❌ Postgres isn't running. Open Postgres.app (elephant in the menu bar) and try again."
  exit 1
fi

if createdb moneywing 2>/dev/null; then
  echo "✅ Created database 'moneywing'"
fi

echo "▶ Applying database changes ..."
npx prisma migrate deploy
npx prisma generate >/dev/null

echo "✅ Database ready."
