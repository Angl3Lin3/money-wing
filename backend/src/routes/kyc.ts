
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


// End point to simulate KYC completion (for testing)
router.post('/simulate-verification', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        if(!userId) return res.status(401).json({ error: 'User not authenticated'});

        const user = await prisma.user.findUnique({ where: { id: userId}});
        if(!user) return res.status(404).json({ error: 'User not found'});

        // Use the active KYC service (wrapped, currently mock)
        const kycResult = await kycService.simulateKycApproval(userId);

        // Update user in database (store result in status for now)
        const updatedUser = await prisma.user.update({
            where: {id: userId},
            data: {
                kycStatus: kycResult.reviewStatus
            },
        });

        res.status(200).json({
            message: 'KYC simulation completed',
            status: kycResult.reviewStatus,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                status: updatedUser.status
            }
        });
    } catch(error: any) {
        console.error('KYC simulation error:', error);
        res.status(500).json({ error: 'Failed to simulate KYC'});
    }
});


// Webhook endpoint (will be used by real KYC provider later)
router.post('/webhook', async(req: Request, res: Response) => {
    try {
        console.log('[MOCK] KYC webhook received (would be from real provider):', req.body);
        // For now, just acknowledge the webhook
        res.status(200).json({ message: 'Webhook received (mock)'});
    } catch(error: any) {
        console.error('KYC webhook error:', error);
        res.status(500).json({ error: 'Failed to process webhook'});
    }
});

export default router;

