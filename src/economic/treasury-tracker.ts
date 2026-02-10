// ============================================================
// src/economic/treasury-tracker.ts — Treasury & Portfolio Tracker
// ============================================================
// Tracks all wallet balances, token holdings, cash flows, and P&L
// across the agent's economic activity. Provides real-time treasury
// view for the dashboard and compliance reporting.
//
// Features:
//   - Multi-chain balance tracking (Base, BNB)
//   - Token portfolio with cost basis
//   - Cash flow ledger (inflows/outflows)
//   - P&L calculation (realized + unrealized)
//   - Treasury health scoring
//   - Export for compliance reports
// ============================================================

import logger from '../utils/logger';
import { config } from '../utils/config';

// ---- Types ----

export interface TokenHolding {
  tokenAddress: string;
  symbol: string;
  balance: number;
  costBasisUsd: number;     // Total cost to acquire
  currentValueUsd: number;
  unrealizedPnlUsd: number;
  chain: string;
  lastUpdated: number;
}

export interface CashFlowEntry {
  id: string;
  timestamp: number;
  type: 'inflow' | 'outflow';
  category: 'funding' | 'transfer' | 'trade_buy' | 'trade_sell' | 'gas_fee' | 'token_launch' | 'reward';
  amountUsd: number;
  description: string;
  txHash?: string;
  chain?: string;
  metadata?: Record<string, unknown>;
}

export interface TreasurySnapshot {
  timestamp: number;
  nativeBalances: Record<string, { chain: string; balance: number; valueUsd: number }>;
  tokenHoldings: TokenHolding[];
  totalValueUsd: number;
  cashFlowSummary: {
    totalInflows: number;
    totalOutflows: number;
    netFlow: number;
    period: string;
  };
  pnl: {
    realized: number;
    unrealized: number;
    total: number;
  };
  healthScore: number;  // 0-100
  healthStatus: 'critical' | 'low' | 'adequate' | 'healthy' | 'excellent';
}

// ---- Treasury Tracker ----

export class TreasuryTracker {
  private nativeBalances: Map<string, { chain: string; balance: number; valueUsd: number }> = new Map();
  private tokenHoldings: Map<string, TokenHolding> = new Map();
  private cashFlows: CashFlowEntry[] = [];
  private realizedPnl: number = 0;
  private maxCashFlowHistory: number = 5000;

  constructor() {
    // Initialize with known chains
    this.nativeBalances.set('base', { chain: 'Base (ETH)', balance: 0, valueUsd: 0 });
    this.nativeBalances.set('bnb', { chain: 'BNB Chain', balance: 0, valueUsd: 0 });
  }

  /**
   * Update a native balance (ETH, BNB).
   */
  updateNativeBalance(chainKey: string, balance: number, valueUsd: number): void {
    this.nativeBalances.set(chainKey, {
      chain: chainKey === 'base' ? 'Base (ETH)' : chainKey === 'bnb' ? 'BNB Chain' : chainKey,
      balance,
      valueUsd,
    });
    logger.info(`[Treasury] Updated ${chainKey} balance: ${balance} ($${valueUsd.toFixed(4)})`);
  }

  /**
   * Record a token acquisition (buy or receive).
   */
  recordTokenAcquisition(params: {
    tokenAddress: string;
    symbol: string;
    amount: number;
    costUsd: number;
    chain: string;
    txHash?: string;
  }): void {
    const key = `${params.chain}:${params.tokenAddress}`;
    const existing = this.tokenHoldings.get(key);

    if (existing) {
      existing.balance += params.amount;
      existing.costBasisUsd += params.costUsd;
      existing.lastUpdated = Date.now();
    } else {
      this.tokenHoldings.set(key, {
        tokenAddress: params.tokenAddress,
        symbol: params.symbol,
        balance: params.amount,
        costBasisUsd: params.costUsd,
        currentValueUsd: params.costUsd, // Assume current = cost initially
        unrealizedPnlUsd: 0,
        chain: params.chain,
        lastUpdated: Date.now(),
      });
    }

    this.recordCashFlow({
      type: 'outflow',
      category: 'trade_buy',
      amountUsd: params.costUsd,
      description: `Bought ${params.amount} ${params.symbol}`,
      txHash: params.txHash,
      chain: params.chain,
    });

    logger.info(`[Treasury] Acquired ${params.amount} ${params.symbol} for $${params.costUsd}`);
  }

  /**
   * Record a token sale.
   */
  recordTokenSale(params: {
    tokenAddress: string;
    symbol: string;
    amount: number;
    proceedsUsd: number;
    chain: string;
    txHash?: string;
  }): void {
    const key = `${params.chain}:${params.tokenAddress}`;
    const holding = this.tokenHoldings.get(key);

    if (holding) {
      // Calculate realized P&L using average cost basis
      const avgCostPerUnit = holding.costBasisUsd / holding.balance;
      const costOfSold = avgCostPerUnit * params.amount;
      const realizedPnl = params.proceedsUsd - costOfSold;
      this.realizedPnl += realizedPnl;

      holding.balance -= params.amount;
      holding.costBasisUsd -= costOfSold;

      if (holding.balance <= 0) {
        this.tokenHoldings.delete(key);
      } else {
        holding.lastUpdated = Date.now();
      }

      logger.info(`[Treasury] Sold ${params.amount} ${params.symbol} — ` +
        `proceeds: $${params.proceedsUsd.toFixed(2)}, P&L: $${realizedPnl.toFixed(2)}`);
    }

    this.recordCashFlow({
      type: 'inflow',
      category: 'trade_sell',
      amountUsd: params.proceedsUsd,
      description: `Sold ${params.amount} ${params.symbol}`,
      txHash: params.txHash,
      chain: params.chain,
    });
  }

