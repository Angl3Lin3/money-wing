import type { Network } from '../services/api';

// Same prefixes as the backend (backend/src/utils/phone.ts). Used to
// pre-select the network as the user types. The backend has the final say.
const NETWORK_PREFIXES: Record<Network, string[]> = {
  MTN: ['76', '77', '78'],
  Airtel: ['70', '74', '75'],
};

// Guess the network from a number typed in any common format.
export function guessNetwork(phone: string): Network | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('256')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  const prefix = digits.slice(0, 2);
  for (const network of Object.keys(NETWORK_PREFIXES) as Network[]) {
    if (NETWORK_PREFIXES[network].includes(prefix)) return network;
  }
  return null;
}

// "+256772123456" -> "+256 772 123 456"
export function formatPhone(phone: string): string {
  const m = /^\+256(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `+256 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
