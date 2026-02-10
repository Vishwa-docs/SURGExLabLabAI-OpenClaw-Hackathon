// ============================================================
// src/governance/risk-scorer.ts — Dynamic Risk Scoring Engine
// ============================================================
// Real-time multi-signal risk scoring for agent actions.
// Combines behavioral analysis, velocity tracking, contextual
// signals, and historical patterns into a single 0-100 score.
//
// Signals evaluated:
//   1. Action class inherent risk
//   2. Transaction velocity (frequency anomaly)
//   3. Amount deviation from agent baseline
//   4. Time-of-day pattern anomaly
//   5. Address reputation (known addresses vs unknown)
//   6. Cumulative risk fatigue (many risky actions in window)
//   7. Policy violation history
// ============================================================

import logger from '../utils/logger';

// ---- Types ----

export interface RiskSignal {
  name: string;
  score: number;     // 0-100 contribution
  weight: number;    // 0.0-1.0 multiplier
  description: string;
}

export interface RiskAssessment {
  overallScore: number;            // 0-100 composite
  level: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  signals: RiskSignal[];
  recommendation: 'allow' | 'warn' | 'hold' | 'block';
  assessedAt: number;
  metadata: Record<string, unknown>;
}

export interface TransactionRecord {
  timestamp: number;
  actionClass: string;
  amountUsd: number;
  riskScore: number;
  wasBlocked: boolean;
}

// ---- Risk Signal Weights ----

const SIGNAL_WEIGHTS = {
  actionClassRisk: 0.25,
  velocityAnomaly: 0.20,
  amountDeviation: 0.15,
  timePatternAnomaly: 0.10,
  addressReputation: 0.10,
  riskFatigue: 0.10,
  violationHistory: 0.10,
};

// Inherent risk by action class
const ACTION_CLASS_RISK: Record<string, number> = {
  ownership_renounce: 100,
  token_launch: 70,
  stake: 60,
  swap: 45,
  transfer: 40,
  payment: 35,
  governance_vote: 30,
  skill_install: 50,
  api_call: 20,
  moltbook_post: 5,
  file_access: 15,
  generic: 10,
};

// ---- Risk Scoring Engine ----

export class RiskScorer {
  private transactionHistory: TransactionRecord[] = [];
  private violationCount: number = 0;
  private knownAddresses: Set<string> = new Set();
  private velocityWindow: number = 300_000; // 5 minutes
  private maxHistorySize: number = 1000;

