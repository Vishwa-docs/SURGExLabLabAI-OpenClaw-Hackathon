// ============================================================
// src/agent/credit-scoring.ts — Agent Credit Scoring Engine
// ============================================================
// Trustworthiness + economic history + compliance scoring for
// autonomous AI agents. Enables trust-gated commerce between
// agents in the RIDHWAN mesh.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface CreditReport {
  agentId: string;
  overallScore: number;       // 0-1000
  grade: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';
  components: {
    transactionHistory: number;    // 0-200
    complianceRecord: number;      // 0-200
    financialStability: number;    // 0-200
    networkReputation: number;     // 0-200
    operationalMaturity: number;   // 0-200
  };
  factors: CreditFactor[];
  creditLimit: number;        // Max USD exposure recommended
  lastUpdated: number;
}

export interface CreditFactor {
  category: string;
  signal: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  detail: string;
}

export interface AgentFinancialProfile {
  agentId: string;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolumeUsd: number;
  avgTransactionUsd: number;
  policyViolations: number;
  holdEscalations: number;
  disputesRaised: number;
  disputesLost: number;
  accountAgeDays: number;
  lastActivityAt: number;
}

// ---- Credit Scoring Engine ----

export class CreditScoringEngine {
  private profiles: Map<string, AgentFinancialProfile> = new Map();
  private reports: Map<string, CreditReport> = new Map();

  // ---- Profile Management ----

  registerAgent(agentId: string, ageDays?: number): AgentFinancialProfile {
    const profile: AgentFinancialProfile = {
      agentId,
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalVolumeUsd: 0,
      avgTransactionUsd: 0,
      policyViolations: 0,
      holdEscalations: 0,
      disputesRaised: 0,
      disputesLost: 0,
      accountAgeDays: ageDays || 0,
      lastActivityAt: Date.now(),
    };
    this.profiles.set(agentId, profile);
    logger.info(`[CreditScore] Agent registered: ${agentId}`);
    return profile;
  }

  recordTransaction(agentId: string, params: {
    volumeUsd: number;
    success: boolean;
  }): void {
    let profile = this.profiles.get(agentId);
    if (!profile) profile = this.registerAgent(agentId);

    profile.totalTransactions++;
    profile.totalVolumeUsd += params.volumeUsd;
    profile.avgTransactionUsd = profile.totalVolumeUsd / profile.totalTransactions;
    profile.lastActivityAt = Date.now();

    if (params.success) {
      profile.successfulTransactions++;
    } else {
      profile.failedTransactions++;
    }
  }

  recordViolation(agentId: string): void {
    let profile = this.profiles.get(agentId);
    if (!profile) profile = this.registerAgent(agentId);
    profile.policyViolations++;
  }

  recordEscalation(agentId: string): void {
    let profile = this.profiles.get(agentId);
    if (!profile) profile = this.registerAgent(agentId);
    profile.holdEscalations++;
  }

  recordDispute(agentId: string, lost: boolean): void {
    let profile = this.profiles.get(agentId);
    if (!profile) profile = this.registerAgent(agentId);
    profile.disputesRaised++;
    if (lost) profile.disputesLost++;
  }

  // ---- Score Calculation ----

