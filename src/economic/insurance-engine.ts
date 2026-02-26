// ============================================================
// src/economic/insurance-engine.ts — Agent Insurance Engine
// ============================================================
// Micro insurance premiums based on risk score, automatic claim
// validation, loss coverage pools, policy-controlled reimbursements.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface InsurancePolicy {
  id: string;
  holderId: string;
  type: 'transaction' | 'slashing' | 'exploit' | 'comprehensive';
  coverageUsd: number;
  premiumUsd: number;
  premiumRate: number;          // Annual rate as decimal
  deductibleUsd: number;
  status: 'active' | 'expired' | 'claimed' | 'cancelled';
  riskScore: number;            // Holder's risk score at issuance
  claimsHistory: InsuranceClaim[];
  issuedAt: number;
  expiresAt: number;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  claimantId: string;
  type: string;
  amountRequested: number;
  amountApproved: number;
  evidence: string;
  status: 'submitted' | 'reviewing' | 'approved' | 'denied' | 'paid';
  reason: string;
  submittedAt: number;
  resolvedAt?: number;
}

export interface CoveragePool {
  totalFunds: number;
  reservedFunds: number;
  availableFunds: number;
  totalPremiumsCollected: number;
  totalClaimsPaid: number;
  activePolicies: number;
  lossRatio: number;              // Claims paid / premiums collected
}

// ---- Insurance Engine ----

export class InsuranceEngine {
  private policies: Map<string, InsurancePolicy> = new Map();
  private claims: InsuranceClaim[] = [];
  private pool: CoveragePool = {
    totalFunds: 10000,         // Initial pool seed
    reservedFunds: 0,
    availableFunds: 10000,
    totalPremiumsCollected: 0,
    totalClaimsPaid: 0,
    activePolicies: 0,
    lossRatio: 0,
  };

  // ---- Premium Calculation ----

  calculatePremium(params: {
    coverageUsd: number;
    type: InsurancePolicy['type'];
    riskScore: number;
    durationDays?: number;
  }): { premiumUsd: number; premiumRate: number; deductibleUsd: number } {
    const durationDays = params.durationDays || 30;

    // Base annual rates by type
    const baseRates: Record<string, number> = {
      transaction: 0.02,       // 2% per year
      slashing: 0.05,          // 5% per year
      exploit: 0.08,           // 8% per year
      comprehensive: 0.10,     // 10% per year
    };

    const baseRate = baseRates[params.type] || 0.05;

    // Risk-adjusted rate
    const riskMultiplier = 1 + (params.riskScore / 100) * 1.5; // 1x to 2.5x based on risk
    const adjustedRate = baseRate * riskMultiplier;

    // Pro-rated premium
    const annualPremium = params.coverageUsd * adjustedRate;
    const premiumUsd = Math.round((annualPremium * durationDays / 365) * 100) / 100;

    // Deductible: 10% of coverage
    const deductibleUsd = Math.round(params.coverageUsd * 0.1 * 100) / 100;

    return { premiumUsd, premiumRate: Math.round(adjustedRate * 10000) / 10000, deductibleUsd };
  }

  // ---- Issue Policy ----

  issuePolicy(params: {
    holderId: string;
    type: InsurancePolicy['type'];
    coverageUsd: number;
    riskScore: number;
    durationDays?: number;
  }): InsurancePolicy {
    const durationDays = params.durationDays || 30;
    const premium = this.calculatePremium(params);

    const policy: InsurancePolicy = {
      id: uuidv4(),
      holderId: params.holderId,
      type: params.type,
      coverageUsd: params.coverageUsd,
      premiumUsd: premium.premiumUsd,
      premiumRate: premium.premiumRate,
      deductibleUsd: premium.deductibleUsd,
      status: 'active',
      riskScore: params.riskScore,
      claimsHistory: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + durationDays * 86_400_000,
    };

    this.policies.set(policy.id, policy);

    // Update pool
    this.pool.totalPremiumsCollected += premium.premiumUsd;
    this.pool.availableFunds += premium.premiumUsd;
    this.pool.totalFunds += premium.premiumUsd;
    this.pool.reservedFunds += params.coverageUsd * 0.3; // Reserve 30% of coverage
    this.pool.activePolicies++;

    logger.info(`[Insurance] Policy issued: ${params.type} coverage $${params.coverageUsd} premium $${premium.premiumUsd} for ${params.holderId}`);
    return policy;
  }

  // ---- Submit Claim ----

