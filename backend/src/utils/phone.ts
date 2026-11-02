// Uganda mobile number helpers.
//
// Accepts the common ways people write a Ugandan number:
//   0772 123 456, 772123456, +256 772 123 456, 256772123456
// and stores them in one standard format: +256772123456
//
// NOTE: confirm these prefixes with the business owner. If a network adds
// new prefixes, add them here.
export const NETWORK_PREFIXES: Record<string, string[]> = {
    MTN: ['76', '77', '78'],
    Airtel: ['70', '74', '75'],
};

export const VALID_NETWORKS = Object.keys(NETWORK_PREFIXES);

// Returns +2567XXXXXXXX, or null if it isn't a Ugandan mobile number.
export function normalizeUgandaPhone(input: unknown): string | null {
    if (typeof input !== 'string') return null;

    let digits = input.replace(/[\s\-().]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (!/^\d+$/.test(digits)) return null;

    if (digits.startsWith('256')) digits = digits.slice(3);
    else if (digits.startsWith('0')) digits = digits.slice(1);

    // Ugandan mobile numbers are 9 digits after the country code, starting with 7.
    if (!/^7\d{8}$/.test(digits)) return null;
    return `+256${digits}`;
}

// The network a normalized number belongs to, based on its prefix.
export function networkForPhone(normalized: string): string | null {
    const prefix = normalized.slice(4, 6); // "+256" then 2-digit prefix
    for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) return network;
    }
    return null;
}
