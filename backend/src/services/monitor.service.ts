// Keeps a short, in-memory record of recent requests and errors so the
// developer area can show how the server is doing. Nothing sensitive is
// stored: no request bodies, passwords, tokens or query strings.
// The record resets whenever the server restarts.
import { NextFunction, Request, Response } from 'express';

export interface RequestEntry {
    time: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
}

export interface ErrorEntry {
    time: string;
    message: string;
}

const MAX_ENTRIES = 200;
const requests: RequestEntry[] = [];
const errors: ErrorEntry[] = [];
const startedAt = new Date();

const push = <T>(list: T[], item: T) => {
    list.unshift(item);
    if (list.length > MAX_ENTRIES) list.pop();
};

// Replace ids in paths so the log doesn't leak them, e.g.
// /transaction/3f2a9c1b-... -> /transaction/:id
const tidyPath = (path: string) =>
    path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');

export function requestMonitor(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const path = tidyPath(req.originalUrl.split('?')[0] ?? '');
        // Don't record the developer area polling itself.
        if (path.startsWith('/admin')) return;
        push(requests, {
            time: new Date().toISOString(),
            method: req.method,
            path,
            status: res.statusCode,
            durationMs: Number(process.hrtime.bigint() - start) / 1e6,
        });
    });
    next();
}

// Record server errors (anything logged with console.error) as well.
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
    const message = args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ')
        .slice(0, 300);
    push(errors, { time: new Date().toISOString(), message });
    originalError(...args);
};

export const getActivity = () => ({
    startedAt: startedAt.toISOString(),
    requests: [...requests],
    errors: [...errors],
});
