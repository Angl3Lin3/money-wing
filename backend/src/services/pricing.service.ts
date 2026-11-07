// Pricing for transfers: exchange rate, fee and send limits, in ONE place.
//
// Where the numbers come from:
//   1. What the owner saved in the developer area (stored in the database), or
//   2. if nothing is saved yet, backend/.env, or
//   3. the defaults below.
//
//   EXCHANGE_RATE_UGX_PER_CAD  how many UGX one CAD buys       (default 2800)
//   FEE_PERCENT                fee as a percent of the amount  (default 2)
//   MIN_SEND_CAD / MAX_SEND_CAD  limits per transfer           (default 5 / 3000)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PRICING_KEY = 'pricing';
const CACHE_MS = 30 * 1000; // re-read the database at most every 30 seconds

export interface Pricing {
    exchangeRate: number;   // UGX per CAD
    feePercent: number;     // e.g. 2 means 2%
    minCad: number;
    maxCad: number;
}

export interface PricingInfo {
    pricing: Pricing;
    source: 'owner' | 'default';
    updatedAt: string | null;
    updatedBy: string | null;
}

export interface Quote {
    cadAmountCents: number; // exact amount in cents (what gets stored)
    feeCents: number;       // exact fee in cents
    cadAmount: number;      // what the customer pays, in CAD
    fee: number;            // MoneyWing's fee, in CAD (taken out of cadAmount)
    exchangeRate: number;   // UGX per CAD
    ugxAmount: number;      // what the recipient receives, in whole UGX
    expiresIn: number;      // seconds the quote is valid for
}

export class QuoteError extends Error {}
export class PricingError extends Error {}

const numberFromEnv = (name: string, fallback: number): number => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const defaultPricing = (): Pricing => ({
    exchangeRate: numberFromEnv('EXCHANGE_RATE_UGX_PER_CAD', 2800),
    feePercent: numberFromEnv('FEE_PERCENT', 2),
    minCad: numberFromEnv('MIN_SEND_CAD', 5),
    maxCad: numberFromEnv('MAX_SEND_CAD', 3000),
});

let cache: { info: PricingInfo; loadedAt: number } | null = null;

export async function getPricingInfo(): Promise<PricingInfo> {
    if (cache && Date.now() - cache.loadedAt < CACHE_MS) return cache.info;

    let info: PricingInfo = { pricing: defaultPricing(), source: 'default', updatedAt: null, updatedBy: null };
    try {
        const row = await prisma.setting.findUnique({ where: { key: PRICING_KEY } });
        if (row) {
            info = {
                pricing: validatePricing(row.value),
                source: 'owner',
                updatedAt: row.updatedAt.toISOString(),
                updatedBy: row.updatedBy,
            };
        }
    } catch (error) {
        // If the saved value can't be read, keep working with the defaults.
        console.error('Could not load saved pricing, using defaults:', error);
    }
    cache = { info, loadedAt: Date.now() };
    return info;
}

export const getPricing = async (): Promise<Pricing> => (await getPricingInfo()).pricing;

// Checks values typed by the owner. Throws PricingError with a readable message.
export function validatePricing(input: unknown): Pricing {
    const data = (input ?? {}) as Record<string, unknown>;
    const num = (key: string, label: string, min: number, max: number, decimals: number) => {
        const value = typeof data[key] === 'string' ? Number(data[key]) : data[key];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new PricingError(`${label} must be a number`);
        }
        if (value < min || value > max) {
            throw new PricingError(`${label} must be between ${min} and ${max}`);
        }
        const factor = 10 ** decimals;
        if (Math.round(value * factor) / factor !== value) {
            throw new PricingError(`${label} can have at most ${decimals} decimal places`);
        }
        return value;
    };

    const pricing: Pricing = {
        exchangeRate: num('exchangeRate', 'Exchange rate', 1, 100000, 4),
        feePercent: num('feePercent', 'Fee', 0, 20, 2),
        minCad: num('minCad', 'Minimum transfer', 1, 100000, 2),
        maxCad: num('maxCad', 'Maximum transfer', 1, 100000, 2),
    };
    if (pricing.minCad >= pricing.maxCad) {
        throw new PricingError('Minimum transfer must be less than the maximum');
    }
    return pricing;
}

// Saves new pricing (after validating it) and returns what was saved.
export async function savePricing(input: unknown, actorEmail: string): Promise<{ before: Pricing; after: Pricing }> {
    const after = validatePricing(input);
    const before = await getPricing();
    await prisma.setting.upsert({
        where: { key: PRICING_KEY },
        create: { key: PRICING_KEY, value: after as any, updatedBy: actorEmail },
        update: { value: after as any, updatedBy: actorEmail },
    });
    cache = null; // use the new numbers straight away
    return { before, after };
}

// Accepts a number or a string like "100" / "100.5" and returns a quote,
// or throws QuoteError with a message that can be shown to the user.
export async function calculateQuote(rawAmount: unknown): Promise<Quote> {
    const text = typeof rawAmount === 'number' ? String(rawAmount) : typeof rawAmount === 'string' ? rawAmount.trim() : '';

    // Digits with at most 2 decimals: no letters, no negatives, no "1e5".
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        throw new QuoteError('Enter an amount in dollars, e.g. 100 or 100.50');
    }

    const { exchangeRate, feePercent, minCad, maxCad } = await getPricing();
    const cadAmount = Number(text);

    if (cadAmount < minCad) throw new QuoteError(`The minimum transfer is $${minCad.toFixed(2)} CAD`);
    if (cadAmount > maxCad) throw new QuoteError(`The maximum transfer is $${maxCad.toFixed(2)} CAD`);

    // Work in whole cents to avoid floating-point rounding errors.
    const amountCents = Math.round(cadAmount * 100);
    const feeCents = Math.round((amountCents * feePercent) / 100);
    const sendCents = amountCents - feeCents;

    return {
        cadAmountCents: amountCents,
        feeCents,
        cadAmount: amountCents / 100,
        fee: feeCents / 100,
        exchangeRate,
        // UGX has no smaller unit, so round down to a whole shilling.
        ugxAmount: Math.floor((sendCents * exchangeRate) / 100),
        expiresIn: 300, // 5 minutes
    };
}
