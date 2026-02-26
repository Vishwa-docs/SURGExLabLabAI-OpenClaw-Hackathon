// ============================================================
// src/economic/restaking-optimizer.ts — Dynamic Restaking Optimizer
// ============================================================
// Simulates risk-aware restaking: stake splitting, service cap
// optimization, and risk-return tradeoff modeling.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface StakeAllocation {
  id: string;
  serviceId: string;
  serviceName: string;
  stakeAmountUsd: number;
  apy: number;
  riskScore: number;          // 0-100
  slashingRisk: number;       // 0-1 probability
  expectedReturn: number;     // risk-adjusted
  status: 'active' | 'pending' | 'withdrawn';
  allocatedAt: number;
}

export interface RestakingService {
  id: string;
  name: string;
  baseApy: number;
  riskScore: number;
  capacity: number;           // Max USD
  utilized: number;           // Current USD
  slashingHistory: number;    // Number of events
  uptime: number;             // 0-100%
}

export interface OptimizationResult {
  optimizationId: string;
  totalStake: number;
  allocations: StakeAllocation[];
  expectedTotalReturn: number;
  portfolioRisk: number;
  sharpeRatio: number;
  diversificationScore: number;
  timestamp: number;
}

// ---- Restaking Optimizer ----

export class RestakingOptimizer {
  private services: RestakingService[] = [];
  private allocations: StakeAllocation[] = [];
  private optimizationHistory: OptimizationResult[] = [];

  constructor() {
    // Initialize simulated restaking services
    this.services = [
      { id: 'svc-1', name: 'EigenLayer ETH', baseApy: 5.2, riskScore: 25, capacity: 100000, utilized: 45000, slashingHistory: 0, uptime: 99.8 },
      { id: 'svc-2', name: 'Symbiotic Vault', baseApy: 7.8, riskScore: 45, capacity: 50000, utilized: 28000, slashingHistory: 1, uptime: 98.5 },
      { id: 'svc-3', name: 'Karak Protocol', baseApy: 6.1, riskScore: 35, capacity: 75000, utilized: 32000, slashingHistory: 0, uptime: 99.2 },
      { id: 'svc-4', name: 'Kelp DAO rsETH', baseApy: 4.5, riskScore: 20, capacity: 200000, utilized: 120000, slashingHistory: 0, uptime: 99.9 },
      { id: 'svc-5', name: 'Renzo Protocol', baseApy: 8.5, riskScore: 55, capacity: 30000, utilized: 22000, slashingHistory: 2, uptime: 97.0 },
    ];
  }

  // ---- Optimization ----

