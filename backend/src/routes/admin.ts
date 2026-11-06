// Developer area: lets the team see how the app is working.
// Every route here requires a login from an email listed in ADMIN_EMAILS.
import express, { Response } from 'express';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { adminEmails, requireAdmin } from '../middleware/admin';
import { getActivity } from '../services/monitor.service';
import { emailSetupSummary, getOutbox, sendEmailInBackground } from '../services/email.service';
import { transferCancelledEmail, transferDeliveredEmail, transferFailedEmail } from '../services/email.templates';
import { getPricing, getPricingInfo, PricingError, savePricing } from '../services/pricing.service';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken, requireAdmin);

const PAID_STATUSES: TransactionStatus[] = ['FUNDED', 'PAYOUT_PENDING', 'COMPLETED'];

// Shows whether a secret is set, never its value.
const keyStatus = (value: string | undefined) => {
    if (!value) return 'missing';
    if (value.startsWith('sk_test_') || value.startsWith('pk_test_')) return 'set (test mode)';
    if (value.startsWith('sk_live_') || value.startsWith('pk_live_')) return 'set (LIVE mode)';
    return 'set';
};

// Everything at a glance: server, database, settings and totals.
router.get('/overview', async (_req: AuthRequest, res: Response) => {
    try {
        // Database check: how long a trivial query takes.
        let database: { ok: boolean; latencyMs?: number; error?: string };
        const dbStart = Date.now();
        try {
            await prisma.$queryRaw`SELECT 1`;
            database = { ok: true, latencyMs: Date.now() - dbStart };
        } catch (error: any) {
            database = { ok: false, error: error?.message ?? 'Database unreachable' };
        }

        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [usersByStatus, recipients, transfersByStatus, newUsers24h, newTransfers24h, paidVolume] = await Promise.all([
            prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
            prisma.recipient.count(),
            prisma.transaction.groupBy({ by: ['status'], _count: { _all: true }, _sum: { cadAmount: true } }),
            prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
            prisma.transaction.count({ where: { createdAt: { gte: dayAgo } } }),
            prisma.transaction.aggregate({ where: { status: { in: PAID_STATUSES } }, _sum: { cadAmount: true } }),
        ]);

        const userCounts = Object.fromEntries(usersByStatus.map((u) => [u.status, u._count._all]));
        const transferCounts = Object.fromEntries(
            transfersByStatus.map((t) => [t.status, { count: t._count._all, cadAmount: t._sum.cadAmount ?? 0 }])
        );

        res.json({
            server: {
                status: 'ok',
                startedAt: getActivity().startedAt,
                uptimeSeconds: Math.round(process.uptime()),
                nodeVersion: process.version,
                environment: process.env.NODE_ENV ?? 'development',
            },
            database,
            config: {
                jwtSecret: process.env.JWT_SECRET ? 'set' : 'missing',
                stripeSecretKey: keyStatus(process.env.STRIPE_SECRET_KEY),
                stripeWebhookSecret: keyStatus(process.env.STRIPE_WEBHOOK_SECRET),
                payoutProvider: process.env.PAYOUT_PROVIDER ?? 'mock',
                emailProvider: emailSetupSummary(),
                adminCount: adminEmails().length,
                pricing: await getPricing(),
            },
            totals: {
                users: {
                    total: usersByStatus.reduce((n, u) => n + u._count._all, 0),
                    verified: userCounts.verified ?? 0,
                    pending: userCounts.pending ?? 0,
                    newLast24h: newUsers24h,
                },
                recipients,
                transfers: {
                    total: transfersByStatus.reduce((n, t) => n + t._count._all, 0),
                    newLast24h: newTransfers24h,
                    byStatus: transferCounts,
                    paidVolumeCad: paidVolume._sum.cadAmount ?? 0,
                },
            },
        });
    } catch (error: any) {
        console.error('Admin overview error:', error);
        res.status(500).json({ error: 'Failed to load overview' });
    }
});

