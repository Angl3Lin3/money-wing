// Pricing for transfers: exchange rate, fee and send limits, in ONE place.
//
// Values come from backend/.env so the rate can change without editing code.
// Defaults are used when a value isn't set.
//   EXCHANGE_RATE_UGX_PER_CAD  how many UGX one CAD buys       (default 2800)
//   FEE_PERCENT                fee as a percent of the amount  (default 2)
//   MIN_SEND_CAD / MAX_SEND_CAD  limits per transfer           (default 5 / 3000)
//
// Later the owner will set the rate from an admin screen; only this file
// will need to change.

export interface Quote {
    cadAmount: number;      // what the customer pays, in CAD
    fee: number;            // MoneyWing's fee, in CAD (taken out of cadAmount)
    exchangeRate: number;   // UGX per CAD
    ugxAmount: number;      // what the recipient receives, in whole UGX
    expiresIn: number;      // seconds the quote is valid for
}

const numberFromEnv = (name: string, fallback: number): number => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const getPricing = () => ({
    exchangeRate: numberFromEnv('EXCHANGE_RATE_UGX_PER_CAD', 2800),
    feePercent: numberFromEnv('FEE_PERCENT', 2),
    minCad: numberFromEnv('MIN_SEND_CAD', 5),
    maxCad: numberFromEnv('MAX_SEND_CAD', 3000),
});

export class QuoteError extends Error {}

// Accepts a number or a string like "100" / "100.5" and returns a quote,
// or throws QuoteError with a message that can be shown to the user.
export function calculateQuote(rawAmount: unknown): Quote {
    const text = typeof rawAmount === 'number' ? String(rawAmount) : typeof rawAmount === 'string' ? rawAmount.trim() : '';

    // Digits with at most 2 decimals: no letters, no negatives, no "1e5".
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        throw new QuoteError('Enter an amount in dollars, e.g. 100 or 100.50');
    }

    const { exchangeRate, feePercent, minCad, maxCad } = getPricing();
    const cadAmount = Number(text);

    if (cadAmount < minCad) throw new QuoteError(`The minimum transfer is $${minCad.toFixed(2)} CAD`);
    if (cadAmount > maxCad) throw new QuoteError(`The maximum transfer is $${maxCad.toFixed(2)} CAD`);

    // Work in whole cents to avoid floating-point rounding errors.
    const amountCents = Math.round(cadAmount * 100);
    const feeCents = Math.round((amountCents * feePercent) / 100);
    const sendCents = amountCents - feeCents;

    return {
        cadAmount: amountCents / 100,
        fee: feeCents / 100,
        exchangeRate,
        // UGX has no smaller unit, so round down to a whole shilling.
        ugxAmount: Math.floor((sendCents * exchangeRate) / 100),
        expiresIn: 300, // 5 minutes
    };
}
