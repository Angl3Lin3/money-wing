
import express, { Request, Response } from 'express';
import { recordStatusChange } from '../services/status-history.service';
import { sendEmailInBackground } from '../services/email.service';
import { transferDeliveredEmail, transferFailedEmail } from '../services/email.templates';
import { PrismaClient, Transaction } from '@prisma/client';
import { stripe } from '../services/stripe.service'; // Import your existing Stripe instance
import { payoutManager } from '../services/payout.manager';

const router = express.Router();
const prisma = new PrismaClient();

// Get the webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

if(!webhookSecret) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET is not set. Stripe webhooks will be rejected.');
}


// Webhook endpoint - must use raw body parser
router.post('/stripe', async (req: Request, res: Response) => {

    try {
        if(!webhookSecret) {
            return res.status(500).json({ error: 'Stripe webhooks are not configured on this server'});
        }

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
        await recordStatusChange(transaction.id, 'PAYMENT_PENDING', 'FUNDED', 'system', 'transfer.payment_received', { source: 'stripe' }, tx);
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
        await recordStatusChange(transaction.id, 'FUNDED', 'PAYOUT_PENDING', 'system', 'transfer.payout_started', { source: 'payout' });

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
        await recordStatusChange(
            transaction.id, 'PAYOUT_PENDING', result.success ? 'COMPLETED' : 'PAYOUT_FAILED', 'system',
            result.success ? 'transfer.payout_completed' : 'transfer.payout_failed',
            { source: 'payout', ...(result.providerReference && { reference: result.providerReference }) }
        );
        notifyCustomer(transaction.id, result.success ? 'delivered' : 'failed', result.providerReference);
        console.log(`Payout for transaction ${transaction.id} finished with status: ${result.success ? 'COMPLETED' : 'PAYOUT_FAILED'}`)
    } catch(error: any) {
        console.error(`Criticaal error during payout for tx ${transaction.id}:`, error);
        await prisma.transaction.update({
            where: { id: transaction.id},
            data: {status: `PAYOUT_FAILED`}
        })
        await recordStatusChange(transaction.id, 'PAYOUT_PENDING', 'PAYOUT_FAILED', 'system', 'transfer.payout_failed', { source: 'payout' }).catch(() => {});
        notifyCustomer(transaction.id, 'failed');
    }
}

// Handler for failed payments
async function handlePaymentIntentFailed(event: any) {
    try {
       const paymentIntent = event.data.object;
       console.error(`Payment Intent ${paymentIntent.id} failed`);

       // Update transaction status to indicate failure 
       const affected = await prisma.transaction.findMany({
        where: { stripePaymentId: paymentIntent.id },
        select: { id: true, status: true }
       });
       await prisma.transaction.updateMany({
        where: {
            stripePaymentId: paymentIntent.id
        },
        data: {
            status: 'FAILED' // Use the enum value
        }
       });
       for (const t of affected) {
        await recordStatusChange(t.id, t.status, 'FAILED', 'system', 'transfer.payment_failed', { source: 'stripe' });
       }
    } catch(error) {
        console.error('Error handling payment_intent.payment_failed:', error);
        throw error;
    }
}




// Email the customer about an automatic payout's outcome (never blocks).
async function notifyCustomer(transactionId: string, outcome: 'delivered' | 'failed', reference?: string | null) {
    try {
        const t = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: { select: { email: true } }, recipient: { select: { name: true, phoneNumber: true, network: true } } }
        });
        if (!t) return;
        sendEmailInBackground(outcome === 'delivered' ? transferDeliveredEmail(t.user.email, t, reference) : transferFailedEmail(t.user.email, t));
    } catch (error) {
        console.error('Could not email the customer about their payout:', error);
    }
}

export default router;

