
import express, {Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { kycService } from '../services/kyc.service';
 


const router = express.Router();
const prisma = new PrismaClient();

// Get KYC access token 
router.get('/access-token', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
     const userId = req.userId;
     if(!userId) {
        return res.status(401).json({ error: 'User not authenticated'});
     }

     const user = await prisma.user.findUnique({ where: {id: userId}});
     if (!user) return res.status(404).json({ error: 'User not found'});

     const accessTokenData = await kycService.createAccessToken(user.id);

     res.status(200).json({
        accessToken: accessTokenData.token,
        expiresIn: accessTokenData.expiresIn,
     });
    }  catch(error: any) {
        console.error('KYC access token error:', error);
        res.status(500).json({ error: 'Failed to create KYC access token'});
    }
});


// (Removed: a "simulate verification" endpoint that let any user mark their
// own identity as verified. Real verification will come from a KYC provider
// or an owner approving it in the developer area.)


// Webhook endpoint (will be used by real KYC provider later)
router.post('/webhook', async(req: Request, res: Response) => {
    try {
        // Not connected to a provider yet. It doesn't change anything, and it
        // doesn't log what was sent (it could contain personal data). When a
        // real provider is added, its signature must be checked here first.
        res.status(501).json({ error: 'Identity verification is not set up yet'});
    } catch(error: any) {
        console.error('KYC webhook error:', error);
        res.status(500).json({ error: 'Failed to process webhook'});
    }
});

export default router;

