/**
 * Local storage service for Scam Reports
 * Self-contained system that works independently, with optional blockchain sync
 */

export interface ScamReport {
  id: string;
  reportedAddress: string;
  reporterAddress: string;
  reason: string;
  evidence?: string;
  timestamp: number;
  trustScore: number;
  status: 'pending' | 'verified' | 'dismissed';
  syncedToBlockchain?: boolean;
  blockchainReportId?: string;
}

export interface TrustScore {
  address: string;
  score: number; // 0-100, lower is more suspicious
  reports: number;
  verifiedReports: number;
  lastUpdated: number;
  // Trust factors
  walletAge: number; // Days
  hasStaking: boolean;
  stakingAmount: bigint;
  stakingDuration: number; // Days
  passportScore: number; // 0-100
  hasKYC: boolean;
  isNewWallet: boolean;
  hasActivity: boolean;
  // Breakdown
  greenFlags: string[];
  redFlags: string[];
  // Data source indicators
  dataSource?: {
    walletAge: 'real' | 'estimated' | 'unknown';
    staking: 'real' | 'unknown';
    passport: 'real' | 'none';
  };
}

const STORAGE_KEY = 'privnet_scam_reports';
const TRUST_SCORES_KEY = 'privnet_trust_scores';

/**
 * Local Storage implementation (fallback for browsers without IndexedDB)
 */
