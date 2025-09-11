import { IPayoutService } from "types/payout.interface";
import { MockPayoutService } from "./mock-payout.service";

class PayoutManager {
    private provider: IPayoutService;

    constructor() {
        const providerName = process.env.PAYOUT_PROVIDER || 'mock';

        console.log(`Initializing payout service with provider: ${providerName}`);

        if(providerName === 'flutterwave') {
            // this.provider = new FlutterwaveService();
            // For now, we fall back to mock 
            this.provider = new MockPayoutService();
        } else {
            this.provider = new MockPayoutService();
        }
    }

    // Expose the active provider's methods 
    getProvider(): IPayoutService{
        return this.provider;
    }
}

export const payoutManager = new PayoutManager();