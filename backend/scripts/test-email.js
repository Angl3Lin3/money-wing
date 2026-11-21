// Checks the email settings in backend/.env and shows how long each step of
// sending takes. Run from the backend folder:
//   node scripts/test-email.js you@example.com
// It sends one short test email to that address. The password is never printed.
require('dotenv').config();
const dns = require('dns').promises;
const nodemailer = require('nodemailer');

const to = process.argv[2];
if (!to) {
  console.log('Usage: node scripts/test-email.js you@example.com');
  process.exit(1);
}
const host = (process.env.SMTP_HOST || '').trim();
if (!host) {
  console.log('SMTP_HOST is empty in backend/.env, so emails are switched off.');
  process.exit(1);
}

const start = Date.now();
const t = () => `${((Date.now() - start) / 1000).toFixed(2)}s`;

(async () => {
  try {
    const v4 = await dns.resolve4(host).catch(() => []);
    console.log(`[${t()}] Looked up ${host}: ${v4.length} normal (IPv4) address(es)`);
    const v6 = await dns.resolve6(host).catch(() => []);
    console.log(`[${t()}] ${v6.length} newer (IPv6) address(es)`);

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      logger: {
        // Prints nodemailer's own step messages with a timer, no passwords.
        info: (_e, msg, ...a) => console.log(`[${t()}]`, require('util').format(msg, ...a)),
        debug: () => {},
        error: (_e, msg, ...a) => console.log(`[${t()}] ERROR`, require('util').format(msg, ...a)),
        warn: (_e, msg, ...a) => console.log(`[${t()}] WARN`, require('util').format(msg, ...a)),
        trace: () => {}, fatal: () => {}, level: () => {},
      },
    });

    await transporter.verify();
    console.log(`[${t()}] Connected and logged in to ${host}`);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: 'MoneyWing email test',
      text: 'This is a test email from the MoneyWing setup check.',
    });
    console.log(`[${t()}] Test email sent to ${to}. Total time: ${t()}`);
  } catch (e) {
    console.log(`[${t()}] Failed: ${e.message}`);
    process.exit(1);
  }
})();