class LocalStorageService {
  [x: string]: any;
  private getReports(): ScamReport[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveReports(reports: ScamReport[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch (error) {
      console.error('Failed to save reports to localStorage:', error);
    }
  }

  private getTrustScores(): Record<string, TrustScore> {
    if (typeof window === 'undefined') return {};
    try {
      const data = localStorage.getItem(TRUST_SCORES_KEY);
      if (!data) return {};
      const parsed = JSON.parse(data);
      // Convert string back to bigint
      return Object.entries(parsed).reduce((acc, [key, value]: [string, any]) => {
        acc[key] = {
          ...value,
          stakingAmount: typeof value.stakingAmount === 'string' 
            ? BigInt(value.stakingAmount) 
            : BigInt(value.stakingAmount || 0),
        };
        return acc;
      }, {} as Record<string, TrustScore>);
    } catch {
      return {};
    }
  }

  private saveTrustScores(scores: Record<string, TrustScore>): void {
    if (typeof window === 'undefined') return;
    try {
      // Convert bigint to string for JSON serialization
      const serializable = Object.entries(scores).reduce((acc, [key, value]) => {
        acc[key] = {
          ...value,
          stakingAmount: value.stakingAmount.toString(),
        };
        return acc;
      }, {} as Record<string, any>);
      localStorage.setItem(TRUST_SCORES_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to save trust scores to localStorage:', error);
    }
  }

  /**
   * Submit a new scam report
   */
  async submitReport(
    reportedAddress: string,
    reporterAddress: string,
    reason: string,
    evidence?: string
  ): Promise<ScamReport> {
    const reports = this.getReports();
    const reportId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    
    const report: ScamReport = {
      id: reportId,
      reportedAddress: reportedAddress.toLowerCase(),
      reporterAddress: reporterAddress.toLowerCase(),
      reason: reason.trim(),
      evidence: evidence?.trim() || '',
      timestamp: Date.now(),
      trustScore: 100,
      status: 'pending',
      syncedToBlockchain: false,
    };

    reports.push(report);
    this.saveReports(reports);

    // Update trust score
    this.updateTrustScore(reportedAddress);

    return report;
  }

  /**
   * Get all reports for a specific address
   */
  getReportsForAddress(address: string): ScamReport[] {
    const reports = this.getReports();
    return reports.filter(
      (r) => r.reportedAddress.toLowerCase() === address.toLowerCase()
    );
  }

  /**
   * Get all reports
   */
  getAllReports(): ScamReport[] {
    return this.getReports();
  }

  /**
   * Get a specific report by ID
   */
  getReport(reportId: string): ScamReport | null {
    const reports = this.getReports();
    return reports.find((r) => r.id === reportId) || null;
  }

  /**
   * Get trust score for an address
   */
  getTrustScore(address: string): TrustScore {
    const scores = this.getTrustScores();
    const normalizedAddress = address.toLowerCase();
    
    if (scores[normalizedAddress]) {
      return scores[normalizedAddress];
    }

    // Default trust score
    return {
      address: normalizedAddress,
      score: 100,
      reports: 0,
      verifiedReports: 0,
      lastUpdated: Date.now(),
      walletAge: 0,
      hasStaking: false,
      stakingAmount: 0n,
      stakingDuration: 0,
      passportScore: 0,
      hasKYC: false,
      isNewWallet: true,
      hasActivity: false,
      greenFlags: [],
      redFlags: [],
      dataSource: {
        walletAge: 'unknown',
        staking: 'unknown',
        passport: 'none',
      },
    };
  }

  /**
   * Update trust score for an address
   * This should be called with wallet analysis and passport data
   */
  updateTrustScoreWithFactors(
    address: string,
    walletAnalysis: {
      walletAge: number;
      hasStaking: boolean;
      stakingAmount: bigint;
      stakingDuration: number;
      isNewWallet: boolean;
      hasActivity: boolean;
      dataSource?: {
        walletAge?: 'real' | 'estimated' | 'unknown';
        staking?: 'real' | 'unknown';
      };
    },
    passportScore: {
      score: number;
      hasKYC: boolean;
      source?: 'gitcoin' | 'human' | 'none';
    }
  ): void {
    const scores = this.getTrustScores();
    const reports = this.getReportsForAddress(address);
    const normalizedAddress = address.toLowerCase();

    const verifiedReports = reports.filter((r) => r.status === 'verified').length;
    const totalReports = reports.length;

    // Start with base score of 100
    let score = 100;
    const greenFlags: string[] = [];
    const redFlags: string[] = [];

    // RED FLAGS (penalties)
    // 1. Scam reports (major penalty)
    const unverifiedReports = totalReports - verifiedReports;
    const reportPenalty = verifiedReports * 15 + unverifiedReports * 5;
    score -= reportPenalty;
    if (totalReports > 0) {
      redFlags.push(`${totalReports} scam report${totalReports > 1 ? 's' : ''}`);
    }

    // 2. New wallet (less than 30 days) - moderate penalty
    if (walletAnalysis.isNewWallet) {
      score -= 20;
      redFlags.push('New wallet (< 30 days old)');
    }

    // 3. No KYC - moderate penalty
    if (!passportScore.hasKYC) {
      score -= 15;
      redFlags.push('No KYC verification');
    }

    // 4. No activity - minor penalty
    if (!walletAnalysis.hasActivity) {
      score -= 5;
      redFlags.push('Low transaction activity');
    }

    // GREEN FLAGS (bonuses)
    // 1. Staking (major bonus)
    if (walletAnalysis.hasStaking) {
      const stakingBonus = Math.min(25, 10 + Math.floor(walletAnalysis.stakingDuration / 30) * 2);
      score += stakingBonus;
      greenFlags.push(`Staking (${walletAnalysis.stakingDuration} days)`);
    }

    // 2. Wallet age (older = better)
    if (walletAnalysis.walletAge > 180) {
      score += 20;
      greenFlags.push(`Established wallet (${Math.floor(walletAnalysis.walletAge / 30)} months old)`);
    } else if (walletAnalysis.walletAge > 90) {
      score += 10;
      greenFlags.push(`Mature wallet (${Math.floor(walletAnalysis.walletAge / 30)} months old)`);
    } else if (walletAnalysis.walletAge > 30) {
      score += 5;
      greenFlags.push(`Active wallet (${walletAnalysis.walletAge} days old)`);
    }

    // 3. Passport score (Gitcoin/Human Passport)
    if (passportScore.score > 50) {
      const passportBonus = Math.floor(passportScore.score / 4); // Max 25 points
      score += passportBonus;
      greenFlags.push(`Passport verified (${passportScore.score} points)`);
    }

    // 4. KYC verification
    if (passportScore.hasKYC) {
      score += 10;
      greenFlags.push('KYC verified');
    }

    // 5. High activity
    if (walletAnalysis.hasActivity) {
      score += 5;
      greenFlags.push('Active wallet');
    }

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));

    scores[normalizedAddress] = {
      address: normalizedAddress,
      score,
      reports: totalReports,
      verifiedReports,
      lastUpdated: Date.now(),
      walletAge: walletAnalysis.walletAge,
      hasStaking: walletAnalysis.hasStaking,
      stakingAmount: walletAnalysis.stakingAmount,
      stakingDuration: walletAnalysis.stakingDuration,
      passportScore: passportScore.score,
      hasKYC: passportScore.hasKYC,
      isNewWallet: walletAnalysis.isNewWallet,
      hasActivity: walletAnalysis.hasActivity,
      greenFlags,
      redFlags,
      dataSource: {
        walletAge: walletAnalysis.dataSource?.walletAge || (walletAnalysis.walletAge > 0 ? 'real' : 'unknown'),
        staking: walletAnalysis.dataSource?.staking || (walletAnalysis.hasStaking ? 'real' : 'unknown'),
        passport: passportScore.source === 'gitcoin' || passportScore.source === 'human' ? 'real' : 'none',
      },
    };

    this.saveTrustScores(scores);

    // Update trust scores in reports
    const allReports = this.getReports();
    allReports.forEach((report) => {
      if (report.reportedAddress.toLowerCase() === normalizedAddress) {
        report.trustScore = score;
      }
    });
    this.saveReports(allReports);
  }

  /**
   * Update trust score for an address based on reports only (legacy method)
   */
  private updateTrustScore(address: string): void {
    const scores = this.getTrustScores();
    const reports = this.getReportsForAddress(address);
    const normalizedAddress = address.toLowerCase();

    const verifiedReports = reports.filter((r) => r.status === 'verified').length;
    const totalReports = reports.length;

    // Calculate score: 100 - (verifiedReports * 10) - (unverifiedReports * 2)
    const unverifiedReports = totalReports - verifiedReports;
    const penalty = verifiedReports * 10 + unverifiedReports * 2;
    const score = penalty >= 100 ? 0 : 100 - penalty;

    // Preserve existing factors if they exist
    const existing = scores[normalizedAddress] || this.getTrustScore(address);

    scores[normalizedAddress] = {
      ...existing,
      address: normalizedAddress,
      score,
      reports: totalReports,
      verifiedReports,
      lastUpdated: Date.now(),
    };

    this.saveTrustScores(scores);

    // Update trust scores in reports
    const allReports = this.getReports();
    allReports.forEach((report) => {
      if (report.reportedAddress.toLowerCase() === normalizedAddress) {
        report.trustScore = score;
      }
    });
    this.saveReports(allReports);
  }

  /**
   * Verify a report (admin function)
   */
  verifyReport(reportId: string): boolean {
    const reports = this.getReports();
    const report = reports.find((r) => r.id === reportId);
    
    if (!report || report.status !== 'pending') {
      return false;
    }

    report.status = 'verified';
    this.saveReports(reports);
    this.updateTrustScore(report.reportedAddress);
    
    return true;
  }

  /**
   * Dismiss a report (admin function)
   */
  dismissReport(reportId: string): boolean {
    const reports = this.getReports();
    const report = reports.find((r) => r.id === reportId);
    
    if (!report || report.status !== 'pending') {
      return false;
    }

    report.status = 'dismissed';
    this.saveReports(reports);
    
    return true;
  }

  /**
   * Mark report as synced to blockchain
   */
  markSynced(reportId: string, blockchainReportId: string): void {
    const reports = this.getReports();
    const report = reports.find((r) => r.id === reportId);
    
    if (report) {
      report.syncedToBlockchain = true;
      report.blockchainReportId = blockchainReportId;
      this.saveReports(reports);
    }
  }

  /**
   * Get reports that haven't been synced to blockchain
   */
  getUnsyncedReports(): ScamReport[] {
    const reports = this.getReports();
    return reports.filter((r) => !r.syncedToBlockchain);
  }

  /**
   * Clear all data (use with caution)
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TRUST_SCORES_KEY);
  }

  /**
   * Export data as JSON
   */
  exportData(): string {
    return JSON.stringify({
      reports: this.getReports(),
      trustScores: this.getTrustScores(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import data from JSON
   */
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.reports) {
        this.saveReports(data.reports);
      }
      if (data.trustScores) {
        this.saveTrustScores(data.trustScores);
      }
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const scamReportsStorage = new LocalStorageService();

