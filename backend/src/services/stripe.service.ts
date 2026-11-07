import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Warn instead of crashing, so signup/login work before Stripe is set up.
if(!stripeSecretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY is not set. Payment endpoints will fail.');
}

export const stripe = new Stripe(stripeSecretKey || 'sk_test_not_configured')

export class StripeService {
    // amountCents: the exact amount in cents, as stored (Stripe also uses cents).
    async createPaymentIntent(amountCents: number, currency: string = 'cad') {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountCents,
                currency: currency,
                // payment_method_types: ['card'],
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                },
                metadata: {
                    // We'll add transaction ID here later
                }
            });

            return paymentIntent;
        } catch(error: any) {
            console.error('Stripe payment intent error:', error);
            throw new Error('Failed to create payment intent');
        }
    }
}