// Most recent sign-ups. Never includes passwords.
router.get('/users', async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                email: true,
                status: true,
                kycStatus: true,
                createdAt: true,
                _count: { select: { recipients: true, transactions: true } },
            },
        });
        res.json({ users });
    } catch (error: any) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
});

// Most recent transfers from all customers. Optional ?status=DRAFT etc.
router.get('/transactions', async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
        const status = typeof req.query.status === 'string' ? (req.query.status as TransactionStatus) : undefined;
        if (status && !Object.values(TransactionStatus).includes(status)) {
            return res.status(400).json({ error: 'Unknown status' });
        }
        const transactions = await prisma.transaction.findMany({
            where: status ? { status } : {},
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                cadAmount: true,
                fee: true,
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
            },
        });
        res.json({ transactions });
    } catch (error: any) {
        console.error('Admin transactions error:', error);
        res.status(500).json({ error: 'Failed to load transactions' });
    }
});

// Recent requests and errors since the server started.
router.get('/activity', (_req: AuthRequest, res: Response) => {
    const activity = getActivity();
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const lastHour = activity.requests.filter((r) => Date.parse(r.time) >= hourAgo);
    const failed = lastHour.filter((r) => r.status >= 500).length;
    res.json({
        ...activity,
        summary: {
            requestsLastHour: lastHour.length,
            serverErrorsLastHour: failed,
            averageMsLastHour: lastHour.length
                ? Math.round(lastHour.reduce((n, r) => n + r.durationMs, 0) / lastHour.length)
                : 0,
        },
    });
});

// ---------------------------------------------------------------------------
// Owner controls
// ---------------------------------------------------------------------------

// Writes a permanent record of an owner action.
const audit = (actorEmail: string, action: string, targetId: string | null, details: object) =>
    prisma.auditLog.create({ data: { actorEmail, action, targetId, details: details as any } });

