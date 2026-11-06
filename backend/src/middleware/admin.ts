import { NextFunction, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';
import { devAdminEmail } from '../services/dev-admin.service';

const prisma = new PrismaClient();

// Emails allowed into the developer area, from ADMIN_EMAILS in .env
// (comma-separated). If it's empty, nobody gets in.
// The local developer account (DEV_ADMIN_EMAIL) is always included.
export const adminEmails = (): string[] => {
    const listed = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    const dev = devAdminEmail();
    return dev && !listed.includes(dev) ? [...listed, dev] : listed;
};

// Use after authenticateToken: lets the request through only for admins.
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Login required' });
        }
        const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
        if (!user || !adminEmails().includes(user.email.toLowerCase())) {
            return res.status(403).json({ error: 'This account is not allowed into the developer area.' });
        }
        req.adminEmail = user.email.toLowerCase(); // recorded on owner actions
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Could not check access' });
    }
}
