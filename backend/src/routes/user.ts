import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Transfers that never involved money: safe to delete with an account.
const NO_MONEY_STATUSES: TransactionStatus[] = ['DRAFT', 'CANCELLED'];

// The logged-in user's account details.
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: {
                id: true,
                email: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { recipients: true, transactions: true } },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { _count, ...rest } = user;
        res.status(200).json({ user: { ...rest, recipientCount: _count.recipients, transferCount: _count.transactions } });
    } catch (error: any) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change password. Needs the current password.
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body ?? {};
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Enter your current password and a new password' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'The new password must be at least 8 characters' });
        }
        if (newPassword === currentPassword) {
            return res.status(400).json({ error: 'The new password must be different from the current one' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId! } });
        if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
            return res.status(400).json({ error: 'Your current password is incorrect' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await bcrypt.hash(newPassword, 12) },
        });
        res.status(200).json({ message: 'Password changed' });
    } catch (error: any) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Could not change the password' });
    }
});

// Delete the account. Needs the password.
// - No money ever moved: everything is deleted.
// - Paid transfers exist: the account is CLOSED instead. Nobody can log in to
//   it again, but the transfer records are kept, because records of money
//   transfers must be kept.
router.post('/delete-account', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { password } = req.body ?? {};
        const user = await prisma.user.findUnique({ where: { id: req.userId! } });
        if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(400).json({ error: 'Your password is incorrect' });
        }

        const moneyTransfers = await prisma.transaction.count({
            where: { userId: user.id, status: { notIn: NO_MONEY_STATUSES } },
        });

        if (moneyTransfers === 0) {
            // Removes the user and (through the database) their recipients,
            // unpaid transfers and codes.
            await prisma.user.delete({ where: { id: user.id } });
            return res.status(200).json({ result: 'deleted', message: 'Your account and data have been deleted.' });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                // A random password nobody knows: the account can never be logged into.
                data: { status: 'closed', passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12) },
            }),
            prisma.otpToken.deleteMany({ where: { userId: user.id } }),
            // Unpaid transfers can't be completed any more.
            prisma.transaction.updateMany({
                where: { userId: user.id, status: { in: ['DRAFT', 'PAYMENT_PENDING'] } },
                data: { status: 'CANCELLED' },
            }),
        ]);
        res.status(200).json({
            result: 'closed',
            message: 'Your account has been closed. Records of your past transfers are kept, as the law requires for money transfers.',
        });
    } catch (error: any) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Could not delete the account' });
    }
});

export default router;
