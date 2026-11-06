
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { isEmailConfigured, sendEmail, sendEmailInBackground } from '../services/email.service';
import { passwordChangedEmail, passwordResetCodeEmail, verificationCodeEmail } from '../services/email.templates';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const generateJWT = (userId: string): string => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if(!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return jwt.sign({ userId}, JWT_SECRET, { expiresIn: '7d'});
}

// Generate a random 6-digit OTP
const generateOTP = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Shown when someone tries to use an account that was closed.
const CLOSED_MESSAGE = 'This account has been closed. Contact MoneyWing if you need help.';

const normalizeEmail = (email: unknown): string =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

// Codes are 6 digits, valid for 10 minutes. After 5 wrong tries a code stops
// working, so nobody can guess their way in.
const MAX_CODE_ATTEMPTS = 5;
const wrongAttempts = new Map<string, number>(); // code id -> wrong tries

type CodePurpose = 'signup' | 'password-reset';

// Replace any old codes of this kind with a fresh one and email it.
const issueCode = async (userId: string, email: string, purpose: CodePurpose): Promise<void> => {
  const code = generateOTP();
  const tokenHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  await prisma.otpToken.deleteMany({ where: { userId, purpose } });
  await prisma.otpToken.create({
    data: { tokenHash, expiresAt, purpose, user: { connect: { id: userId } } },
  });

  if (!isEmailConfigured()) {
    console.log(`💸 MoneyWing ${purpose} code for ${email}: ${code} (expires ${expiresAt.toLocaleTimeString()})`);
  }
  await sendEmail(purpose === 'signup' ? verificationCodeEmail(email, code) : passwordResetCodeEmail(email, code));
};

const issueOtp = (userId: string, email: string) => issueCode(userId, email, 'signup');

// Checks a code. Returns null if it's right, otherwise the error to show.
// Wrong tries are counted; the 5th wrong try deletes the code.
const checkCode = async (token: { id: string; tokenHash: string; expiresAt: Date } | undefined, code: string): Promise<string | null> => {
  if (!token) return 'No code found. Please request a new one.';
  if (new Date() > token.expiresAt) {
    await prisma.otpToken.delete({ where: { id: token.id } }).catch(() => {});
    return 'Code has expired. Please request a new one.';
  }
  if (await bcrypt.compare(code, token.tokenHash)) {
    wrongAttempts.delete(token.id);
    return null;
  }
  const tries = (wrongAttempts.get(token.id) ?? 0) + 1;
  if (tries >= MAX_CODE_ATTEMPTS) {
    wrongAttempts.delete(token.id);
    await prisma.otpToken.delete({ where: { id: token.id } }).catch(() => {});
    return 'Too many wrong tries. Please request a new code.';
  }
  wrongAttempts.set(token.id, tries);
  return `That code isn't right. ${MAX_CODE_ATTEMPTS - tries} ${MAX_CODE_ATTEMPTS - tries === 1 ? 'try' : 'tries'} left.`;
};

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing && existing.status === 'verified') {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }
    if (existing && existing.status === 'closed') {
      return res.status(400).json({ error: CLOSED_MESSAGE });
    }

    // An account that was never verified can sign up again: update the
    // password and send a new code instead of locking the email forever.
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
      : await prisma.user.create({ data: { email, passwordHash, status: 'pending' } });

    await issueOtp(user.id, email);

    res.status(201).json({
      message: 'User created successfully. OTP sent to email.',
      userId: user.id
    });

  } catch (error: any) {
    console.error('Signup error:', error);

    // Handle duplicate email error
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if (error?.code === 'EENVELOPE' || error?.responseCode || error?.command) {
      return res.status(502).json({ error: 'We could not send the verification email. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

// Send a new code when the old one expired or was lost.
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }
    if (user.status === 'verified') {
      return res.status(400).json({ error: 'User is already verified. Please log in.' });
    }
    if (user.status === 'closed') {
      return res.status(400).json({ error: CLOSED_MESSAGE });
    }

    await issueOtp(user.id, email);
    res.status(200).json({ message: 'A new code has been sent.' });
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    if (error?.code === 'EENVELOPE' || error?.responseCode || error?.command) {
      return res.status(502).json({ error: 'We could not send the email. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Internal server error while resending code' });
  }
});


router.post('/verify-otp', async (req: Request, res: Response) => {

    try {
        const email = normalizeEmail(req.body.email);
        const otpCode = typeof req.body.otpCode === 'string' ? req.body.otpCode.trim() : '';
        // Validate input 
        if(!email || !otpCode) {
            return res.status(400).json({ error: 'Email and OTP code are required'});
        }

        // 1. Find the user and their most recent OTP token 
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                otpTokens: {
                    where: { purpose: 'signup' },
                    orderBy: { createdAt: 'desc'},
                    take: 1
                }
            },
        });

        if (!user) {
            return res.status(400).json({ error: 'User not found.' });
        }

        // Check if user is already verified 
        if (user.status === 'verified') {
            return res.status(400).json({ error: 'User is already verified.'});
        }
        if (user.status === 'closed') {
            return res.status(400).json({ error: CLOSED_MESSAGE });
        }

        // 2. Check the code (expiry and the 5-try limit included)
        const codeError = await checkCode(user.otpTokens[0], otpCode);
        if (codeError) {
            return res.status(400).json({ error: codeError });
        }

        // 4. Update user status to "verified"
        const updatedUser = await prisma.user.update({
            where: {id: user.id },
            data: {status: 'verified'},
        });

        // 5. Generate JWT token 
        const token = generateJWT(user.id);

        // 6. Clean up the used OTP token 
        await prisma.otpToken.deleteMany({ where: { userId: user.id, purpose: 'signup' } });

        // 7. Respond with success and token
        res.status(200).json({
            message: 'OTP verified successfully.',
            token,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                status: updatedUser.status
            }
        });

    } catch (error: any) {
       console.error('OTP verification error:', error);
       res.status(500).json({ error: 'Internal server error during OTP verification'});
    }
    
});


