
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
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
  return Math.floor(100000 + Math.random() * 900000).toString();
};

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 2. Create user in DB
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        status: 'pending', // Waiting for OTP verification
      },
    });

    // 3. GENERATE OTP
    const otpCode = generateOTP();
    const otpHash = await bcrypt.hash(otpCode, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await prisma.otpToken.create({
      data: {
        tokenHash: otpHash,
        expiresAt,
        user: { connect: { id: user.id } },
      },
    });

    // 4. "Send" OTP by logging to console
    console.log(`💸 MoneyWing Signup OTP for ${email}: ${otpCode}`);
    console.log(`⏰ OTP expires at: ${expiresAt.toLocaleTimeString()}`);

    // 5. Respond to client
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

    res.status(500).json({ error: 'Internal server error during signup' });
  }
});


router.post('/verify-otp', async (req: Request, res: Response) => {
 console.log("✅ /auth/test-verify route was hit!");

    try {
        const {email, otpCode} = req.body;
        // Validate input 
        if(!email || !otpCode) {
            return res.status(400).json({ error: 'Email and OTP code are required'});
        }

        // 1. Find the user and their most recent OTP token 
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                otpTokens: {
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

        const otpToken = user.otpTokens[0];

        // 2. Check if OTP exists and is not expired 
        if(!otpToken) {
            return res.status(400).json({ error: 'No OTP found for this user.'});
        }

        if (new Date() > otpToken.expiresAt) {
            // Clean up expired token 
            await prisma.otpToken.delete({ where: {id: otpToken.id } });
            return res.status(400).json({ error: 'OPT has expired. Please request a new one.'});
        }

        // 3. Validate OTP code 
        const isValid = await bcrypt.compare(otpCode, otpToken.tokenHash);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid OTP code.'});
        }

        // 4. Update user status to "verified"
        const updatedUser = await prisma.user.update({
            where: {id: user.id },
            data: {status: 'verified'},
        });

        // 5. Generate JWT token 
        const token = generateJWT(user.id);

        // 6. Clean up the used OTP token 
        await prisma.otpToken.delete({ where: { id: otpToken.id }});

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


router.post('/login', async (req: Request, res: Response) => {
    try {
        console.log("/auth/login route was hit!");
        const { email, password } = req.body;

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