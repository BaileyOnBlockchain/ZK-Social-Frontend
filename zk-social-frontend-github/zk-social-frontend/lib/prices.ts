export type CryptoSymbol = string;

export const SYMBOL_TO_COINGECKO: Record<CryptoSymbol, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple', ADA: 'cardano',
  AVAX: 'avalanche-2', DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink', UNI: 'uniswap', LTC: 'litecoin',
  ATOM: 'cosmos', ALGO: 'algorand', VET: 'vechain', FIL: 'filecoin', TRX: 'tron', ETC: 'ethereum-classic', XLM: 'stellar',
  ICP: 'internet-computer', NEAR: 'near', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', INJ: 'injective-protocol',
  SEI: 'sei-network', TIA: 'celestia', BLUR: 'blur', JUP: 'jupiter-exchange-solana', PENDLE: 'pendle', WLD: 'worldcoin-wld',
  STRK: 'starknet', PIXEL: 'pixels', PORTAL: 'portal', PYTH: 'pyth-network', WIF: 'dogwifcoin', FLOKI: 'floki', PEPE: 'pepe',
  SHIB: 'shiba-inu', DOGE: 'dogecoin', BONK: 'bonk', USDC: 'usd-coin', USDT: 'tether', DAI: 'dai', FRAX: 'frax', LUSD: 'liquity-usd',
  DEGEN: 'degen-base', BRETT: 'brett-base', BASE: 'base', MOOD: 'moody', HIGHER: 'higher', PRIME: 'echelon-prime', AI: 'sleepless-ai',
  XAI: 'xai-blockchain', MANTA: 'manta-network', ALT: 'altlayer', JTO: 'jito-governance-token', BOME: 'book-of-meme', ENA: 'ethena',
  W: 'wormhole', TAO: 'bittensor', FET: 'fetch-ai', AGIX: 'singularitynet', OCEAN: 'ocean-protocol', RNDR: 'render-token', AKT: 'akash-network',
  AIOZ: 'aioz-network'
};

export const FALLBACK_PRICES: Record<CryptoSymbol, number> = {
  BTC: 100000, ETH: 4000, SOL: 220, BNB: 700, XRP: 0.65, ADA: 0.55, AVAX: 40, DOT: 8, MATIC: 1.0, LINK: 18, UNI: 12, LTC: 100,
  ATOM: 10, ALGO: 0.25, VET: 0.04, FIL: 8, TRX: 0.15, ETC: 30, XLM: 0.13, ICP: 15, NEAR: 8, APT: 10, ARB: 1.5, OP: 3.0, SUI: 2.2,
  INJ: 30, SEI: 1.0, TIA: 13, BLUR: 0.5, JUP: 1.5, PENDLE: 8, WLD: 6, STRK: 2.0, PIXEL: 0.9, PORTAL: 2.2, PYTH: 0.8, WIF: 4.5,
  FLOKI: 0.0003, PEPE: 0.00002, SHIB: 0.00003, DOGE: 0.4, BONK: 0.00004, USDC: 1, USDT: 1, DAI: 1, FRAX: 1, LUSD: 1, DEGEN: 0.08,
  BRETT: 0.12, BASE: 0.0004, MOOD: 0.00015, HIGHER: 0.00015, PRIME: 18, AI: 1.5, XAI: 1.0, MANTA: 2.8, ALT: 0.7, JTO: 4.5,
  BOME: 0.00002, ENA: 1.4, W: 1.0, TAO: 550, FET: 2.8, AGIX: 0.4, OCEAN: 1.0, RNDR: 12, AKT: 5, AIOZ: 0.9
};

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getFallback(symbol: CryptoSymbol): number {
  return FALLBACK_PRICES[symbol] ?? 1000;
}

export function normalizeSymbols(symbols: CryptoSymbol[]): CryptoSymbol[] {
  return Array.from(new Set(symbols.map((s) => s.toUpperCase())));
}


// Fetch price in USD from multiple sources with timeout and fallback
export async function fetchPriceUSD(symbolInput: CryptoSymbol): Promise<{ price: number; source: string }> {
  const symbol = (symbolInput || 'ETH').toUpperCase();

  // 1) CoinGecko
  const coingeckoId = SYMBOL_TO_COINGECKO[symbol as CryptoSymbol];
  if (coingeckoId) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'privnet/1.0' },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(to);
      if (res.ok) {
        const json = await res.json();
        const v = json?.[coingeckoId]?.usd;
        if (typeof v === 'number' && v > 0) return { price: roundPrice(v), source: 'coingecko' };
      }
    } catch {
      // continue to next source
    }
  }

  // 2) Jupiter (great for SOL)
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${encodeURIComponent(symbol)}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(to);
    if (res.ok) {
      const json = await res.json();
      const v = json?.data?.[symbol]?.price;
      if (typeof v === 'number' && v > 0) return { price: roundPrice(v), source: 'jupiter' };
    }
  } catch {
    // continue
  }

  // 3) Binance (USDT as USD proxy)
  try {
    const binanceSymbol = `${symbol}USDT`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(to);
    if (res.ok) {
      const json = await res.json();
      const v = parseFloat(json?.price);
      if (!Number.isNaN(v) && v > 0) return { price: roundPrice(v), source: 'binance' };
    }
  } catch {
    // continue
  }

  // 4) Coinbase
  try {
    const pair = `${symbol}-USD`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.exchange.coinbase.com/products/${pair}/ticker`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(to);
    if (res.ok) {
      const json = await res.json();
      const v = parseFloat(json?.price);
      if (!Number.isNaN(v) && v > 0) return { price: roundPrice(v), source: 'coinbase' };
    }
  } catch {
    // final fallback below
  }

  // Fallback
  return { price: getFallback(symbol), source: 'fallback' };
}


