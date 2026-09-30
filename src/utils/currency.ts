export type DisplayCurrency = 'USD' | 'INR';

/** Indicative conversion used only for the dashboard currency toggle. Books stay in INR. */
export const INR_PER_USD = 83.5;

export function convertFromInr(amountInr: number, currency: DisplayCurrency): number {
  if (!Number.isFinite(amountInr)) return 0;
  return currency === 'USD' ? amountInr / INR_PER_USD : amountInr;
}

export function formatMoney(amountInr: number, currency: DisplayCurrency): string {
  const amount = convertFromInr(amountInr, currency);
  const symbol = currency === 'USD' ? '$' : '₹';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (currency === 'INR') {
    if (abs >= 10000000) return `${sign}${symbol}${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}${symbol}${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}K`;
    return `${sign}${symbol}${abs.toFixed(2)}`;
  }

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(2)}`;
}

export function formatSignedMoney(amountInr: number, currency: DisplayCurrency): string {
  const formatted = formatMoney(amountInr, currency);
  if (amountInr > 0 && !formatted.startsWith('+')) {
    return `+${formatted}`;
  }
  return formatted;
}

export function chartAxisMax(values: number[], fallback = 4): number {
  const max = Math.max(0, ...values.filter(value => Number.isFinite(value)));
  if (max <= 0) return fallback;
  const padded = max * 1.25;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  return Math.ceil(padded / magnitude) * magnitude;
}