  computeScore(agentId: string): CreditReport {
    let profile = this.profiles.get(agentId);
    if (!profile) profile = this.registerAgent(agentId);

    const factors: CreditFactor[] = [];
    const components = {
      transactionHistory: 0,
      complianceRecord: 0,
      financialStability: 0,
      networkReputation: 0,
      operationalMaturity: 0,
    };

    // 1. Transaction History (0-200)
    const successRate = profile.totalTransactions > 0
      ? profile.successfulTransactions / profile.totalTransactions
      : 0;

    const txScore = Math.min(200,
      Math.round(successRate * 120 + Math.min(profile.totalTransactions, 100) * 0.8));
    components.transactionHistory = txScore;

    factors.push({
      category: 'transaction_history',
      signal: `${profile.totalTransactions} transactions, ${Math.round(successRate * 100)}% success`,
      impact: successRate > 0.95 ? 'positive' : successRate > 0.8 ? 'neutral' : 'negative',
      weight: 0.2,
      detail: `Volume: $${profile.totalVolumeUsd.toFixed(2)}, Avg: $${profile.avgTransactionUsd.toFixed(2)}`,
    });

    // 2. Compliance Record (0-200)
    const violationPenalty = Math.min(200, profile.policyViolations * 40);
    const escalationPenalty = Math.min(80, profile.holdEscalations * 15);
    const complianceScore = Math.max(0, 200 - violationPenalty - escalationPenalty);
    components.complianceRecord = complianceScore;

    factors.push({
      category: 'compliance',
      signal: `${profile.policyViolations} violations, ${profile.holdEscalations} escalations`,
      impact: profile.policyViolations === 0 ? 'positive' : 'negative',
      weight: 0.25,
      detail: violationPenalty === 0 ? 'Clean compliance record' : `−${violationPenalty + escalationPenalty} penalty points`,
    });

    // 3. Financial Stability (0-200)
    const volumeScore = Math.min(100, Math.round(Math.log10(profile.totalVolumeUsd + 1) * 25));
    const consistencyScore = profile.totalTransactions > 5 ? 60 : profile.totalTransactions * 12;
    const stabilityScore = Math.min(200, volumeScore + consistencyScore + (profile.failedTransactions === 0 ? 40 : 0));
    components.financialStability = stabilityScore;

    factors.push({
      category: 'financial_stability',
      signal: `$${profile.totalVolumeUsd.toFixed(2)} total volume`,
      impact: profile.totalVolumeUsd > 500 ? 'positive' : 'neutral',
      weight: 0.2,
      detail: `Consistency: ${consistencyScore}/60, Volume: ${volumeScore}/100`,
    });

    // 4. Network Reputation (0-200)
    const disputeRate = profile.totalTransactions > 0
      ? profile.disputesRaised / profile.totalTransactions
      : 0;
    const disputePenalty = Math.min(100, profile.disputesLost * 50);
    const reputationScore = Math.max(0, 200 - Math.round(disputeRate * 200) - disputePenalty);
    components.networkReputation = reputationScore;

    factors.push({
      category: 'reputation',
      signal: `${profile.disputesRaised} disputes (${profile.disputesLost} lost)`,
      impact: profile.disputesLost === 0 ? 'positive' : 'negative',
      weight: 0.2,
      detail: `Dispute rate: ${(disputeRate * 100).toFixed(1)}%`,
    });

    // 5. Operational Maturity (0-200)
    const ageScore = Math.min(100, profile.accountAgeDays * 2);
    const activityRecency = Date.now() - profile.lastActivityAt < 86_400_000 * 7 ? 60 : 20;
    const maturityScore = Math.min(200, ageScore + activityRecency + (profile.totalTransactions > 20 ? 40 : 0));
    components.operationalMaturity = maturityScore;

    factors.push({
      category: 'maturity',
      signal: `Account age: ${profile.accountAgeDays} days`,
      impact: profile.accountAgeDays > 30 ? 'positive' : 'neutral',
      weight: 0.15,
      detail: `Activity recency bonus: ${activityRecency}, Age bonus: ${ageScore}`,
    });

    // Overall score
    const overallScore = components.transactionHistory
      + components.complianceRecord
      + components.financialStability
      + components.networkReputation
      + components.operationalMaturity;

    // Grade mapping
    const grade: CreditReport['grade'] =
      overallScore >= 900 ? 'AAA' :
      overallScore >= 800 ? 'AA' :
      overallScore >= 700 ? 'A' :
      overallScore >= 600 ? 'BBB' :
      overallScore >= 500 ? 'BB' :
      overallScore >= 400 ? 'B' :
      overallScore >= 300 ? 'CCC' : 'D';

    // Credit limit based on score
    const creditLimit = Math.round(overallScore * 10); // $10 per point

    const report: CreditReport = {
      agentId,
      overallScore,
      grade,
      components,
      factors,
      creditLimit,
      lastUpdated: Date.now(),
    };

    this.reports.set(agentId, report);
    logger.info(`[CreditScore] Score computed for ${agentId}: ${overallScore} (${grade})`);
    return report;
  }

  // ---- Query ----

  getReport(agentId: string): CreditReport | undefined {
    return this.reports.get(agentId);
  }

  getProfile(agentId: string): AgentFinancialProfile | undefined {
    return this.profiles.get(agentId);
  }

  compareAgents(agentIds: string[]): Array<{ agentId: string; score: number; grade: string }> {
    return agentIds.map(id => {
      const report = this.reports.get(id) || this.computeScore(id);
      return { agentId: id, score: report.overallScore, grade: report.grade };
    }).sort((a, b) => b.score - a.score);
  }

  getStats(): {
    totalAgents: number;
    averageScore: number;
    gradeDistribution: Record<string, number>;
  } {
    const allReports = Array.from(this.reports.values());
    const avgScore = allReports.length > 0
      ? Math.round(allReports.reduce((sum, r) => sum + r.overallScore, 0) / allReports.length)
      : 0;

    const gradeDist: Record<string, number> = {};
    allReports.forEach(r => {
      gradeDist[r.grade] = (gradeDist[r.grade] || 0) + 1;
    });

    return {
      totalAgents: this.profiles.size,
      averageScore: avgScore,
      gradeDistribution: gradeDist,
    };
  }

  // ---- Demo ----

  runDemoCreditScoring(): CreditReport[] {
    // Create several agents with different profiles
    const profiles = [
      { id: 'ridhwan-agent', txns: 50, volume: 2500, violations: 0, escalations: 0, disputes: 0, disputesLost: 0, age: 45 },
      { id: 'vendor-alpha', txns: 30, volume: 1200, violations: 1, escalations: 1, disputes: 2, disputesLost: 0, age: 30 },
      { id: 'rogue-bot', txns: 10, volume: 500, violations: 5, escalations: 3, disputes: 4, disputesLost: 3, age: 5 },
    ];

    const reports: CreditReport[] = [];

    for (const p of profiles) {
      this.registerAgent(p.id, p.age);
      for (let i = 0; i < p.txns; i++) {
        this.recordTransaction(p.id, {
          volumeUsd: p.volume / p.txns,
          success: i < p.txns * 0.9,
        });
      }
      for (let i = 0; i < p.violations; i++) this.recordViolation(p.id);
      for (let i = 0; i < p.escalations; i++) this.recordEscalation(p.id);
      for (let i = 0; i < p.disputes; i++) this.recordDispute(p.id, i < p.disputesLost);

      reports.push(this.computeScore(p.id));
    }

    return reports;
  }
}

export const creditScoringEngine = new CreditScoringEngine();
export default creditScoringEngine;
