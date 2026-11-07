// Search and filter transfers for the developer area, and turn them into a
// spreadsheet (CSV) for bookkeeping.
import { Prisma, TransactionStatus } from '@prisma/client';

export class SearchError extends Error {}

export interface TransferFilters {
    q?: string;              // reference, email, recipient name/phone, payout reference
    status?: TransactionStatus;
    from?: Date;             // created at or after
    to?: Date;               // created before
}

// Reads filters from the query string. Throws SearchError on bad input.
export function parseFilters(query: Record<string, unknown>): TransferFilters {
    const filters: TransferFilters = {};

    const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
    if (q) filters.q = q;

    if (typeof query.status === 'string' && query.status) {
        if (!Object.values(TransactionStatus).includes(query.status as TransactionStatus)) {
            throw new SearchError('Unknown status');
        }
        filters.status = query.status as TransactionStatus;
    }

    for (const key of ['from', 'to'] as const) {
        const raw = query[key];
        if (typeof raw === 'string' && raw) {
            const date = new Date(raw);
            if (isNaN(date.getTime())) throw new SearchError(`Invalid "${key}" date`);
            filters[key] = date;
        }
    }
    if (filters.from && filters.to && filters.from >= filters.to) {
        throw new SearchError('The start date must be before the end date');
    }
    return filters;
}

// "Load more": everything after the last transfer shown. Uses the id as a
// tie-breaker so transfers created at exactly the same moment are never skipped.
export function afterCursor(query: Record<string, unknown>): Prisma.TransactionWhereInput | null {
    const raw = typeof query.before === 'string' ? query.before : '';
    if (!raw) return null;
    const before = new Date(raw);
    if (isNaN(before.getTime())) throw new SearchError('Invalid "before" date');
    const beforeId = typeof query.beforeId === 'string' ? query.beforeId : '';
    return beforeId
        ? { OR: [{ createdAt: { lt: before } }, { createdAt: before, id: { lt: beforeId } }] }
        : { createdAt: { lt: before } };
}

// Newest first, with the id breaking ties (must match afterCursor).
export const newestFirst: Prisma.TransactionOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

// Builds the database query for the filters.
export function buildWhere(f: TransferFilters): Prisma.TransactionWhereInput {
    const and: Prisma.TransactionWhereInput[] = [];
    if (f.status) and.push({ status: f.status });
    if (f.from || f.to) and.push({ createdAt: { ...(f.from && { gte: f.from }), ...(f.to && { lt: f.to }) } });

    if (f.q) {
        const text = f.q;
        const or: Prisma.TransactionWhereInput[] = [
            { user: { email: { contains: text, mode: 'insensitive' } } },
            { recipient: { name: { contains: text, mode: 'insensitive' } } },
            { providerPayoutRef: { contains: text, mode: 'insensitive' } },
        ];
        // Reference: "MW-3F2A9C1B" is the start of the transfer's id.
        const ref = text.replace(/^mw-?/i, '').toLowerCase();
        if (/^[0-9a-f-]{4,36}$/.test(ref)) or.push({ id: { startsWith: ref } });
        // Phone: match the digits, ignoring spaces and a leading 0 or +256.
        const digits = text.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '');
        if (digits.length >= 3) or.push({ recipient: { phoneNumber: { contains: digits } } });
        and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
}

export const transferSelect = {
    id: true,
    cadAmountCents: true,
    feeCents: true,
    exchangeRate: true,
    ugxAmount: true,
    status: true,
    provider: true,
    stripePaymentId: true,
    providerPayoutRef: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { email: true } },
    recipient: { select: { name: true, phoneNumber: true, network: true } },
} satisfies Prisma.TransactionSelect;

export type SelectedTransfer = Prisma.TransactionGetPayload<{ select: typeof transferSelect }>;

// ---------- Spreadsheet (CSV) ----------

// Dates in the business's time zone, in a format spreadsheets understand.
const businessTimeZone = () => process.env.BUSINESS_TIMEZONE || 'America/Toronto';
const localTime = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: businessTimeZone(),
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
        .format(d)
        .replace(',', '');

// One CSV cell. Quotes when needed, and stops spreadsheet programs from
// running anything typed by a customer as a formula (e.g. a name "=HYPERLINK(...)").
function cell(value: string | number | null | undefined): string {
    let text = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`; // only free text gets here
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const money = (cents: number) => (cents / 100).toFixed(2);

// "+256701234567" -> "0701 234 567": how it's dialled in Uganda, and the spaces
// make spreadsheets keep it as text (no lost zero, no scientific notation).
const localPhone = (p: string) => p.replace(/^\+256(\d{3})(\d{3})(\d{3})$/, '0$1 $2 $3');

export const CSV_COLUMNS = [
    'Reference', 'Transfer ID', `Created (${'local'})`, 'Status', 'Customer email',
    'Recipient name', 'Recipient phone (Uganda)', 'Network',
    'Customer paid (CAD)', 'Fee (CAD)', 'Converted (CAD)', 'Exchange rate (UGX per CAD)', 'Recipient gets (UGX)',
    'Payout method', 'Mobile money reference', 'Stripe payment ID', `Last updated (${'local'})`,
];

export function toCsv(transfers: SelectedTransfer[]): string {
    const header = CSV_COLUMNS.map((c) => c.replace('local', businessTimeZone())).map(cell).join(',');
    const rows = transfers.map((t) =>
        [
            `MW-${t.id.slice(0, 8).toUpperCase()}`,
            t.id,
            localTime(t.createdAt),
            t.status,
            t.user.email,
            t.recipient.name,
            localPhone(t.recipient.phoneNumber),
            t.recipient.network,
            money(t.cadAmountCents),
            money(t.feeCents),
            money(t.cadAmountCents - t.feeCents),
            t.exchangeRate,
            t.ugxAmount,
            t.provider ?? '',
            t.providerPayoutRef ?? '',
            t.stripePaymentId ?? '',
            localTime(t.updatedAt),
        ]
            .map(cell)
            .join(',')
    );
    // The invisible first character (BOM) makes Excel read accents correctly.
    return '﻿' + [header, ...rows].join('\r\n') + '\r\n';
}
