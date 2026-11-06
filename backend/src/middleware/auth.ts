import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    userId?: string;
    adminEmail?: string; // set by requireAdmin for developer-area requests
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
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
        req.userId = decoded.userId;
        next();
    } catch(error) {
        console.error('Authentication error:', error);
        return res.status(403).json({ error: 'Invalid or expired token'});
    }
};

