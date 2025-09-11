import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if(!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not defined');
}

export const stripe = new Stripe(stripeSecretKey)

export class StripeService {
    async createPaymentIntent(amount: number, currency: string = 'cad') {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents 
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