// Current rate, fee and limits, and who last changed them.
router.get('/settings', async (_req: AuthRequest, res: Response) => {
    try {
        res.json(await getPricingInfo());
    } catch (error: any) {
        console.error('Admin settings error:', error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

// Change the rate, fee and limits. Takes effect immediately for new quotes.
router.put('/settings/pricing', async (req: AuthRequest, res: Response) => {
    try {
        const actor = req.adminEmail!;
        const { before, after } = await savePricing(req.body, actor);
        await audit(actor, 'pricing.update', null, { before, after });
        res.json(await getPricingInfo());
    } catch (error: any) {
        if (error instanceof PricingError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Save pricing error:', error);
        res.status(500).json({ error: 'Failed to save pricing' });
    }
});

// What the owner can do to a transfer, and from which statuses.
type TransferAction = 'simulate_payment' | 'start_payout' | 'mark_delivered' | 'mark_failed' | 'retry_payout' | 'cancel';

const TRANSFER_ACTIONS: Record<TransferAction, { from: TransactionStatus[]; to: TransactionStatus; needs?: 'reference' | 'note'; devOnly?: boolean }> = {
    // Testing only: pretend the card payment went through (no Stripe yet).
    simulate_payment: { from: ['DRAFT', 'PAYMENT_PENDING'], to: 'FUNDED', devOnly: true },
    // Owner starts sending the mobile money by hand.
    start_payout: { from: ['FUNDED'], to: 'PAYOUT_PENDING' },
    // Money arrived. Needs the MTN/Airtel transaction reference as proof.
    mark_delivered: { from: ['FUNDED', 'PAYOUT_PENDING', 'PAYOUT_FAILED'], to: 'COMPLETED', needs: 'reference' },
    // Sending didn't work. Needs a reason.
    mark_failed: { from: ['PAYOUT_PENDING'], to: 'PAYOUT_FAILED', needs: 'note' },
    // Try sending again after a failure.
    retry_payout: { from: ['PAYOUT_FAILED'], to: 'PAYOUT_PENDING' },
    // Stop a transfer that hasn't been paid for. (Paid ones need a refund,
    // which comes with the Stripe step.)
    cancel: { from: ['DRAFT', 'PAYMENT_PENDING'], to: 'CANCELLED' },
};

router.post('/transactions/:id/action', async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id;
        const action = req.body?.action as TransferAction;
        const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
        const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim().slice(0, 100) : '';
        const rule = TRANSFER_ACTIONS[action];

        if (!id) return res.status(400).json({ error: 'Transfer id is required' });
        if (!rule) return res.status(400).json({ error: 'Unknown action' });
        if (rule.devOnly && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Simulated payments are only allowed while testing' });
        }
        if (rule.needs === 'reference' && !reference) {
            return res.status(400).json({ error: 'Enter the mobile money transaction reference' });
        }
        if (rule.needs === 'note' && !note) {
            return res.status(400).json({ error: 'Enter a reason' });
        }

        const current = await prisma.transaction.findUnique({ where: { id }, select: { status: true } });
        if (!current) return res.status(404).json({ error: 'Transfer not found' });
        if (!rule.from.includes(current.status)) {
            return res.status(409).json({ error: `Can't do that while the transfer is ${current.status}` });
        }

        // Only update if the status is still what we just checked, so two
        // people clicking at once can't both act on the same transfer.
        const isPayoutStep = action === 'start_payout' || action === 'mark_delivered' || action === 'retry_payout';
        const updated = await prisma.transaction.updateMany({
            where: { id, status: current.status },
            data: {
                status: rule.to,
                ...(isPayoutStep && { provider: 'manual' }),
                ...(action === 'mark_delivered' && { providerPayoutRef: reference }),
            },
        });
        if (updated.count === 0) {
            return res.status(409).json({ error: 'This transfer was just changed by someone else. Refresh and try again.' });
        }

        // Let the customer know about outcomes that matter to them.
        if (action === 'mark_delivered' || action === 'mark_failed' || action === 'cancel') {
            const t = await prisma.transaction.findUnique({
                where: { id },
                include: { user: { select: { email: true } }, recipient: { select: { name: true, phoneNumber: true, network: true } } },
            });
            if (t) {
                const email =
                    action === 'mark_delivered' ? transferDeliveredEmail(t.user.email, t, reference)
                    : action === 'mark_failed' ? transferFailedEmail(t.user.email, t, note)
                    : transferCancelledEmail(t.user.email, t);
                sendEmailInBackground(email);
            }
        }

        await audit(req.adminEmail!, `transfer.${action}`, id, {
            from: current.status,
            to: rule.to,
            ...(note && { note }),
            ...(reference && { reference }),
        });

        res.json({ id, status: rule.to });
    } catch (error: any) {
        console.error('Transfer action error:', error);
        res.status(500).json({ error: 'Failed to update the transfer' });
    }
});

// Which actions are possible from each status (the app uses this to show buttons).
router.get('/transfer-actions', (_req: AuthRequest, res: Response) => {
    const production = process.env.NODE_ENV === 'production';
    res.json(
        Object.entries(TRANSFER_ACTIONS)
            .filter(([, rule]) => !(rule.devOnly && production))
            .map(([action, rule]) => ({ action, from: rule.from, to: rule.to, needs: rule.needs ?? null }))
    );
});

// Recent emails. When no email service is set up, includes their full text
// (so you can read codes while testing); otherwise only who/what/whether sent.
router.get('/emails', (_req: AuthRequest, res: Response) => {
    res.json(getOutbox());
});

// Recent owner actions, newest first. Optional ?targetId= for one transfer.
router.get('/audit', async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '30'), 10) || 30, 1), 100);
        const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;
        const entries = await prisma.auditLog.findMany({
            where: targetId ? { targetId } : {},
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        res.json({ entries });
    } catch (error: any) {
        console.error('Audit log error:', error);
        res.status(500).json({ error: 'Failed to load the action log' });
    }
});

export default router;