  submitClaim(params: {
    policyId: string;
    claimantId: string;
    amountRequested: number;
    evidence: string;
  }): InsuranceClaim | null {
    const policy = this.policies.get(params.policyId);
    if (!policy) {
      logger.warn(`[Insurance] Claim failed: policy ${params.policyId} not found`);
      return null;
    }

    if (policy.status !== 'active') {
      logger.warn(`[Insurance] Claim failed: policy ${params.policyId} is ${policy.status}`);
      return null;
    }

    if (params.claimantId !== policy.holderId) {
      logger.warn(`[Insurance] Claim failed: claimant doesn't match policy holder`);
      return null;
    }

    const claim: InsuranceClaim = {
      id: uuidv4(),
      policyId: params.policyId,
      claimantId: params.claimantId,
      type: policy.type,
      amountRequested: params.amountRequested,
      amountApproved: 0,
      evidence: params.evidence,
      status: 'submitted',
      reason: '',
      submittedAt: Date.now(),
    };

    // Auto-validate claim
    this.validateClaim(claim, policy);

    policy.claimsHistory.push(claim);
    this.claims.push(claim);

    return claim;
  }

  private validateClaim(claim: InsuranceClaim, policy: InsurancePolicy): void {
    claim.status = 'reviewing';

    // Validation checks
    const checks = {
      withinCoverage: claim.amountRequested <= policy.coverageUsd,
      evidenceProvided: claim.evidence.length > 10,
      policyActive: policy.status === 'active',
      notExpired: Date.now() < policy.expiresAt,
      poolSufficient: this.pool.availableFunds >= claim.amountRequested,
    };

    const allPassed = Object.values(checks).every(v => v);

    if (allPassed) {
      const afterDeductible = Math.max(0, claim.amountRequested - policy.deductibleUsd);
      claim.amountApproved = Math.min(afterDeductible, policy.coverageUsd);
      claim.status = 'approved';
      claim.reason = `Claim approved: $${claim.amountApproved} after $${policy.deductibleUsd} deductible`;

      // Pay claim
      claim.status = 'paid';
      claim.resolvedAt = Date.now();
      this.pool.totalClaimsPaid += claim.amountApproved;
      this.pool.availableFunds -= claim.amountApproved;
      this.pool.lossRatio = this.pool.totalPremiumsCollected > 0
        ? Math.round((this.pool.totalClaimsPaid / this.pool.totalPremiumsCollected) * 100) / 100
        : 0;

      policy.status = 'claimed';
      this.pool.activePolicies = Math.max(0, this.pool.activePolicies - 1);

      logger.info(`[Insurance] Claim paid: $${claim.amountApproved} for ${claim.claimantId}`);
    } else {
      claim.status = 'denied';
      claim.reason = 'Claim validation failed: ' + Object.entries(checks)
        .filter(([, v]) => !v).map(([k]) => k).join(', ');
      claim.resolvedAt = Date.now();
      logger.warn(`[Insurance] Claim denied: ${claim.reason}`);
    }
  }

  // ---- Query ----

  getPolicy(id: string): InsurancePolicy | undefined {
    return this.policies.get(id);
  }

  listPolicies(holderId?: string): InsurancePolicy[] {
    const all = Array.from(this.policies.values());
    if (holderId) return all.filter(p => p.holderId === holderId);
    return all;
  }

  getPool(): CoveragePool {
    return { ...this.pool };
  }

  getStats(): {
    totalPolicies: number;
    activePolicies: number;
    totalClaimsProcessed: number;
    totalClaimsPaidUsd: number;
    totalPremiumsUsd: number;
    lossRatio: number;
    poolHealth: 'healthy' | 'warning' | 'critical';
  } {
    const poolHealth: 'healthy' | 'warning' | 'critical' =
      this.pool.lossRatio > 0.8 ? 'critical' :
      this.pool.lossRatio > 0.5 ? 'warning' : 'healthy';

    return {
      totalPolicies: this.policies.size,
      activePolicies: this.pool.activePolicies,
      totalClaimsProcessed: this.claims.length,
      totalClaimsPaidUsd: Math.round(this.pool.totalClaimsPaid * 100) / 100,
      totalPremiumsUsd: Math.round(this.pool.totalPremiumsCollected * 100) / 100,
      lossRatio: this.pool.lossRatio,
      poolHealth,
    };
  }

  // ---- Demo ----

  runDemoInsurance(): { policy: InsurancePolicy; claim: InsuranceClaim | null } {
    const policy = this.issuePolicy({
      holderId: 'ridhwan-agent',
      type: 'comprehensive',
      coverageUsd: 1000,
      riskScore: 25,
      durationDays: 30,
    });

    const claim = this.submitClaim({
      policyId: policy.id,
      claimantId: 'ridhwan-agent',
      amountRequested: 250,
      evidence: 'Smart contract exploit detected: unauthorized token transfer of $250 from agent wallet',
    });

    return { policy: this.policies.get(policy.id)!, claim };
  }
}

export const insuranceEngine = new InsuranceEngine();
export default insuranceEngine;
