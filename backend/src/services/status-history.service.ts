// Records every change to a transfer's status, with when and who, in the
// AuditLog table. The customer's progress tracker is built from this.
import { PrismaClient, TransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

type Db = Pick<PrismaClient, 'auditLog'>;

// actor: an owner's email, the customer's email, or 'system' (Stripe/payouts).
export function recordStatusChange(
    transactionId: string,
    from: TransactionStatus,
    to: TransactionStatus,
    actor: string,
    action: string,
    details: Record<string, unknown> = {},
    db: Db = prisma
) {
    return db.auditLog.create({
        data: { actorEmail: actor, action, targetId: transactionId, details: { from, to, ...details } as any },
    });
}

export interface TimelineStep {
    status: TransactionStatus;
    at: string;
    note?: string; // e.g. the reason a delivery failed
}

// The steps a transfer has been through, oldest first. Never includes who did
// it (owners' emails stay private).
export async function getTimeline(transactionId: string, createdAt: Date): Promise<TimelineStep[]> {
    const entries = await prisma.auditLog.findMany({
        where: { targetId: transactionId },
        orderBy: { createdAt: 'asc' },
    });
    const steps: TimelineStep[] = [{ status: 'DRAFT', at: createdAt.toISOString() }];
    for (const e of entries) {
        const d = (e.details ?? {}) as Record<string, any>;
        if (!d.to) continue;
        steps.push({
            status: d.to as TransactionStatus,
            at: e.createdAt.toISOString(),
            ...(d.to === 'PAYOUT_FAILED' && d.note ? { note: String(d.note) } : {}),
        });
    }
    return steps;
}
