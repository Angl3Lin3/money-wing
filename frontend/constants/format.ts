// Display helpers for money.

const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// 1234.5 -> "$1,234.50"
export function formatCad(amount: number): string {
  const [whole, cents] = amount.toFixed(2).split(".");
  return `$${withCommas(whole)}.${cents}`;
}

// 274400 -> "274,400 UGX"
export function formatUgx(amount: number): string {
  return `${withCommas(Math.floor(amount).toString())} UGX`;
}