  /**
   * Record a generic cash flow event.
   */
  recordCashFlow(params: Omit<CashFlowEntry, 'id' | 'timestamp'>): void {
    const entry: CashFlowEntry = {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...params,
    };
    this.cashFlows.push(entry);

    // Trim history
    if (this.cashFlows.length > this.maxCashFlowHistory) {
      this.cashFlows = this.cashFlows.slice(-this.maxCashFlowHistory);
    }
  }

  /**
   * Record wallet funding (free from SURGE).
   */
  recordFunding(chain: string, amount: number, valueUsd: number, txHash?: string): void {
    this.recordCashFlow({
      type: 'inflow',
      category: 'funding',
      amountUsd: valueUsd,
      description: `Free wallet funding on ${chain}`,
      txHash,
      chain,
    });
  }

  /**
   * Record gas fee spent.
   */
  recordGasFee(chain: string, feeUsd: number, txHash?: string): void {
    this.recordCashFlow({
      type: 'outflow',
      category: 'gas_fee',
      amountUsd: feeUsd,
      description: `Gas fee on ${chain}`,
      txHash,
      chain,
    });
  }

  /**
   * Update current market values for all holdings (simulation).
   * In a real system, this would fetch prices from an oracle.
   */
  simulateMarketUpdate(priceMultiplier: number = 1.0): void {
    for (const holding of this.tokenHoldings.values()) {
      const avgCost = holding.costBasisUsd / Math.max(holding.balance, 1);
      holding.currentValueUsd = holding.balance * avgCost * priceMultiplier;
      holding.unrealizedPnlUsd = holding.currentValueUsd - holding.costBasisUsd;
      holding.lastUpdated = Date.now();
    }
  }

  /**
   * Get a full treasury snapshot.
   */
  getSnapshot(): TreasurySnapshot {
    const nativeBalances: Record<string, { chain: string; balance: number; valueUsd: number }> = {};
    let nativeTotal = 0;
    for (const [key, val] of this.nativeBalances) {
      nativeBalances[key] = val;
      nativeTotal += val.valueUsd;
    }

    const holdings = Array.from(this.tokenHoldings.values());
    const holdingsTotal = holdings.reduce((s, h) => s + h.currentValueUsd, 0);

    const totalValueUsd = nativeTotal + holdingsTotal;

    // Cash flow summary (last 24h)
    const dayAgo = Date.now() - 86_400_000;
    const recentFlows = this.cashFlows.filter(f => f.timestamp > dayAgo);
    const totalInflows = recentFlows.filter(f => f.type === 'inflow').reduce((s, f) => s + f.amountUsd, 0);
    const totalOutflows = recentFlows.filter(f => f.type === 'outflow').reduce((s, f) => s + f.amountUsd, 0);

    // Unrealized P&L
    const unrealized = holdings.reduce((s, h) => s + h.unrealizedPnlUsd, 0);

    // Health scoring
    const healthScore = this.calculateHealthScore(totalValueUsd, totalInflows, totalOutflows);

    return {
      timestamp: Date.now(),
      nativeBalances,
      tokenHoldings: holdings,
      totalValueUsd,
      cashFlowSummary: {
        totalInflows,
        totalOutflows,
        netFlow: totalInflows - totalOutflows,
        period: '24h',
      },
      pnl: {
        realized: this.realizedPnl,
        unrealized,
        total: this.realizedPnl + unrealized,
      },
      healthScore,
      healthStatus: this.healthScoreToStatus(healthScore),
    };
  }

  /**
   * Get cash flow history.
   */
  getCashFlows(limit: number = 50): CashFlowEntry[] {
    return this.cashFlows.slice(-limit);
  }

  /**
   * Get treasury stats for dashboard.
   */
  getStats(): {
    totalValueUsd: number;
    nativeChains: number;
    tokenCount: number;
    cashFlowCount: number;
    realizedPnl: number;
    healthScore: number;
  } {
    const snapshot = this.getSnapshot();
    return {
      totalValueUsd: snapshot.totalValueUsd,
      nativeChains: this.nativeBalances.size,
      tokenCount: this.tokenHoldings.size,
      cashFlowCount: this.cashFlows.length,
      realizedPnl: this.realizedPnl,
      healthScore: snapshot.healthScore,
    };
  }

  // ---- Private ----

  private calculateHealthScore(totalValue: number, inflows: number, outflows: number): number {
    let score = 50; // Base

    // Value component (0-30 points)
    if (totalValue >= 100) score += 30;
    else if (totalValue >= 10) score += 20;
    else if (totalValue >= 1) score += 10;
    else if (totalValue > 0) score += 5;

    // Cash flow health (0-20 points)
    if (inflows >= outflows) score += 20;
    else if (inflows >= outflows * 0.5) score += 10;

    // Diversification bonus
    if (this.tokenHoldings.size >= 3) score += 5;
    if (this.nativeBalances.size >= 2) score += 5;

    // Negative adjustments
    if (totalValue === 0) score -= 20;
    if (outflows > inflows * 2) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private healthScoreToStatus(score: number): TreasurySnapshot['healthStatus'] {
    if (score <= 20) return 'critical';
    if (score <= 40) return 'low';
    if (score <= 60) return 'adequate';
    if (score <= 80) return 'healthy';
    return 'excellent';
  }
}

export const treasuryTracker = new TreasuryTracker();
export default treasuryTracker;
