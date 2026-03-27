// lib/tokens.ts
// Token definitions for market data fetching

export interface TokenInfo {
  symbol: string;
  name: string;
  coingeckoId: string;
  decimals: number;
}

export const TOKENS: Record<string, TokenInfo> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    coingeckoId: 'ethereum',
    decimals: 18,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    decimals: 8,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    coingeckoId: 'usd-coin',
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether',
    coingeckoId: 'tether',
    decimals: 6,
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai',
    coingeckoId: 'dai',
    decimals: 18,
  },
  PRIV: {
    symbol: 'PRIV',
    name: 'Priv Token',
    coingeckoId: '', // Add CoinGecko ID post-launch
    decimals: 18,
  },
};
