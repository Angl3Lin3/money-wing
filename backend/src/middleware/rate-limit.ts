import { NextFunction, Request, Response } from 'express';

// Simple in-memory limits, so passwords can't be guessed quickly and the
// sign-in screens can't be hammered. They reset when the server restarts,
// which is fine for one server; several servers would need a shared store
// (e.g. Redis).

interface Bucket { count: number; resetAt: number }

class Counter {
    private buckets = new Map<string, Bucket>();
    constructor(private limit: number, private windowMs: number) {
        // Forget old entries now and then so memory doesn't grow.
        setInterval(() => {
            const now = Date.now();
            for (const [key, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(key);
        }, 60_000).unref();
    }
    /** Seconds until allowed again, or 0 if under the limit. */
    blockedFor(key: string): number {
        const b = this.buckets.get(key);
        if (!b || b.resetAt <= Date.now() || b.count < this.limit) return 0;
        return Math.ceil((b.resetAt - Date.now()) / 1000);
    }
    add(key: string): void {
        const now = Date.now();
        const b = this.buckets.get(key);
        if (!b || b.resetAt <= now) this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
        else b.count += 1;
    }
    reset(key: string): void {
        this.buckets.delete(key);
    }
}

const minutesText = (seconds: number) => {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

// Wrong passwords: 5 per email, or 20 per network address, per 15 minutes.
const failedLoginsByEmail = new Counter(5, 15 * 60_000);
const failedLoginsByIp = new Counter(20, 15 * 60_000);

/** Returns an error message if this login must wait, otherwise null. */
export function loginBlockedMessage(email: string, ip: string): string | null {
    const wait = Math.max(failedLoginsByEmail.blockedFor(email), failedLoginsByIp.blockedFor(ip));
    return wait > 0 ? `Too many wrong passwords. Please try again in ${minutesText(wait)}, or use Forgot password.` : null;
}

export function recordFailedLogin(email: string, ip: string): void {
    failedLoginsByEmail.add(email);
    failedLoginsByIp.add(ip);
}

export function recordSuccessfulLogin(email: string): void {
    failedLoginsByEmail.reset(email);
}

// Every /auth request (sign up, codes, login...): 60 per network address per
// 10 minutes. Generous for real people, too few for a script.
const authRequestsByIp = new Counter(60, 10 * 60_000);

export function limitAuthRequests(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip ?? 'unknown';
    const wait = authRequestsByIp.blockedFor(ip);
    if (wait > 0) {
        res.setHeader('Retry-After', String(wait));
        return res.status(429).json({ error: `Too many attempts. Please try again in ${minutesText(wait)}.` });
    }
    authRequestsByIp.add(ip);
    next();
}
