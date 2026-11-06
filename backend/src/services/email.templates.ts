// The text of every email MoneyWing sends. Each has a plain-text version and
// a simple branded HTML version. Edit wording here.
import { EmailMessage } from './email.service';

const BLUE = '#004C97';
const ORANGE = '#FC4C02';

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cad = (n: number) => `$${n.toFixed(2)} CAD`;
const ugx = (n: number) => `${Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} UGX`;
const reference = (id: string) => `MW-${id.slice(0, 8).toUpperCase()}`;
const phone = (p: string) => p.replace(/^\+256(\d{3})(\d{3})(\d{3})$/, '+256 $1 $2 $3');

// Wraps content in the MoneyWing email layout.
function layout(title: string, bodyHtml: string): string {
    return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f3f3;font-family:Calibri,Carlito,Arial,sans-serif;color:#000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
        <tr><td style="background:${BLUE};padding:18px 24px;font-size:22px;font-weight:bold">
          <span style="color:#fff">Money</span><span style="color:${ORANGE}">Wing</span>
        </td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;color:#777;font-size:12px">
          You're receiving this because you have a MoneyWing account. If this wasn't you, please contact MoneyWing.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.4">${escapeHtml(text)}</p>`;
const codeBox = (code: string) =>
    `<div style="margin:16px 0;padding:16px;background:#fff1ea;border-radius:12px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px">${escapeHtml(code)}</div>`;
const rows = (pairs: [string, string][]) =>
    `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="margin:8px 0 16px;font-size:15px">${pairs
        .map(([k, v]) => `<tr><td style="color:#777">${escapeHtml(k)}</td><td align="right"><b>${escapeHtml(v)}</b></td></tr>`)
        .join('')}</table>`;

export interface TransferForEmail {
    id: string;
    cadAmount: number;
    fee: number;
    exchangeRate: number;
    ugxAmount: number;
    recipient: { name: string; phoneNumber: string; network: string };
}

const transferRows = (t: TransferForEmail): [string, string][] => [
    ['Reference', reference(t.id)],
    ['Recipient', t.recipient.name],
    ['Mobile money', `${phone(t.recipient.phoneNumber)} (${t.recipient.network})`],
    ['You pay', cad(t.cadAmount)],
    ['Fee (included)', cad(t.fee)],
    ['Exchange rate', `1 CAD = ${ugx(t.exchangeRate)}`],
    ['They receive', ugx(t.ugxAmount)],
];
const rowsText = (pairs: [string, string][]) => pairs.map(([k, v]) => `${k}: ${v}`).join('\n');

// ---------- Account ----------

export const verificationCodeEmail = (to: string, code: string): EmailMessage => ({
    to,
    subject: `Your MoneyWing code: ${code}`,
    text: `Your MoneyWing verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't create a MoneyWing account, you can ignore this email.`,
    html: layout('Confirm your email', p('Enter this code in the app to finish creating your account:') + codeBox(code) + p('It expires in 10 minutes. If you didn\'t create a MoneyWing account, you can ignore this email.')),
});

export const passwordResetCodeEmail = (to: string, code: string): EmailMessage => ({
    to,
    subject: `Your MoneyWing password reset code: ${code}`,
    text: `Someone asked to reset your MoneyWing password. Your code is ${code}.\n\nIt expires in 10 minutes. If this wasn't you, ignore this email: your password won't change.`,
    html: layout('Reset your password', p('Enter this code in the app to choose a new password:') + codeBox(code) + p('It expires in 10 minutes. If this wasn\'t you, ignore this email: your password won\'t change.')),
});

export const passwordChangedEmail = (to: string): EmailMessage => ({
    to,
    subject: 'Your MoneyWing password was changed',
    text: `The password for your MoneyWing account was just changed.\n\nIf this wasn't you, reset your password from the login screen ("Forgot password?") and contact MoneyWing.`,
    html: layout('Password changed', p('The password for your MoneyWing account was just changed.') + p('If this wasn\'t you, reset your password from the login screen ("Forgot password?") and contact MoneyWing.')),
});

export const accountRemovedEmail = (to: string, result: 'deleted' | 'closed'): EmailMessage =>
    result === 'deleted'
        ? {
              to,
              subject: 'Your MoneyWing account was deleted',
              text: 'Your MoneyWing account and its data have been deleted. Thank you for trying MoneyWing.',
              html: layout('Account deleted', p('Your MoneyWing account and its data have been deleted.') + p('Thank you for trying MoneyWing.')),
          }
        : {
              to,
              subject: 'Your MoneyWing account was closed',
              text: 'Your MoneyWing account has been closed and can no longer be used. Records of your past transfers are kept, as required for money transfers.',
              html: layout('Account closed', p('Your MoneyWing account has been closed and can no longer be used.') + p('Records of your past transfers are kept, as required for money transfers.')),
          };

// ---------- Transfers ----------

export const transferCreatedEmail = (to: string, t: TransferForEmail): EmailMessage => ({
    to,
    subject: `Transfer created: ${ugx(t.ugxAmount)} to ${t.recipient.name}`,
    text: `Your transfer has been created and is waiting for payment.\n\n${rowsText(transferRows(t))}`,
    html: layout('Transfer created', p('Your transfer has been created and is waiting for payment.') + rows(transferRows(t))),
});

export const transferDeliveredEmail = (to: string, t: TransferForEmail, payoutRef?: string | null): EmailMessage => {
    const pairs: [string, string][] = [...transferRows(t), ...(payoutRef ? [['Mobile money reference', payoutRef] as [string, string]] : [])];
    return {
        to,
        subject: `Delivered: ${ugx(t.ugxAmount)} to ${t.recipient.name}`,
        text: `Good news: ${t.recipient.name} has received ${ugx(t.ugxAmount)}.\n\n${rowsText(pairs)}`,
        html: layout('Money delivered', p(`Good news: ${t.recipient.name} has received ${ugx(t.ugxAmount)}.`) + rows(pairs)),
    };
};

export const transferFailedEmail = (to: string, t: TransferForEmail, reason?: string): EmailMessage => ({
    to,
    subject: `Problem with your transfer to ${t.recipient.name}`,
    text: `We couldn't deliver your transfer to ${t.recipient.name} yet.${reason ? `\n\nReason: ${reason}` : ''}\n\nWe'll be in touch about next steps.\n\n${rowsText(transferRows(t))}`,
    html: layout(
        'We couldn\'t deliver your transfer yet',
        p(`We couldn't deliver your transfer to ${t.recipient.name} yet.`) +
            (reason ? p(`Reason: ${reason}`) : '') +
            p('We\'ll be in touch about next steps.') +
            rows(transferRows(t))
    ),
});

export const transferCancelledEmail = (to: string, t: TransferForEmail): EmailMessage => ({
    to,
    subject: `Transfer cancelled: ${reference(t.id)}`,
    text: `Your transfer ${reference(t.id)} to ${t.recipient.name} was cancelled. You haven't been charged for it.`,
    html: layout('Transfer cancelled', p(`Your transfer ${reference(t.id)} to ${t.recipient.name} was cancelled.`) + p('You haven\'t been charged for it.')),
});
