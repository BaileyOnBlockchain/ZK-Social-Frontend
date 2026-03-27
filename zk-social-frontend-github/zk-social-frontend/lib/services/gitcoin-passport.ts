/**
 * Gitcoin Passport / Human Passport Integration
 * Verifies human identity and KYC status through Gitcoin Passport
 */

export interface PassportScore {
  address: string;
  score: number; // 0-100
  hasKYC: boolean;
  stamps: string[];
  lastUpdated: number;
  source: 'gitcoin' | 'human' | 'none';
}

const PASSPORT_CACHE_KEY = 'privnet_passport_scores';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedPassport {
  [address: string]: {
    data: PassportScore;
    timestamp: number;
  };
}

/**
 * Get Gitcoin Passport score for an address
 */
export async function getGitcoinPassportScore(address: string): Promise<PassportScore | null> {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  const normalizedAddress = address.toLowerCase();

  // Check cache first
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(PASSPORT_CACHE_KEY);
      if (cached) {
        const cache: CachedPassport = JSON.parse(cached);
        if (cache[normalizedAddress]) {
          const cachedData = cache[normalizedAddress];
          // Return cached if less than 7 days old
          if (Date.now() - cachedData.timestamp < CACHE_DURATION) {
            return cachedData.data;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read passport cache:', e);
    }
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GITCOIN_PASSPORT_API_KEY;
    if (!apiKey || apiKey === '') {
      // No API key, skip Gitcoin Passport
      console.log('Gitcoin Passport API key not configured');
      return null;
    }

    // Gitcoin Passport API v2
    // First, get the passport for the address
    const passportResponse = await fetch(
      `https://api.scorer.gitcoin.co/registry/stamps/${normalizedAddress}?include_metadata=false`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );
    
    if (!passportResponse.ok) {
      console.warn(`Gitcoin Passport API returned ${passportResponse.status}: ${passportResponse.statusText}`);
      return null;
    }

    if (passportResponse.ok) {
      const passportData = await passportResponse.json();
      
      // Get score from scorer API
      const scorerId = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID || '1';
      const scorerResponse = await fetch(
        `https://api.scorer.gitcoin.co/registry/score/${scorerId}/${normalizedAddress}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      );
      
      if (!scorerResponse.ok) {
        console.warn(`Gitcoin Scorer API returned ${scorerResponse.status}: ${scorerResponse.statusText}`);
      }

      let score = 0;
      let stamps: string[] = [];

      if (scorerResponse.ok) {
        const scoreData = await scorerResponse.json();
        score = scoreData.score || 0;
      }

      if (passportData && passportData.items) {
        stamps = passportData.items.map((item: any) => item.credential?.credentialSubject?.provider || '').filter(Boolean);
      }

      // Check for KYC stamps (BrightID, Civic, etc.)
      const kycStamps = ['BrightID', 'Civic', 'Idena', 'Holonym', 'Worldcoin'];
      const hasKYC = stamps.some(stamp => kycStamps.some(kyc => stamp.includes(kyc)));

      const passportScore: PassportScore = {
        address: normalizedAddress,
        score: Math.min(100, Math.max(0, score)),
        hasKYC,
        stamps,
        lastUpdated: Date.now(),
        source: 'gitcoin',
      };

      // Cache the result
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(PASSPORT_CACHE_KEY);
          const cache: CachedPassport = cached ? JSON.parse(cached) : {};
          cache[normalizedAddress] = {
            data: passportScore,
            timestamp: Date.now(),
          };
          localStorage.setItem(PASSPORT_CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
          console.warn('Failed to cache passport score:', e);
        }
      }

      return passportScore;
    }
  } catch (error) {
    console.warn('Failed to fetch Gitcoin Passport score:', error);
  }

  // Fallback: Try Human Passport (alternative human verification)
  try {
    const humanApiKey = process.env.NEXT_PUBLIC_HUMAN_PASSPORT_API_KEY;
    if (!humanApiKey) {
      return null;
    }

    const humanResponse = await fetch(
      `https://api.human.id/v1/verify/${normalizedAddress}`,
      {
        headers: {
          'Authorization': `Bearer ${humanApiKey}`,
        },
      }
    );

    if (humanResponse.ok) {
      const humanData = await humanResponse.json();
      
      const passportScore: PassportScore = {
        address: normalizedAddress,
        score: humanData.verified ? 75 : 0, // Human Passport gives 75 if verified
        hasKYC: humanData.kycVerified || false,
        stamps: humanData.verifications || [],
        lastUpdated: Date.now(),
        source: 'human',
      };

      // Cache the result
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(PASSPORT_CACHE_KEY);
          const cache: CachedPassport = cached ? JSON.parse(cached) : {};
          cache[normalizedAddress] = {
            data: passportScore,
            timestamp: Date.now(),
          };
          localStorage.setItem(PASSPORT_CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
          console.warn('Failed to cache passport score:', e);
        }
      }

      return passportScore;
    }
  } catch (error) {
    console.warn('Failed to fetch Human Passport score:', error);
  }

  return null;
}

/**
 * Get passport score with fallback
 */
export async function getPassportScore(address: string): Promise<PassportScore> {
  const score = await getGitcoinPassportScore(address);
  
  if (score) {
    return score;
  }

  // Return default (no passport)
  return {
    address: address.toLowerCase(),
    score: 0,
    hasKYC: false,
    stamps: [],
    lastUpdated: Date.now(),
    source: 'none',
  };
}

