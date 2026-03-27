/**
 * IPFS Cache for Off-Chain Feed Storage
 * 
 * Caches post feeds off-chain using IPFS for faster loading
 * and reduced on-chain queries
 */

export interface CachedPost {
  postId: string;
  contentHash: string;
  timestamp: number;
  author: string;
  tips: string;
  ipfsHash: string;
}

export interface FeedCache {
  feedId: string;
  posts: CachedPost[];
  lastUpdated: number;
  ipfsHash: string;
}

/**
 * Upload feed to IPFS
 */
export async function uploadFeedToIPFS(feed: FeedCache): Promise<string> {
  try {
    // In production, use IPFS client (e.g., web3.storage, pinata, nft.storage)
    const response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feed),
    });

    if (!response.ok) {
      throw new Error('IPFS upload failed');
    }

    const data = await response.json();
    return data.cid; // IPFS Content Identifier
  } catch (error) {
    console.error('IPFS upload error:', error);
    // Fallback to localStorage
    return cacheFeedLocally(feed);
  }
}

/**
 * Fetch feed from IPFS
 */
export async function fetchFeedFromIPFS(ipfsHash: string): Promise<FeedCache | null> {
  try {
    // Fetch from IPFS gateway
    const response = await fetch(`https://${ipfsHash}.ipfs.w3s.link`);
    
    if (!response.ok) {
      throw new Error('IPFS fetch failed');
    }

    return await response.json() as FeedCache;
  } catch (error) {
    console.error('IPFS fetch error:', error);
    return null;
  }
}

/**
 * Cache feed locally (fallback)
 */
function cacheFeedLocally(feed: FeedCache): string {
  const cacheKey = `feed_cache_${feed.feedId}`;
  localStorage.setItem(cacheKey, JSON.stringify(feed));
  return `local_${cacheKey}`;
}

/**
 * Get cached feed
 */
export function getCachedFeed(feedId: string): FeedCache | null {
  const cacheKey = `feed_cache_${feedId}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (!cached) return null;
  
  const feed: FeedCache = JSON.parse(cached);
  
  // Check if cache is stale (older than 5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;
  if (Date.now() - feed.lastUpdated > CACHE_TTL) {
    return null;
  }
  
  return feed;
}

/**
 * Update cached feed
 */
export async function updateFeedCache(
  feedId: string,
  posts: CachedPost[]
): Promise<string> {
  const feed: FeedCache = {
    feedId,
    posts,
    lastUpdated: Date.now(),
    ipfsHash: '',
  };

  // Upload to IPFS
  const ipfsHash = await uploadFeedToIPFS(feed);
  feed.ipfsHash = ipfsHash;

  // Also cache locally
  const cacheKey = `feed_cache_${feedId}`;
  localStorage.setItem(cacheKey, JSON.stringify(feed));

  return ipfsHash;
}

/**
 * Feed Cache Manager
 */
export class FeedCacheManager {
  private cache: Map<string, FeedCache> = new Map();
  private ipfsHashes: Map<string, string> = new Map();

  /**
   * Cache feed
   */
  async cacheFeed(feedId: string, posts: CachedPost[]): Promise<string> {
    const feed: FeedCache = {
      feedId,
      posts,
      lastUpdated: Date.now(),
      ipfsHash: '',
    };

    const ipfsHash = await uploadFeedToIPFS(feed);
    feed.ipfsHash = ipfsHash;

    this.cache.set(feedId, feed);
    this.ipfsHashes.set(feedId, ipfsHash);

    return ipfsHash;
  }

  /**
   * Get cached feed
   */
  async getFeed(feedId: string): Promise<FeedCache | null> {
    // Check memory cache
    const cached = this.cache.get(feedId);
    if (cached) {
      const CACHE_TTL = 5 * 60 * 1000;
      if (Date.now() - cached.lastUpdated < CACHE_TTL) {
        return cached;
      }
    }

    // Check IPFS
    const ipfsHash = this.ipfsHashes.get(feedId);
    if (ipfsHash) {
      const feed = await fetchFeedFromIPFS(ipfsHash);
      if (feed) {
        this.cache.set(feedId, feed);
        return feed;
      }
    }

    // Check localStorage
    return getCachedFeed(feedId);
  }

  /**
   * Invalidate cache
   */
  invalidateCache(feedId: string): void {
    this.cache.delete(feedId);
    this.ipfsHashes.delete(feedId);
    localStorage.removeItem(`feed_cache_${feedId}`);
  }
}

