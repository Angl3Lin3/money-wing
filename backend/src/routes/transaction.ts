import { StripeService } from './../services/stripe.service';
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';



const router = express.Router();
const prisma = new PrismaClient();
const stripeService = new StripeService();

// Endpoint-> "Get a quote for sending money"
router.get('/quote', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { cadAmount } = req.query;
        const amount = parseFloat(cadAmount as string);

        if(!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid CAD amount required'});
        }

        // TODO: Replace with real exchange rate API
        const EXCHANGE_RATE = 2800; // 1 CAD = 2800 UGX
        const FEE_PERCENTAGE = 0.02; // 2% fee

        const fee = amount * FEE_PERCENTAGE;
        const ugxAmount = (amount - fee) * EXCHANGE_RATE;

        res.status(200).json({
            cadAmount: amount,
            fee: fee,
            exchangeRate: EXCHANGE_RATE,
            ugxAmount: ugxAmount,
            expiresIn: 300 // Quote expires in 5 minutes
        });
    } catch (error: any) {
        console.error('Quote error:', error);
        res.status(500).json({ error: 'Failed to generate quote'});
    }
});

// Endpoint-> "Save who user is sending money to"
router.post('/recipients', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        const { name, phoneNumber, network } = req.body;

        if(!userId) {
            return res.status(401).json({ error: 'User not authenticated'});
        }

        if(!name || !phoneNumber || !network) {
            return res.status(400).json({ error: 'Name, phone number, and network are required'});
        }

        // Validate network 
        const validNetworks = ['MTN', 'Airtel'];
        if(!validNetworks.includes(network)) {
           return res.status(400).json({ error: 'Netowrk must be MTN or Airtel'});
        }

        // Create recipient 
        const recipient = await prisma.recipient.create({
            data: {
                name,
                phoneNumber,
                network,
                user: { connect: { id: userId}}
            }
        });

        res.status(201).json({
            message: 'Recipient added successfully',
            recipient: {
                id: recipient.id,
                name: recipient.name,
                phoneNumber: recipient.phoneNumber,
                network: recipient.network
            }
        });
    } catch(error: any) {
        console.error('Create recipient error:', error);
        res.status(500).json({ error: 'Failed to add recipient'});
    }
});

// Endpoint-> "Get User's recipients"
router.get('/recipients', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;

        if(!userId) {
            return res.status(401).json({ error: 'User not authenticated'});
        }

        const recipients = await prisma.recipient.findMany({
            where: {userId},
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                network: true,
                createdAt: true
            }
        });

        res.status(200).json({ recipients });
    } catch(error: any) {
        console.error('Get recipients error:', error);
        res.status(500).json({ error: 'Failed to fetch recipients'});
    }
});

// Endpoint -> Core transaction creation 
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        const { cadAmount, recipientId } = req.body;

        if(!userId) {
            return res.status(401).json({ error: 'User not authenticated'});
        }

        if(!cadAmount || !recipientId) {
            return res.status(400).json({ error: 'Amount and recipient ID are required'});
        }
        const amount = parseFloat(cadAmount);

        // Validate recipient belongs to user 
        const recipient = await prisma.recipient.findFirst({
            where: {
                id: recipientId,
                userId: userId
            }
        });

        if (!recipient) {
            return res.status(404).json({error: 'Recipient not found'});
        }

        // Calculate quote (same logic as GET/quote)
        const EXCHANGE_RATE = 2800;
        const FEE_PERCENTAGE = 0.02;
        const fee = amount * FEE_PERCENTAGE;
        const ugxAmount = (amount - fee) * EXCHANGE_RATE;

        // Create transaction record
        const transaction = await prisma.transaction.create({
            data: {
                cadAmount: amount,
                fee: fee,
                exchangeRate: EXCHANGE_RATE,
                ugxAmount: ugxAmount,
                status: 'DRAFT',
                user: {connect: { id: userId}},
                recipient: { connect: { id: recipientId}}
            },
            include: {
                recipient: {
                    select: {
                        name: true,
                        phoneNumber: true,
                        network: true
                    }
                }
            }
        });

        res.status(201).json({
            message: 'Transaction created successfully',
            transaction: {
                id: transaction.id,
                cadAmount: transaction.cadAmount,
                fee: transaction.fee,
                exchangeRate: transaction.exchangeRate,
                ugxAmount: transaction.ugxAmount,
                status: transaction.status,
                recipient: transaction.recipient,
                createdAt: transaction.createdAt
            }
        });
    } catch(error: any) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Failed to create transaction'});
    }
});

// Endpoint -> Create payment intent for a transaction 
router.post('/:id/payment-intent', authenticateToken, async( req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId; 

      if(!userId) {
        return res.status(401).json({ error: 'User not authenticated'});
      }

      if (!id) {
        return res.status(400).json({ error: 'Transaction ID is required'});
      }

      // Find the transaction 
      const transaction = await prisma.transaction.findFirst({
        where: {
            id: id,
            userId: userId,
            status: 'DRAFT' // only allow payment for DRAFT transactions
        }
      });

      if(!transaction) {
        return res.status(404).json({ error: 'Transaction not found or already processed'});
      }

      // Create Stripe payment intent
      const paymentIntent = await stripeService.createPaymentIntent(transaction.cadAmount);

      // Update transaction with Stripe payment ID 
      const updatedTransaction = await prisma.transaction.update({
        where: { id: id },
        data: {
            stripePaymentId: paymentIntent.id,
            status: 'PAYMENT_PENDING'
        }
      });

      res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        transactionId: updatedTransaction.id,
        amount: updatedTransaction.cadAmount,
        status: updatedTransaction.status
      });

    } catch(error: any) {
        console.error('Payment intent error:', error);
        res.status(500).json({ error: 'Failed to create payment intent'});
    }
});



export default router;