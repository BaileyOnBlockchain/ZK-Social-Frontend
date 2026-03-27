# ZK Social Protocol — Frontend Library

TypeScript utility layer for a privacy-first, decentralised social protocol on Base. Covers contract ABIs, wallet integration, market data, IPFS caching, identity verification, reputation scoring, scam reporting, and gasless transactions.

> Built by [@BlockchainBail](https://x.com/BlockchainBail)

---

## Overview

This library sits between the ZK smart contracts and the frontend application. It handles all contract interactions, off-chain data fetching, caching, and identity scoring — so the UI layer stays clean.

---

## Module Breakdown

### `lib/contracts.ts`
Central contract address registry and ABI exports. All contract addresses are zero-address placeholders — populate with deployed addresses post-deployment. Exports `CONTRACT_ADDRESSES`, `PRIV_TOKEN_ABI`, `SOCIAL_NETWORK_ABI`, `STAKING_VAULT_ABI`, `SCAM_REPORTS_ABI`.

### `lib/wagmi-config.ts`
RainbowKit + wagmi configuration targeting Base mainnet. Wallet priority: injected → Coinbase → MetaMask → Rainbow → WalletConnect. Injected and Coinbase wallets prioritised as they don't depend on WalletConnect relay. Includes mobile browser detection utility.

### `lib/prices.ts`
Multi-source crypto price fetcher with automatic fallback chain: CoinGecko → Jupiter → Binance → Coinbase → static fallback. Per-request AbortController with configurable timeouts. Covers 80+ tokens with pre-seeded fallback prices. Symbol normalisation and deduplication built in.

### `lib/tokens.ts`
Token registry with CoinGecko ID mapping, decimals, and name for market data fetching.

### `lib/prisma.ts`
Prisma client singleton with connection pooling and graceful shutdown on process exit. Development query logging enabled automatically.

### `lib/live-users.ts`
localStorage-based live user tracking. Registers active users by wallet address and current page, cleans up stale entries after 30 seconds, exposes per-page and global user counts. Designed to be swapped for WebSocket/Supabase Realtime in production.

### `lib/paymaster.ts`
EIP-4337 Base Paymaster integration for gasless tipping. First 5 tips per user are gasless. Encodes paymaster input via `approveTransaction`, constructs Base-compatible `customData` for Account Abstraction. Tip count tracked in localStorage.

### `lib/cache/ipfs-cache.ts`
IPFS feed caching layer using web3.storage. Posts are bundled into `FeedCache` objects and uploaded to IPFS; CID stored locally. Falls back to localStorage if IPFS upload fails. 5-minute TTL. `FeedCacheManager` class wraps memory cache + IPFS + localStorage in a unified interface with invalidation support.

### `lib/services/gitcoin-passport.ts`
Gitcoin Passport score fetching with 7-day localStorage cache. Fetches stamps + scorer API in sequence. Falls back to Human Passport API if Gitcoin unavailable. Extracts KYC status from BrightID, Civic, Idena, Holonym, Worldcoin stamps. Returns structured `PassportScore` with source attribution.

### `lib/services/rating-service.ts`
Unified 0-100 user rating from four on-chain sources: activity (posts, 30pts), contributions (post quality + staking, 30pts), verification (verified badge, 20pts), engagement (tips received + followers, 20pts). Colour interpolates red→green. Levels: New → Beginner → Intermediate → Advanced → Expert → Elite. Mock rating calculator included for development/preview.

### `lib/services/reputation-service.ts`
On-chain reputation with level progression. Points from posts (10pt each), tips received (1pt per 0.01 ETH), engagement proxy (5pt/post), staking (2pt per 1000 PRIV), followers (1pt per 10). 250 reputation per level, progress percentage to next level. Gracefully falls back to posts-service if ABI mismatch.

### `lib/services/scam-reports-storage.ts`
Self-contained localStorage scam reporting system with optional on-chain sync. Submits reports, tracks trust scores (0-100), calculates red/green flags from wallet age, staking, KYC, activity, and report history. Green flags: staking duration, wallet maturity, passport score, KYC. Red flags: reports, new wallet, no KYC, low activity. Exports/imports data as JSON. Designed to sync to `ScamReports.sol` when connected.

### `lib/analysis/wallet-analysis.ts`
On-chain wallet analysis combining: staking data from `StakingVault`, trust score and reports from `ScamReports`, wallet age from Basescan API, Gitcoin Passport score from scorer API. Returns structured `WalletAnalysis` with all factors plus display strings.

### `scripts/run-full-verification.ts`
Hardhat test runner with structured JSON reporting. Runs the full flow test suite, parses pass/fail/skip counts, checks feature flags from output strings, saves `test-report.json`. Exits non-zero on any failures.

---

## Stack

| Layer | Tech |
|---|---|
| Language | TypeScript |
| Blockchain | Base (Ethereum L2) |
| Web3 | wagmi, viem, RainbowKit |
| Identity | Gitcoin Passport, Human Passport |
| Storage | IPFS (web3.storage), localStorage |
| ORM | Prisma |
| Testing | Hardhat |

---

## Environment Variables

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_WEB3_STORAGE_TOKEN=
NEXT_PUBLIC_GITCOIN_PASSPORT_API_KEY=
NEXT_PUBLIC_GITCOIN_SCORER_ID=
NEXT_PUBLIC_GITCOIN_API_KEY=
NEXT_PUBLIC_HUMAN_PASSPORT_API_KEY=
NEXT_PUBLIC_BASESCAN_API_KEY=
SEMAPHORE_ADDRESS=
PRIVNET_SEMAPHORE_ADDRESS=
PRIV_TOKEN_ADDRESS=
STAKING_VAULT_ADDRESS=
EZKL_VERIFIER_ADDRESS=
PRIVATE_KEY=
NETWORK=baseSepolia
DATABASE_URL=
```

---

## File Structure

```
lib/
├── contracts.ts              ← ABIs + contract addresses
├── wagmi-config.ts           ← RainbowKit/wagmi setup
├── prices.ts                 ← Multi-source price fetcher
├── tokens.ts                 ← Token registry
├── prisma.ts                 ← Prisma singleton
├── live-users.ts             ← Active user tracking
├── paymaster.ts              ← Gasless tip transactions
├── cache/
│   └── ipfs-cache.ts         ← IPFS feed caching
├── services/
│   ├── gitcoin-passport.ts   ← Identity verification
│   ├── rating-service.ts     ← 0-100 user rating
│   ├── reputation-service.ts ← Level/reputation system
│   └── scam-reports-storage.ts ← Trust scoring
└── analysis/
    └── wallet-analysis.ts    ← On-chain wallet analysis

scripts/
└── run-full-verification.ts  ← Test runner + reporter
```

---

## Author

Built by [@BlockchainBail](https://x.com/BlockchainBail) — part of a larger ZK social protocol. Smart contracts in a separate repo.
