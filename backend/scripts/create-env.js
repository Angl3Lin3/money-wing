// Creates backend/.env the first time the app is started on a Windows
// computer. Called by start-dev.bat:
//   node backend/scripts/create-env.js "<owner email>" "<PostgreSQL password>"
// (On a Mac, start-dev.command does the same job.)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('Settings file already exists. Nothing to do.');
  process.exit(0);
}

const ownerEmail = (process.argv[2] || '').trim().toLowerCase().replace(/["\s]/g, '');
const dbPassword = process.argv[3] || '';
if (!dbPassword) {
  console.error('No PostgreSQL password was entered.');
  process.exit(1);
}

// encodeURIComponent keeps passwords with symbols (@, #, %...) working.
const lines = [
  '# Created automatically by start-dev.bat. See backend/.env.example for all settings.',
  `DATABASE_URL="postgresql://postgres:${encodeURIComponent(dbPassword)}@localhost:5432/moneywing"`,
  `JWT_SECRET="${crypto.randomBytes(32).toString('hex')}"`,
  'PORT=3000',
  'PAYOUT_PROVIDER="mock"',
  `ADMIN_EMAILS="${ownerEmail}"`,
  '',
];
fs.writeFileSync(envPath, lines.join('\n'));
console.log('Settings file created.');
