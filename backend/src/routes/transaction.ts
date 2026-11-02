import { StripeService } from './../services/stripe.service';
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { normalizeUgandaPhone, networkForPhone, VALID_NETWORKS } from '../utils/phone';
import { calculateQuote, QuoteError } from '../services/pricing.service';



const router = express.Router();
const prisma = new PrismaClient();
const stripeService = new StripeService();

// Endpoint-> "Get a quote for sending money"
router.get('/quote', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        res.status(200).json(calculateQuote(req.query.cadAmount));
    } catch (error: any) {
        if (error instanceof QuoteError) {
            return res.status(400).json({ error: error.message });
        }
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

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if(!trimmedName || !phoneNumber || !network) {
            return res.status(400).json({ error: 'Name, phone number, and network are required'});
        }

        // Validate network 
        if(!VALID_NETWORKS.includes(network)) {
           return res.status(400).json({ error: 'Network must be MTN or Airtel'});
        }

        // Validate the number and store it in one standard format (+256...)
        const normalizedPhone = normalizeUgandaPhone(phoneNumber);
        if(!normalizedPhone) {
            return res.status(400).json({ error: 'Enter a valid Ugandan mobile number, e.g. 0772 123 456'});
        }

        const detectedNetwork = networkForPhone(normalizedPhone);
        if(detectedNetwork && detectedNetwork !== network) {
            return res.status(400).json({ error: `That number looks like ${detectedNetwork}, not ${network}. Please check the network.`});
        }

        // Don't save the same person twice
        const duplicate = await prisma.recipient.findFirst({
            where: { userId, phoneNumber: normalizedPhone }
        });
        if(duplicate) {
            return res.status(400).json({ error: `You already have a recipient with this number (${duplicate.name}).`});
        }

        // Create recipient 
        const recipient = await prisma.recipient.create({
            data: {
                name: trimmedName,
                phoneNumber: normalizedPhone,
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
            orderBy: { createdAt: 'desc' },
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

// Endpoint-> "Remove a recipient"
router.delete('/recipients/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        if(!userId) {
            return res.status(401).json({ error: 'User not authenticated'});
        }

        const recipientId = req.params.id;
        if(!recipientId) {
            return res.status(400).json({ error: 'Recipient id is required'});
        }

        // Only the owner can delete their recipient
        const recipient = await prisma.recipient.findFirst({
            where: { id: recipientId, userId },
            include: { _count: { select: { transactions: true } } }
        });
        if(!recipient) {
            return res.status(404).json({ error: 'Recipient not found'});
        }

        // Deleting a recipient would also delete their transfers (the database
        // cascades), and money records must be kept. So block it.
        if(recipient._count.transactions > 0) {
            return res.status(400).json({ error: 'This recipient has transfers on record and cannot be deleted.'});
        }

        await prisma.recipient.delete({ where: { id: recipient.id } });
        res.status(200).json({ message: 'Recipient deleted' });
    } catch(error: any) {
        console.error('Delete recipient error:', error);
        res.status(500).json({ error: 'Failed to delete recipient'});
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

        // Same calculation as GET /quote (also validates the amount)
        let quote;
        try {
            quote = calculateQuote(cadAmount);
        } catch (error: any) {
            if (error instanceof QuoteError) {
                return res.status(400).json({ error: error.message });
            }
            throw error;
        }

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

        // Create transaction record
        const transaction = await prisma.transaction.create({
            data: {
                cadAmount: quote.cadAmount,
                fee: quote.fee,
                exchangeRate: quote.exchangeRate,
                ugxAmount: quote.ugxAmount,
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