  /**
   * Perform a full risk assessment on an action.
   */
  assess(params: {
    actionClass: string;
    amountUsd: number;
    toAddress?: string;
    agentId: string;
    description?: string;
  }): RiskAssessment {
    const signals: RiskSignal[] = [];

    // Signal 1: Action class inherent risk
    const classRisk = ACTION_CLASS_RISK[params.actionClass] ?? 25;
    signals.push({
      name: 'action_class_risk',
      score: classRisk,
      weight: SIGNAL_WEIGHTS.actionClassRisk,
      description: `Inherent risk for "${params.actionClass}": ${classRisk}/100`,
    });

    // Signal 2: Transaction velocity anomaly
    const velocityScore = this.calculateVelocityAnomaly();
    signals.push({
      name: 'velocity_anomaly',
      score: velocityScore,
      weight: SIGNAL_WEIGHTS.velocityAnomaly,
      description: velocityScore > 50
        ? `High transaction frequency — ${this.getRecentCount()} actions in 5min window`
        : `Normal velocity — ${this.getRecentCount()} actions in 5min window`,
    });

    // Signal 3: Amount deviation from baseline
    const deviationScore = this.calculateAmountDeviation(params.amountUsd);
    signals.push({
      name: 'amount_deviation',
      score: deviationScore,
      weight: SIGNAL_WEIGHTS.amountDeviation,
      description: deviationScore > 50
        ? `Amount $${params.amountUsd} significantly exceeds agent baseline`
        : `Amount $${params.amountUsd} within normal range`,
    });

    // Signal 4: Time pattern anomaly
    const timeScore = this.calculateTimeAnomaly();
    signals.push({
      name: 'time_pattern_anomaly',
      score: timeScore,
      weight: SIGNAL_WEIGHTS.timePatternAnomaly,
      description: timeScore > 50
        ? `Action at unusual time (outside normal operating hours)`
        : `Action during normal operating hours`,
    });

    // Signal 5: Address reputation
    const addressScore = this.assessAddressReputation(params.toAddress);
    signals.push({
      name: 'address_reputation',
      score: addressScore,
      weight: SIGNAL_WEIGHTS.addressReputation,
      description: params.toAddress
        ? (addressScore > 50
          ? `Unknown address: ${params.toAddress?.slice(0, 10)}...`
          : `Known address: ${params.toAddress?.slice(0, 10)}...`)
        : 'No target address (N/A)',
    });

    // Signal 6: Risk fatigue (cumulative recent risk)
    const fatigueScore = this.calculateRiskFatigue();
    signals.push({
      name: 'risk_fatigue',
      score: fatigueScore,
      weight: SIGNAL_WEIGHTS.riskFatigue,
      description: fatigueScore > 50
        ? `High cumulative risk — many risky actions recently`
        : `Low cumulative risk — normal activity pattern`,
    });

    // Signal 7: Violation history
    const violationScore = Math.min(100, this.violationCount * 15);
    signals.push({
      name: 'violation_history',
      score: violationScore,
      weight: SIGNAL_WEIGHTS.violationHistory,
      description: `${this.violationCount} prior violations recorded`,
    });

    // Calculate weighted composite score
    const overallScore = Math.round(
      signals.reduce((sum, s) => sum + s.score * s.weight, 0)
    );

    const level = this.scoreToLevel(overallScore);
    const recommendation = this.scoreToRecommendation(overallScore);

    const assessment: RiskAssessment = {
      overallScore,
      level,
      signals,
      recommendation,
      assessedAt: Date.now(),
      metadata: {
        agentId: params.agentId,
        actionClass: params.actionClass,
        amountUsd: params.amountUsd,
        historySize: this.transactionHistory.length,
        violationCount: this.violationCount,
      },
    };

    logger.info(`[Risk] Assessed ${params.actionClass}: score=${overallScore}, ` +
      `level=${level}, recommendation=${recommendation}`);

    return assessment;
  }

  /**
   * Record a completed transaction for future analysis.
   */
  recordTransaction(record: TransactionRecord): void {
    this.transactionHistory.push(record);

    // Maintain max history size
    if (this.transactionHistory.length > this.maxHistorySize) {
      this.transactionHistory = this.transactionHistory.slice(-this.maxHistorySize);
    }

    if (record.wasBlocked) {
      this.violationCount++;
    }
  }

  /**
   * Mark an address as known (trusted).
   */
  addKnownAddress(address: string): void {
    this.knownAddresses.add(address.toLowerCase());
  }

  /**
   * Get risk trend over last N transactions.
   */
  getRiskTrend(window: number = 10): {
    trend: 'increasing' | 'stable' | 'decreasing';
    recentAvg: number;
    olderAvg: number;
    delta: number;
  } {
    const history = this.transactionHistory;
    if (history.length < window * 2) {
      return { trend: 'stable', recentAvg: 0, olderAvg: 0, delta: 0 };
    }

    const recent = history.slice(-window);
    const older = history.slice(-window * 2, -window);

    const recentAvg = recent.reduce((s, r) => s + r.riskScore, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r.riskScore, 0) / older.length;
    const delta = recentAvg - olderAvg;

    return {
      trend: delta > 5 ? 'increasing' : delta < -5 ? 'decreasing' : 'stable',
      recentAvg: Math.round(recentAvg),
      olderAvg: Math.round(olderAvg),
      delta: Math.round(delta),
    };
  }

