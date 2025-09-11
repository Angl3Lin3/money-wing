import { Transaction , Recipient } from '@prisma/client';
import { IPayoutService , PayoutResult } from "../types/payout.interface";

export class MockPayoutService implements IPayoutService {
    async initiatePayout(
        transaction: Transaction & { recipient: Recipient}
    ): Promise<PayoutResult> {
        console.log(`[Mock Payout] Initiating payout of ${transaction.ugxAmount} UGX for transaction ${transaction.id}`);

        // Simulate network delay 
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate a 90% success rate 
        if(Math.random() < 0.9) {
            const mockReference = `MOCK_PAYOUT_${Date.now()}`;
            console.log(`[Mock Payout] Success for transaction ${transaction.id}. Ref: ${mockReference}`);
            return { success: true, providerReference: mockReference};
        } else {
            const error = 'Mock Provider: Insufficient float or invalid recipient.';
            console.error(`[Mock Payout] Failure for transaction ${transaction.id}: ${error}`);
            return { success: false, providerReference: 'N/A', error: error};
        }
    }
}