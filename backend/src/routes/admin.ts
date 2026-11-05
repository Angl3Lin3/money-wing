// Developer area: lets the team see how the app is working.
// Every route here requires a login from an email listed in ADMIN_EMAILS.
import express, { Response } from 'express';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { adminEmails, requireAdmin } from '../middleware/admin';
import { getActivity } from '../services/monitor.service';
import { getPricing } from '../services/pricing.service';

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
                emailProvider: process.env.RESEND_API_KEY ? 'set' : 'not set (codes printed in server window)',
                adminCount: adminEmails().length,
                pricing: getPricing(),
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

export default router;