  /**
   * Get summary stats.
   */
  getStats(): {
    totalAssessed: number;
    avgRiskScore: number;
    violationCount: number;
    knownAddresses: number;
    trend: string;
  } {
    const avg = this.transactionHistory.length > 0
      ? this.transactionHistory.reduce((s, r) => s + r.riskScore, 0) / this.transactionHistory.length
      : 0;

    return {
      totalAssessed: this.transactionHistory.length,
      avgRiskScore: Math.round(avg),
      violationCount: this.violationCount,
      knownAddresses: this.knownAddresses.size,
      trend: this.getRiskTrend().trend,
    };
  }

  // ---- Private Scoring Methods ----

  private calculateVelocityAnomaly(): number {
    const now = Date.now();
    const recentCount = this.transactionHistory
      .filter(t => now - t.timestamp < this.velocityWindow).length;

    // 0-2 actions in 5 min = normal, 3-5 = elevated, 6+ = high
    if (recentCount <= 2) return 0;
    if (recentCount <= 5) return 30 + (recentCount - 2) * 10;
    return Math.min(100, 60 + (recentCount - 5) * 15);
  }

  private getRecentCount(): number {
    const now = Date.now();
    return this.transactionHistory
      .filter(t => now - t.timestamp < this.velocityWindow).length;
  }

  private calculateAmountDeviation(amountUsd: number): number {
    if (amountUsd === 0) return 0;
    if (this.transactionHistory.length < 3) return 15; // Insufficient data

    const amounts = this.transactionHistory
      .filter(t => t.amountUsd > 0)
      .map(t => t.amountUsd);

    if (amounts.length === 0) return 30; // No prior amounts

    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length
    );

    if (stdDev === 0) {
      // All same amounts
      return amountUsd === mean ? 0 : 50;
    }

    const zScore = Math.abs(amountUsd - mean) / stdDev;

    // Z-score to risk: 0-1 = normal, 1-2 = elevated, 2-3 = high, 3+ = very high
    if (zScore <= 1) return 0;
    if (zScore <= 2) return 30;
    if (zScore <= 3) return 60;
    return Math.min(100, 70 + (zScore - 3) * 15);
  }

  private calculateTimeAnomaly(): number {
    const hour = new Date().getHours();
    // Business hours: 6-22 = normal, 22-6 = unusual
    if (hour >= 6 && hour <= 22) return 0;
    return 40; // Off-hours penalty
  }

  private assessAddressReputation(address?: string): number {
    if (!address) return 0; // No address to assess
    if (this.knownAddresses.has(address.toLowerCase())) return 0;
    return 45; // Unknown address penalty
  }

  private calculateRiskFatigue(): number {
    const recentWindow = 600_000; // 10 minutes
    const now = Date.now();
    const recentRisks = this.transactionHistory
      .filter(t => now - t.timestamp < recentWindow)
      .map(t => t.riskScore);

    if (recentRisks.length === 0) return 0;

    const avgRecentRisk = recentRisks.reduce((s, r) => s + r, 0) / recentRisks.length;
    const highRiskCount = recentRisks.filter(r => r > 50).length;

    return Math.min(100, Math.round(avgRecentRisk * 0.5 + highRiskCount * 15));
  }

  private scoreToLevel(score: number): RiskAssessment['level'] {
    if (score <= 15) return 'minimal';
    if (score <= 35) return 'low';
    if (score <= 55) return 'medium';
    if (score <= 75) return 'high';
    return 'critical';
  }

  private scoreToRecommendation(score: number): RiskAssessment['recommendation'] {
    if (score <= 30) return 'allow';
    if (score <= 50) return 'warn';
    if (score <= 70) return 'hold';
    return 'block';
  }
}

export const riskScorer = new RiskScorer();
export default riskScorer;
