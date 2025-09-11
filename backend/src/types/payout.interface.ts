// This is the key to making the provider pluggable. 
// We'll define a contract that any payout service we use must follow.

import { Recipient , Transaction } from '@prisma/client';
export interface PayoutResult {
    success: boolean;
    providerReference: string; // The ID from the provider (e.g., Flutterwave's transaction ID)
    error?: string;
}

// This is the contract. Any payout service we create must have this method.
export interface IPayoutService {
    initiatePayout(transaction: Transaction & { recipient: Recipient}): Promise<PayoutResult>;

}