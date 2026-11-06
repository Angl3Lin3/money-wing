import type { TransactionStatus } from '../services/api';

// What each transfer status means, in words a customer understands.
export const STATUS_INFO: Record<TransactionStatus, { label: string; color: string; background: string }> = {
  DRAFT: { label: 'Awaiting payment', color: '#92400E', background: '#FEF3C7' },
  PAYMENT_PENDING: { label: 'Payment processing', color: '#1E40AF', background: '#DBEAFE' },
  FUNDED: { label: 'Paid', color: '#1E40AF', background: '#DBEAFE' },
  PAYOUT_PENDING: { label: 'Sending to Uganda', color: '#1E40AF', background: '#DBEAFE' },
  COMPLETED: { label: 'Delivered', color: '#166534', background: '#DCFCE7' },
  PAYOUT_FAILED: { label: 'Delivery failed', color: '#B91C1C', background: '#FEE2E2' },
  FAILED: { label: 'Failed', color: '#B91C1C', background: '#FEE2E2' },
  CANCELLED: { label: 'Cancelled', color: '#4B5563', background: '#E5E7EB' },
};

// A short reference customers can quote, from the transfer's id.
export const shortReference = (id: string) => `MW-${id.slice(0, 8).toUpperCase()}`;
