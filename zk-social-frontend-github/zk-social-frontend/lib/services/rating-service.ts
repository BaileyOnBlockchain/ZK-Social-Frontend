/**
 * Unified Rating Service
 * Calculates a 0-100 rating based on activity, contributions, verification, and engagement
 */

import { CONTRACT_ADDRESSES, SOCIAL_NETWORK_ABI, STAKING_VAULT_ABI } from '../contracts';
import { PublicClient } from 'viem';

export interface UserRating {
  score: number;
  color: string;
  level: string;
  breakdown: {
    activity: number;      // 0-30 points
    contributions: number; // 0-30 points
    verification: number;  // 0-20 points
    engagement: number;    // 0-20 points
  };
}

export async function calculateUserRating(
  publicClient: PublicClient | null,
  address: string,
  isVerified: boolean = false
): Promise<UserRating> {
  if (!publicClient || !address || CONTRACT_ADDRESSES.SOCIAL_NETWORK === '0x0000000000000000000000000000000000000000') {
    return getDefaultRating(isVerified);
  }

  try {
    const userPosts = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.SOCIAL_NETWORK,
      abi: SOCIAL_NETWORK_ABI,
      functionName: 'getUserPosts',
      args: [address as `0x${string}`],
    });
    const postsCount = Array.isArray(userPosts) ? userPosts.length : 0;

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

    const breakdown = {
      activity:      Math.min(30, Math.floor(postsCount * 2) + (postsCount > 10 ? 10 : 0)),
      contributions: Math.min(30, Math.floor(postsCount * 1.5) + Math.min(10, Math.floor(Number(stakedAmount) / 1e18 / 100))),
      verification:  isVerified ? 20 : 0,
      engagement:    Math.min(20,
        Math.min(10, Math.floor(Number(earnings) / 1e18 * 50)) +
        Math.min(5,  Math.floor(followersCount / 20)) +
        Math.min(5,  Math.floor(postsCount * 0.5))
      ),
    };

    const score = Math.min(100, Math.round(
      breakdown.activity + breakdown.contributions + breakdown.verification + breakdown.engagement
    ));

    return { score, color: getRatingColor(score), level: getRatingLevel(score), breakdown };
  } catch (error) {
    console.error('Error calculating rating:', error);
    return getDefaultRating(isVerified);
  }
}

function getRatingColor(score: number): string {
  if (score <= 0)   return '#EF4444';
  if (score >= 100) return '#10B981';
  const red   = Math.max(0, Math.min(255, 255 - score * 2.55));
  const green = Math.max(0, Math.min(255, score * 2.55));
  return `#${Math.round(red).toString(16).padStart(2, '0')}${Math.round(green).toString(16).padStart(2, '0')}00`;
}

function getRatingLevel(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Expert';
  if (score >= 60) return 'Advanced';
  if (score >= 45) return 'Intermediate';
  if (score >= 30) return 'Beginner';
  return 'New';
}

function getDefaultRating(isVerified: boolean): UserRating {
  const baseScore = isVerified ? 20 : 0;
  return {
    score: baseScore,
    color: getRatingColor(baseScore),
    level: getRatingLevel(baseScore),
    breakdown: { activity: 0, contributions: 0, verification: isVerified ? 20 : 0, engagement: 0 },
  };
}

export function calculateMockRating(
  postsCount: number,
  tipsReceived: number,
  followers: number,
  isVerified: boolean,
  stakedAmount: number = 0
): UserRating {
  const breakdown = {
    activity:      Math.min(30, Math.floor(postsCount * 2) + (postsCount > 10 ? 10 : 0)),
    contributions: Math.min(30, Math.floor(postsCount * 1.5) + Math.min(10, Math.floor(stakedAmount / 100))),
    verification:  isVerified ? 20 : 0,
    engagement:    Math.min(20,
      Math.min(10, Math.floor(tipsReceived * 50)) +
      Math.min(5,  Math.floor(followers / 20)) +
      Math.min(5,  Math.floor(postsCount * 0.5))
    ),
  };
  const score = Math.min(100, Math.round(
    breakdown.activity + breakdown.contributions + breakdown.verification + breakdown.engagement
  ));
  return { score, color: getRatingColor(score), level: getRatingLevel(score), breakdown };
}
