// Calls for the developer area. Uses the developer login, not the customer one.
import axios from 'axios';
import { API_BASE_URL } from '../app/constants/config';
import { getDevToken } from './auth-storage';
import type { Network, TransactionStatus } from './api';

const adminApi = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

adminApi.interceptors.request.use(async (config) => {
  const token = await getDevToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Overview {
  server: { status: string; startedAt: string; uptimeSeconds: number; nodeVersion: string; environment: string };
  database: { ok: boolean; latencyMs?: number; error?: string };
  config: {
    jwtSecret: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    payoutProvider: string;
    emailProvider: string;
    adminCount: number;
    pricing: { exchangeRate: number; feePercent: number; minCad: number; maxCad: number };
  };
  totals: {
    users: { total: number; verified: number; pending: number; newLast24h: number };
    recipients: number;
    transfers: {
      total: number;
      newLast24h: number;
      byStatus: Partial<Record<TransactionStatus, { count: number; cadAmount: number }>>;
      paidVolumeCad: number;
    };
  };
}

export interface AdminUser {
  id: string;
  email: string;
  status: string;
  kycStatus: string | null;
  createdAt: string;
  _count: { recipients: number; transactions: number };
}

export interface AdminTransaction {
  id: string;
  cadAmount: number;
  fee: number;
  exchangeRate: number;
  ugxAmount: number;
  status: TransactionStatus;
  provider: string | null;
  stripePaymentId: string | null;
  providerPayoutRef: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string };
  recipient: { name: string; phoneNumber: string; network: Network };
}

export interface Activity {
  startedAt: string;
  requests: { time: string; method: string; path: string; status: number; durationMs: number }[];
  errors: { time: string; message: string }[];
  summary: { requestsLastHour: number; serverErrorsLastHour: number; averageMsLastHour: number };
}

export interface Pricing {
  exchangeRate: number;
  feePercent: number;
  minCad: number;
  maxCad: number;
}

export interface PricingInfo {
  pricing: Pricing;
  source: 'owner' | 'default';
  updatedAt: string | null;
  updatedBy: string | null;
}

export type TransferActionName =
  | 'simulate_payment'
  | 'start_payout'
  | 'mark_delivered'
  | 'mark_failed'
  | 'retry_payout'
  | 'cancel';

export interface TransferActionRule {
  action: TransferActionName;
  from: TransactionStatus[];
  to: TransactionStatus;
  needs: 'reference' | 'note' | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  targetId: string | null;
  details: Record<string, any> | null;
  actorEmail: string;
  createdAt: string;
}

export interface OutboxEmail {
  id: number;
  time: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed' | 'not sent (no email service)';
  error?: string;
  text?: string;
}

export interface TransferFilters {
  q?: string;
  status?: TransactionStatus;
  from?: string; // ISO date-time
  to?: string;   // ISO date-time
}

const cleanFilters = (f: TransferFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''));

export const adminAPI = {
  emails: async (): Promise<{ configured: boolean; setup: string; emails: OutboxEmail[] }> =>
    (await adminApi.get('/admin/emails')).data,

  // Owner controls
  settings: async (): Promise<PricingInfo> => (await adminApi.get('/admin/settings')).data,
  savePricing: async (pricing: Pricing): Promise<PricingInfo> =>
    (await adminApi.put('/admin/settings/pricing', pricing)).data,
  transferActions: async (): Promise<TransferActionRule[]> => (await adminApi.get('/admin/transfer-actions')).data,
  doTransferAction: async (id: string, action: TransferActionName, extra: { note?: string; reference?: string } = {}) =>
    (await adminApi.post(`/admin/transactions/${id}/action`, { action, ...extra })).data as { id: string; status: TransactionStatus },
  audit: async (targetId?: string): Promise<AuditEntry[]> =>
    (await adminApi.get('/admin/audit', { params: targetId ? { targetId } : {} })).data.entries,

  overview: async (): Promise<Overview> => (await adminApi.get('/admin/overview')).data,
  users: async (): Promise<AdminUser[]> => (await adminApi.get('/admin/users')).data.users,
  // `after`: the last transfer shown, to load the next page.
  transactions: async (
    filters: TransferFilters = {},
    after?: { createdAt: string; id: string }
  ): Promise<{ transactions: AdminTransaction[]; total: number; hasMore: boolean }> =>
    (
      await adminApi.get('/admin/transactions', {
        params: { ...cleanFilters(filters), ...(after && { before: after.createdAt, beforeId: after.id }) },
      })
    ).data,

  // The spreadsheet (CSV) text for the same filters.
  exportTransactions: async (filters: TransferFilters = {}): Promise<{ csv: string; filename: string }> => {
    const response = await adminApi.get('/admin/transactions/export', {
      params: cleanFilters(filters),
      responseType: 'text',
      transformResponse: (data) => data, // keep it as plain text
      timeout: 60000,
    });
    const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] ?? '');
    return { csv: response.data, filename: match?.[1] ?? 'moneywing-transfers.csv' };
  },

  // The spreadsheet (CSV) text for just the selected transfers.
  exportSelectedTransactions: async (ids: string[]): Promise<{ csv: string; filename: string }> => {
    const response = await adminApi.post('/admin/transactions/export', { ids }, {
      responseType: 'text',
      transformResponse: (data) => data,
      timeout: 60000,
    });
    const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] ?? '');
    return { csv: response.data, filename: match?.[1] ?? 'moneywing-transfers.csv' };
  },
  activity: async (): Promise<Activity> => (await adminApi.get('/admin/activity')).data,

  // Quick checks that the main parts of the API answer. Each returns how long it took.
  checks: [
    { name: 'Server is reachable', run: () => adminApi.get('/') },
    { name: 'Login service answers', run: () => adminApi.post('/auth/login', {}).catch((e) => {
        // An empty login *should* be rejected with 400: that means the route works.
        if (e?.response?.status === 400) return e.response;
        throw e;
      }) },
    { name: 'Quotes work (rate & fee)', run: () => adminApi.get('/transaction/quote', { params: { cadAmount: '100' } }) },
    { name: 'Recipients service answers', run: () => adminApi.get('/transaction/recipients') },
    { name: 'Database answers', run: async () => {
        const r = await adminApi.get('/admin/overview');
        if (!r.data.database.ok) throw new Error(r.data.database.error ?? 'Database unreachable');
        return r;
      } },
  ],
};
