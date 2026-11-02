#!/bin/bash
# One-time local database setup for MoneyWing.
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
else
  echo "ℹ️  Database 'moneywing' already exists, reusing it"
fi

echo "Creating tables..."
npx prisma migrate dev --name init

echo ""
echo "✅ Database ready. Start the server with:  npm run dev"
