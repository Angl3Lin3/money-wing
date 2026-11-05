// Local development convenience: creates a ready-to-use developer account
// from DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD in backend/.env, so you can log
// into the developer area without signing up and verifying first.
//
// Never runs when NODE_ENV=production (e.g. on Heroku), so a simple local
// password can't end up protecting a real server.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const devAdminEmail = (): string | null => {
    if (process.env.NODE_ENV === 'production') return null;
    const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
    return email || null;
};

export async function ensureDevAdmin(): Promise<void> {
    const email = devAdminEmail();
    const password = process.env.DEV_ADMIN_PASSWORD;
    if (!email || !password) return;

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        // Create the account, or bring it in line with .env if it exists
        // (so changing the password in .env takes effect on restart).
        await prisma.user.upsert({
            where: { email },
            create: { email, passwordHash, status: 'verified' },
            update: { passwordHash, status: 'verified' },
        });
        console.log(`🛠  Developer account ready: ${email} (from DEV_ADMIN_EMAIL in .env)`);
    } catch (error) {
        console.error('Could not create the developer account:', error);
    }
}
