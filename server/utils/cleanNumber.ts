/**
 * Universal safe numeric parser and live instrument price lookup.
 * Strips commas, currency symbols (₹, $), and whitespace before numeric conversion.
 * Never truncates comma-formatted strings (e.g. "2,954.49" -> 2954.49, not 2).
 */

export function parseCleanNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const str = String(val).replace(/[₹$,\s]/g, '').trim();
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const LIVE_PRICE_DIRECTORY: Record<string, number> = {
  'RELIANCE': 2954.49,
  'RELIANCEFUT': 2980.50,
  'TCS': 4141.05,
  'TCSFUT': 4210.80,
  'NIFTY50': 24850.20,
  'NIFTY': 24850.20,
  'NIFTY 50': 24850.20,
  'BANKNIFTY': 51200.40,
  'BANKNIFTYFUT': 51200.40,
  'HDFCBANK': 1680.00,
  'HDFCBANKFUT': 1640.25,
  'TATASTEEL': 154.20,
  'INFY': 1610.40,
  'USDINR': 83.92,
  'USD/INR': 83.92,
  'GOLDFUT': 158496.61,
  'GOLD': 158496.61,
  'SILVERFUT': 2378.26,
  'SILVER': 2378.26,
  'COPPERFUT': 842.15,
  'COPPER': 842.15,
  'CRUDEOILFUT': 6184.00,
  'CRUDEOIL': 6184.00,
  'NATURALGASFUT': 214.60,
  'NATURALGAS': 214.60,
  'SENSEX': 81332.72,
  'BTCUSDT': 234500.00,
  'ETHUSDT': 185000.00,
  'SOLUSDT': 12450.00,
};

export function liveLtpLookup(symbol?: string): number {
  if (!symbol) return 0;
  const raw = String(symbol).toUpperCase().trim();
  const clean = raw.replace(/^(NSE|BSE|MCX|NFO|FX|CRYPTO|TVC|BINANCE):/i, '').trim();
  const normalized = clean.replace(/[\s\-_./]/g, '');

  if (LIVE_PRICE_DIRECTORY[raw]) return LIVE_PRICE_DIRECTORY[raw];
  if (LIVE_PRICE_DIRECTORY[clean]) return LIVE_PRICE_DIRECTORY[clean];
  if (LIVE_PRICE_DIRECTORY[normalized]) return LIVE_PRICE_DIRECTORY[normalized];

  const baseKey = normalized.replace(/(FUT|EQ|PERP)$/i, '');
  if (LIVE_PRICE_DIRECTORY[baseKey]) return LIVE_PRICE_DIRECTORY[baseKey];

  for (const [k, price] of Object.entries(LIVE_PRICE_DIRECTORY)) {
    if (normalized.includes(k) || k.includes(normalized)) {
      return price;
    }
  }

  return 0;
}

export function updateLivePrice(symbol: string, price: number): void {
  if (!symbol || !price || isNaN(price) || price <= 0) return;
  const raw = String(symbol).toUpperCase().trim();
  const clean = raw.replace(/^(NSE|BSE|MCX|NFO|FX|CRYPTO|TVC|BINANCE):/i, '').trim();
  const normalized = clean.replace(/[\s\-_./]/g, '');
  LIVE_PRICE_DIRECTORY[raw] = price;
  LIVE_PRICE_DIRECTORY[clean] = price;
  LIVE_PRICE_DIRECTORY[normalized] = price;
}

export function updateLivePrices(quotes: Record<string, number> | Array<{ symbol: string; ltp?: number; price?: number }>): void {
  if (!quotes) return;
  if (Array.isArray(quotes)) {
    for (const q of quotes) {
      const p = parseCleanNumber(q.ltp ?? q.price);
      if (q.symbol && p > 0) updateLivePrice(q.symbol, p);
    }
  } else if (typeof quotes === 'object') {
    for (const [sym, val] of Object.entries(quotes)) {
      const p = parseCleanNumber(val);
      if (sym && p > 0) updateLivePrice(sym, p);
    }
  }
}

export function getAllLivePrices(): Record<string, number> {
  return { ...LIVE_PRICE_DIRECTORY };
}

