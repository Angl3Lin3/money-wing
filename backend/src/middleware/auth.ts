import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt';
import { PrismaClient } from '@prisma/client';

export interface AuthRequest extends Request {
    userId?: string;
    adminEmail?: string; // set by requireAdmin for developer-area requests
}

const prisma = new PrismaClient();

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let userId: string;
    let tokenVersion: number;
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if(!token) {
            return res.status(401).json({ error: 'Access token required'});
        }

        const decoded = verifyJWT(token);
        userId = decoded.userId;
        tokenVersion = decoded.v ?? 0;
    } catch(error) {
        console.warn('Login token rejected:', (error as Error)?.message ?? error);
        return res.status(401).json({ error: 'Your session has ended. Please log in again.' });
    }

    // A valid token isn't enough: the account must still exist and be open.
    // (Logins last 7 days, so a deleted or closed account could otherwise keep using one.)
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, tokenVersion: true } });
        // tokenVersion differs = the password was changed or reset since this
        // login was made, so this device has been logged out.
        if (!user || user.status === 'closed' || user.tokenVersion !== tokenVersion) {
            return res.status(401).json({ error: 'Your session has ended. Please log in again.' });
        }
    } catch (error) {
        console.error('Authentication lookup error:', error);
        return res.status(500).json({ error: 'Could not check your login' });
    }

    req.userId = userId;
    next();
};
