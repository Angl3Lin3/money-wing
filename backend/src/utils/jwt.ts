import jwt from 'jsonwebtoken';

// Login tokens last 7 days. Each one carries the account's tokenVersion;
// changing or resetting the password raises it, which logs out every other
// device (see middleware/auth.ts).
export interface LoginTokenPayload {
    userId: string;
    v?: number; // tokenVersion; tokens made before this existed count as 0
}

const secret = (): string => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return JWT_SECRET;
};

export const generateJWT = (userId: string, tokenVersion = 0): string =>
    jwt.sign({ userId, v: tokenVersion } satisfies LoginTokenPayload, secret(), { expiresIn: '7d' });

export const verifyJWT = (token: string): LoginTokenPayload => jwt.verify(token, secret()) as LoginTokenPayload;
