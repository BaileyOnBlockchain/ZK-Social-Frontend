/**
 * Reputation Service
 * Calculates reputation and levels based on on-chain activity
 *
 * Formula:
 * - Posts: 10 points each
 * - Tips received: 1 point per 0.01 ETH equivalent
 * - Engagement: 5 points per post (proxy)
 * - Staking: 2 points per 1000 PRIV staked
 * - Followers: 1 point per 10 followers
 * - Level: every 250 reputation = 1 level
 */

import { CONTRACT_ADDRESSES, SOCIAL_NETWORK_ABI, STAKING_VAULT_ABI } from '../contracts';
import { PublicClient } from 'viem';

export interface ReputationData {
  reputation: number;
  level: number;
  postsCount: number;
  engagement: number;
  contributions: number;
  nextLevelReputation: number;
  progressToNextLevel: number; // 0-100
}

export async function calculateReputation(
  publicClient: PublicClient,
  address: string
): Promise<ReputationData> {
  const defaults: ReputationData = {
    reputation: 0, level: 1, postsCount: 0, engagement: 0,
    contributions: 0, nextLevelReputation: 250, progressToNextLevel: 0,
  };

  if (!publicClient || !address || CONTRACT_ADDRESSES.SOCIAL_NETWORK === '0x0000000000000000000000000000000000000000') {
    return defaults;
  }

  try {
    let postsCount = 0;
    try {
      const userPostsData = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.SOCIAL_NETWORK,
        abi: SOCIAL_NETWORK_ABI,
        functionName: 'getUserPosts',
        args: [address as `0x${string}`],
      });
      postsCount = Array.isArray(userPostsData) ? userPostsData.length : 0;
    } catch (error: any) {
      if (error?.message?.includes('not found on ABI') || error?.message?.includes('does not have the function')) {
        try {
          const { fetchUserPosts } = await import('../posts/posts-service');
          const posts = await fetchUserPosts(publicClient, address);
          postsCount = posts.length;
        } catch { /* postsCount stays 0 */ }
      }
    }

    let earnings = 0n;
    try {
      earnings = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.SOCIAL_NETWORK,
        abi: SOCIAL_NETWORK_ABI,
        functionName: 'getEarnings',
        args: [address as `0x${string}`],
      })) as bigint || 0n;
    } catch { /* not deployed yet */ }

    let followersCount = 0;
    try {
      const followers = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.SOCIAL_NETWORK,
        abi: SOCIAL_NETWORK_ABI,
        functionName: 'getFollowers',
        args: [address as `0x${string}`],
      });
      followersCount = Array.isArray(followers) ? followers.length : 0;
    } catch { /* not deployed yet */ }

    let stakedAmount = 0n;
    if (CONTRACT_ADDRESSES.STAKING_VAULT !== '0x0000000000000000000000000000000000000000') {
      try {
        const stakeData = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING_VAULT,
          abi: STAKING_VAULT_ABI,
          functionName: 'getUserStake',
          args: [address as `0x${string}`],
        });
        stakedAmount = (stakeData as any)?.amount || 0n;
      } catch { /* not deployed yet */ }
    }

    const earningsInEth   = Number(earnings) / 1e18;
    const stakedInTokens  = Number(stakedAmount) / 1e18;

    const postsPoints      = postsCount * 10;
    const tipsPoints       = Math.floor(earningsInEth * 100);
    const engagementPoints = Math.floor(postsCount * 5);
    const stakingPoints    = Math.floor((stakedInTokens / 1000) * 2);
    const followersPoints  = Math.floor(followersCount / 10);

    const reputation = postsPoints + tipsPoints + engagementPoints + stakingPoints + followersPoints;
    const level = Math.floor(reputation / 250) + 1;
    const nextLevelReputation = level * 250;
    const currentLevelReputation = (level - 1) * 250;
    const progressToNextLevel = reputation > currentLevelReputation
      ? Math.min(100, Math.max(0, ((reputation - currentLevelReputation) / 250) * 100))
      : 0;

    return {
      reputation,
      level,
      postsCount,
      engagement: Math.floor(earningsInEth * 1000) + engagementPoints,
      contributions: postsCount,
      nextLevelReputation,
      progressToNextLevel,
    };
  } catch (error) {
    console.error('Error calculating reputation:', error);
    return defaults;
  }
}