// Forgot password, step 1: email a reset code.
// Always answers the same way, so nobody can use it to find out which emails
// have accounts.
router.post('/forgot-password', async (req: Request, res: Response) => {
    const generic = { message: 'If an account exists for that email, we sent it a code.' };
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { otpTokens: { where: { purpose: 'password-reset' }, orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!user || user.status !== 'verified') {
            return res.status(200).json(generic);
        }

        // At most one code a minute, so the button can't be used to spam someone.
        const last = user.otpTokens[0];
        if (last && Date.now() - last.createdAt.getTime() < 60 * 1000) {
            return res.status(200).json(generic);
        }

        await issueCode(user.id, email, 'password-reset');
        res.status(200).json(generic);
    } catch (error: any) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Could not send a reset code. Please try again.' });
    }
});

// Forgot password, step 2: check the code and set the new password.
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.body.email);
        const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
        const { newPassword } = req.body;
        if (!email || !code || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Email, code and new password are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'The new password must be at least 8 characters' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { otpTokens: { where: { purpose: 'password-reset' }, orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!user || user.status !== 'verified') {
            return res.status(400).json({ error: 'No code found. Please request a new one.' });
        }

        const codeError = await checkCode(user.otpTokens[0], code);
        if (codeError) {
            return res.status(400).json({ error: codeError });
        }

        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
        await prisma.otpToken.deleteMany({ where: { userId: user.id, purpose: 'password-reset' } });
        sendEmailInBackground(passwordChangedEmail(email));

        res.status(200).json({ message: 'Password reset. You can log in with your new password.' });
    } catch (error: any) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Could not reset the password. Please try again.' });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;

        // Validate input 
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required'});
        }

        // 1. Find the user 
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if(!user) {
            return res.status(400).json({ error: 'Invalid email or password'});
        }

        // 2. Verify password 
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password'});
        }

        // 3. Check if user is verified 
        if (user.status === 'closed') {
            return res.status(400).json({ error: CLOSED_MESSAGE });
        }
        if (user.status !== 'verified') {
            return res.status(400).json({ error: 'Please verify your email first'});
        }

        // 4. Generate JWT token 
        const token = generateJWT(user.id);

        // 5. Respond with success 
        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                status: user.status
            }
        });
    } catch(error: any) {
       console.error('Login error:', error);
       res.status(500).json({ error: 'Internal server error during login'});
    }
});

export default router;