  optimize(totalStake: number, riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'): OptimizationResult {
    const riskMultiplier = riskTolerance === 'conservative' ? 0.5 : riskTolerance === 'aggressive' ? 1.5 : 1.0;
    const maxRiskScore = riskTolerance === 'conservative' ? 35 : riskTolerance === 'aggressive' ? 70 : 50;

    // Filter eligible services
    const eligible = this.services.filter(s =>
      s.riskScore <= maxRiskScore && (s.capacity - s.utilized) > 0
    );

    if (eligible.length === 0) {
      return this.createEmptyResult(totalStake);
    }

    // Score each service (higher = better)
    const scored = eligible.map(s => {
      const availableCapacity = s.capacity - s.utilized;
      const slashingPenalty = s.slashingHistory * 15;
      const uptimeBonus = (s.uptime - 95) * 2;

      const score = (s.baseApy * riskMultiplier * 10)
        - (s.riskScore * 0.5)
        - slashingPenalty
        + uptimeBonus;

      return { service: s, score: Math.max(0, score), maxAllocation: availableCapacity };
    });

    scored.sort((a, b) => b.score - a.score);

    // Allocate using score-weighted distribution
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    let remainingStake = totalStake;
    const allocations: StakeAllocation[] = [];

    for (const { service, score, maxAllocation } of scored) {
      if (remainingStake <= 0) break;

      const proportion = totalScore > 0 ? score / totalScore : 1 / scored.length;
      let allocation = Math.min(
        totalStake * proportion,
        maxAllocation,
        remainingStake
      );

      // Minimum allocation threshold
      if (allocation < totalStake * 0.05) continue;

      const slashingRisk = service.slashingHistory > 0
        ? Math.min(0.2, service.slashingHistory * 0.05)
        : 0.001;

      const expectedReturn = allocation * (service.baseApy / 100) * (1 - slashingRisk);

      allocations.push({
        id: uuidv4(),
        serviceId: service.id,
        serviceName: service.name,
        stakeAmountUsd: Math.round(allocation * 100) / 100,
        apy: service.baseApy,
        riskScore: service.riskScore,
        slashingRisk: Math.round(slashingRisk * 1000) / 1000,
        expectedReturn: Math.round(expectedReturn * 100) / 100,
        status: 'active',
        allocatedAt: Date.now(),
      });

      remainingStake -= allocation;
    }

    // Compute portfolio metrics
    const totalReturn = allocations.reduce((s, a) => s + a.expectedReturn, 0);
    const weightedRisk = allocations.reduce((s, a) => s + (a.riskScore * a.stakeAmountUsd), 0) / (totalStake || 1);
    const returnVariance = allocations.reduce((s, a) => s + Math.pow(a.expectedReturn - (totalReturn / allocations.length), 2), 0) / (allocations.length || 1);
    const returnStdDev = Math.sqrt(returnVariance);
    const sharpeRatio = returnStdDev > 0 ? (totalReturn / totalStake) / (returnStdDev / totalStake) : 0;

    // Diversification: 1 - HHI (Herfindahl index)
    const hhi = allocations.reduce((s, a) => s + Math.pow(a.stakeAmountUsd / (totalStake || 1), 2), 0);
    const diversificationScore = Math.round((1 - hhi) * 100);

    this.allocations = [...this.allocations, ...allocations];

    const result: OptimizationResult = {
      optimizationId: uuidv4(),
      totalStake,
      allocations,
      expectedTotalReturn: Math.round(totalReturn * 100) / 100,
      portfolioRisk: Math.round(weightedRisk),
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      diversificationScore,
      timestamp: Date.now(),
    };

    this.optimizationHistory.push(result);
    if (this.optimizationHistory.length > 100) {
      this.optimizationHistory = this.optimizationHistory.slice(-50);
    }

    logger.info(`[Restaking] Optimized $${totalStake}: ${allocations.length} allocations, expected return $${result.expectedTotalReturn}, Sharpe ${result.sharpeRatio}`);
    return result;
  }

  private createEmptyResult(totalStake: number): OptimizationResult {
    return {
      optimizationId: uuidv4(),
      totalStake,
      allocations: [],
      expectedTotalReturn: 0,
      portfolioRisk: 0,
      sharpeRatio: 0,
      diversificationScore: 0,
      timestamp: Date.now(),
    };
  }

  // ---- Query ----

  getServices(): RestakingService[] {
    return [...this.services];
  }

  getAllocations(): StakeAllocation[] {
    return [...this.allocations];
  }

  getHistory(limit: number = 10): OptimizationResult[] {
    return this.optimizationHistory.slice(-limit);
  }

  getStats(): {
    totalStaked: number;
    activeAllocations: number;
    expectedAnnualReturn: number;
    avgPortfolioRisk: number;
    servicesUsed: number;
  } {
    const active = this.allocations.filter(a => a.status === 'active');
    const totalStaked = active.reduce((s, a) => s + a.stakeAmountUsd, 0);
    const totalReturn = active.reduce((s, a) => s + a.expectedReturn, 0);
    const avgRisk = active.length > 0
      ? active.reduce((s, a) => s + a.riskScore, 0) / active.length : 0;

    return {
      totalStaked: Math.round(totalStaked * 100) / 100,
      activeAllocations: active.length,
      expectedAnnualReturn: Math.round(totalReturn * 100) / 100,
      avgPortfolioRisk: Math.round(avgRisk),
      servicesUsed: new Set(active.map(a => a.serviceId)).size,
    };
  }
}

export const restakingOptimizer = new RestakingOptimizer();
export default restakingOptimizer;
