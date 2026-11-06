import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface AuthRequest extends Request {
    userId?: string;
    adminEmail?: string; // set by requireAdmin for developer-area requests
}

const prisma = new PrismaClient();

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let userId: string;
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if(!token) {
            return res.status(401).json({ error: 'Access token required'});
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if(!JWT_SECRET) {
            throw new Error('JWT_SECRET is not defined');
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string};
        userId = decoded.userId;
    } catch(error) {
        console.error('Authentication error:', error);
        return res.status(403).json({ error: 'Invalid or expired token'});
    }

    // A valid token isn't enough: the account must still exist and be open.
    // (Logins last 7 days, so a deleted or closed account could otherwise keep using one.)
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
        if (!user || user.status === 'closed') {
            return res.status(401).json({ error: 'Your session has ended. Please log in again.' });
        }
    } catch (error) {
        console.error('Authentication lookup error:', error);
        return res.status(500).json({ error: 'Could not check your login' });
    }

    req.userId = userId;
    next();
};
