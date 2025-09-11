
import express, { Request, Response } from 'express';
import { PrismaClient, Transaction } from '@prisma/client';
import { stripe } from '../services/stripe.service'; // Import your existing Stripe instance
import { payoutManager } from '../services/payout.manager';

const router = express.Router();
const prisma = new PrismaClient();

// Get the webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

if(!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not defined in environment variables');
}


// Webhook endpoint - must use raw body parser
router.post('/stripe', async (req: Request, res: Response) => {

    try {
        const sig = req.headers['stripe-signature'] as string;

        if(!sig) {
            console.error('No Stripe signature found in headers');
            return res.status(400).json({ error: 'No signature found'});
        }

        // Verify webhook signature and construct event 
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch(error: any) {
            console.error('Webhook signature verification failed:', error.message);
            return res.status(400).json({ error: `Webhook signature verification failed: ${error.message}`});
        }

        // Handle the event based on its type
        switch(event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Acknowledge receipt of the event
        res.json({ received: true, eventType: event.type });
    } catch(error: any){
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook'});
    }
});



// Handler for successful payments 
// async function handlePaymentIntentSucceeded(event: any) {
//     try {
//         const paymentIntent = event.data.object;
//         console.log(`PaymentIntent ${paymentIntent.id} succeeded for amount ${paymentIntent.amount}`);
        
//         // Find and update the transacion 
//         const updatedTransaction = await prisma.transaction.updateMany({
//             where: {
//                 stripePaymentId: paymentIntent.id,
//                 status: 'PAYMENT_PENDING' // Ensure we only update pending transactions 
//             },
//             data: {
//                 status: 'FUNDED',
//             }
//         });

//         if (updatedTransaction.count === 0) {
//             console.error('No transaction found for PaymentIntent:', paymentIntent.id);
//         } else {
//             console.log('Transaction marked as FUNDED for PaymentIntent:', paymentIntent.id);
//             // TODO: In Week 3 - This where you'll trigger the Flutterwave payout
//         }
        
        
//     } catch(error) {
//         console.error('Error handling payment_intent.succeeded:', error);
//         throw error; // Re-throw to be caught by the main handler
//     }
// }

async function handlePaymentIntentSucceeded(event: any) {
    const paymentIntent = event.data.object;
    const prismaTx = await prisma.$transaction(async (tx) => {
        // 1. Find the transaction within a database transaction for safety
        const transaction = await tx.transaction.findFirst({
            where: {
                stripePaymentId: paymentIntent.id,
                status: 'PAYMENT_PENDING'
            },
            include: {
                recipient: true
            }
        });

        if(!transaction) {
            console.warn(`Webhook: No pending transaction found for ${paymentIntent.id}. Might be already processed.`);
            return null;
        }

        // 2. The "Waiter's" job is done: mark as FUNDED.
        await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'FUNDED'}
        });
        console.log(`Transaction ${transaction.id} status updated to FUNDED.`);

        return transaction;
    });

    // 3. The "Waiter" puts the ticket on the line.
    // We do this OUTSIDE the database transaction.
    if(prismaTx) {
        initiateAutomaticPayout(prismaTx);
    }
}

async function initiateAutomaticPayout(transaction: any) {
    console.log(`Event: Payput initiated for transaction ${transaction.id}`);

    try {
        // Lock the transaction 
        await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'PAYOUT_PENDING'}
        });

        // Get the active payout provider from the manager 
        const payoutProvider = payoutManager.getProvider();

        // The "Chef" starts cooking 
        const result = await payoutProvider.initiatePayout(transaction);

        // Update with the final result 
        await prisma.transaction.update({
            where: { id: transaction.id},
            data: {
                status: result.success ? 'COMPLETED' : 'PAYOUT_FAILED',
                provider: process.env.PAYOUT_PROVIDER || 'mock',
                providerPayoutRef: result.providerReference
            } 
        });
        console.log(`Payout for transaction ${transaction.id} finished with status: ${result.success ? 'COMPLETED' : 'PAYOUT_FAILED'}`)
    } catch(error: any) {
        console.error(`Criticaal error during payout for tx ${transaction.id}:`, error);
        await prisma.transaction.update({
            where: { id: transaction.id},
            data: {status: `PAYOUT_FAILED`}
        })
    }
}

// Handler for failed payments
async function handlePaymentIntentFailed(event: any) {
    try {
       const paymentIntent = event.data.object;
       console.error(`Payment Intent ${paymentIntent.id} failed`);

       // Update transaction status to indicate failure 
       await prisma.transaction.updateMany({
        where: {
            stripePaymentId: paymentIntent.id
        },
        data: {
            status: 'FAILED' // Use the enum value
        }
       });
    } catch(error) {
        console.error('Error handling payment_intent.payment_failed:', error);
        throw error;
    }
}




export default router;

