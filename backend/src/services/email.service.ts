// Sends emails to customers.
//
// Two modes, chosen by backend/.env:
//   - SMTP_HOST is set  -> emails are really sent through that email service
//     (Gmail, Outlook, Resend, Mailtrap, SendGrid... any SMTP service).
//   - SMTP_HOST is empty -> nothing is sent. Each email is printed in the
//     server window and kept in memory so the developer area's Emails tab can
//     show it. Handy while developing: you can read codes without a real inbox.
import nodemailer, { Transporter } from 'nodemailer';

export interface EmailMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export interface OutboxEntry {
    id: number;
    time: string;
    to: string;
    subject: string;
    status: 'sent' | 'failed' | 'not sent (no email service)';
    error?: string;
    text?: string; // only kept when no email service is set up
}

const MAX_OUTBOX = 50;
const outbox: OutboxEntry[] = [];
let nextId = 1;

let transporter: Transporter | null = null;
let transporterKey = '';

const smtpConfig = () => ({
    host: process.env.SMTP_HOST?.trim() ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
});

export const isEmailConfigured = () => Boolean(smtpConfig().host);

// What the developer area shows about email setup (never the password).
export const emailSetupSummary = () => {
    const c = smtpConfig();
    return c.host ? `sending through ${c.host}` : 'not set up: emails are shown in the developer area instead';
};

const fromAddress = () => process.env.EMAIL_FROM?.trim() || 'MoneyWing <no-reply@moneywing.local>';

function getTransporter(): Transporter {
    const c = smtpConfig();
    // Rebuild the connection whenever any setting changes (password included).
    const key = JSON.stringify(c);
    if (!transporter || key !== transporterKey) {
        transporter = nodemailer.createTransport({
            host: c.host,
            port: c.port,
            secure: c.secure,
            ...(c.user && { auth: { user: c.user, pass: c.pass } }),
        });
        transporterKey = key;
    }
    return transporter;
}

const record = (entry: Omit<OutboxEntry, 'id' | 'time'>) => {
    outbox.unshift({ id: nextId++, time: new Date().toISOString(), ...entry });
    if (outbox.length > MAX_OUTBOX) outbox.pop();
};

// Sends an email. Throws if a configured email service refuses it, so callers
// that MUST deliver (like login codes) can tell the user.
export async function sendEmail(message: EmailMessage): Promise<void> {
    if (!isEmailConfigured()) {
        console.log(`📧 [email not sent: no SMTP_HOST] To: ${message.to} | ${message.subject}\n${message.text}\n`);
        record({ to: message.to, subject: message.subject, status: 'not sent (no email service)', text: message.text });
        return;
    }

    try {
        await getTransporter().sendMail({ from: fromAddress(), ...message });
        record({ to: message.to, subject: message.subject, status: 'sent' });
    } catch (error: any) {
        record({ to: message.to, subject: message.subject, status: 'failed', error: String(error?.message ?? error).slice(0, 200) });
        console.error(`Email to ${message.to} failed:`, error?.message ?? error);
        throw error;
    }
}

// For notifications that are nice to have: never blocks or breaks the request.
export function sendEmailInBackground(message: EmailMessage): void {
    sendEmail(message).catch(() => {
        /* already logged and recorded */
    });
}

export const getOutbox = () => ({ configured: isEmailConfigured(), setup: emailSetupSummary(), emails: [...outbox] });
