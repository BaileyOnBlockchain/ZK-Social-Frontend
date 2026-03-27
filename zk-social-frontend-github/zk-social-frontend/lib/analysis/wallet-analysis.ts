// File: lib/analysis/wallet-analysis.ts (or wherever you moved it)
// This file implements the analyzeWallet function to fetch real on-chain and off-chain data
// for wallet stats. Add your API keys to .env.local as shown below.
// Make sure to deploy contracts and update CONTRACT_ADDRESSES in lib/contracts.ts
// Get Basescan API key from https://basescan.org/myapikey
// Get Gitcoin Scorer ID and API key from https://scorer.gitcoin.co/ (create scorer and API key)

import { PublicClient } from 'viem';
import { CONTRACT_ADDRESSES, SCAM_REPORTS_ABI, STAKING_VAULT_ABI } from '@/lib/contracts';

export interface WalletAnalysis {
  hasStaking: boolean;
  stakingAmount: bigint;  // Fixed: property, not method
  stakingDuration: number;  // Fixed: property (days), not method
  isNewWallet: boolean;
  hasActivity: boolean;
  trustScore: number;
  reports: number;
  walletAge: string;
  passportScore: string;
  staking: string;
}

export async function analyzeWallet(
  wallet: string,
  publicClient: PublicClient
): Promise<WalletAnalysis> {
  try {
    // Fetch trust score and reports from ScamReports contract
    const trustScore = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.SCAM_REPORTS,
      abi: SCAM_REPORTS_ABI,
      functionName: 'getTrustScore',
      args: [wallet as `0x${string}`],
    }) as {
      wallet: `0x${string}`;
      score: bigint;
      totalReports: bigint;
      verifiedReports: bigint;
      lastUpdated: bigint;
    };

    const reports = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.SCAM_REPORTS,
      abi: SCAM_REPORTS_ABI,
      functionName: 'getReportsForAddress',
      args: [wallet as `0x${string}`],
    }) as any[]; // Report[]

    // Fetch staking info
    const stake = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.STAKING_VAULT,
      abi: STAKING_VAULT_ABI,
      functionName: 'stakes',
      args: [wallet as `0x${string}`],
    }) as [bigint, bigint, bigint]; // [amount, startTime, rewards]

    const stakingAmount = stake[0];
    const startTime = stake[1];
    const hasStaking = stakingAmount > 0n;
    const stakingStatus = hasStaking ? 'Yes' : 'No';

    // Calculate staking duration in days
    let stakingDuration = 0;
    if (hasStaking && startTime > 0n) {
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const durationSeconds = Number(currentTime - startTime);
      stakingDuration = Math.floor(durationSeconds / 86400); // seconds to days
    }

    // Fetch wallet age using Basescan API
    let walletAge = 'Unknown';
    let ageDays = 0;
    const basescanApiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
    if (basescanApiKey) {
      const response = await fetch(
        `https://api.basescan.org/api?module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${basescanApiKey}`
      );
      const data = await response.json();
      if (data.status === '1' && data.result.length > 0) {
        const firstTxTimestamp = parseInt(data.result[0].timeStamp, 10);
        const ageSeconds = Math.floor(Date.now() / 1000 - firstTxTimestamp);
        ageDays = Math.floor(ageSeconds / 86400);
        walletAge = ageDays < 30 ? 'New (<30 days old)' : `Established (${ageDays} days)`;
      } else if (data.status === '0' && data.result === 'NOTOK') {
        walletAge = 'New (No transactions)';
      }
    }

    const isNewWallet = ageDays < 30;
    const hasActivity = reports.length > 0 || ageDays > 0; // Basic: has reports or any age/activity

    // Fetch Gitcoin Passport score
    let passportStatus = 'N/A';
    const scorerId = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID;
    const gitcoinApiKey = process.env.NEXT_PUBLIC_GITCOIN_API_KEY;
    if (scorerId && gitcoinApiKey) {
      const response = await fetch(
        `https://api.scorer.gitcoin.co/registry/score/${scorerId}/${wallet.toLowerCase()}`,
        {
          headers: {
            'X-API-KEY': gitcoinApiKey,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const score = parseFloat(data.score || '0');
        passportStatus = score > 15 ? `Verified (${score.toFixed(2)})` : 'Low Score';
      }
    }

    return {
      hasStaking,
      stakingAmount,
      stakingDuration,
      isNewWallet,
      hasActivity,
      trustScore: Number(trustScore.score),
      reports: reports.length,
      walletAge,
      passportScore: passportStatus,
      staking: stakingStatus,
    };
  } catch (error) {
    console.error('Wallet analysis error:', error);
    return {
      hasStaking: false,
      stakingAmount: 0n,
      stakingDuration: 0,
      isNewWallet: true,
      hasActivity: false,
      trustScore: 100,
      reports: 0,
      walletAge: 'Unknown',
      passportScore: 'N/A',
      staking: 'No',
    };
  }
}