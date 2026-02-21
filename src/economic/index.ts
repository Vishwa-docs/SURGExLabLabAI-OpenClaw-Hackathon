// ============================================================
// src/economic/index.ts — Economic Module Exports
// ============================================================

export { CostRouter, costRouter, LLMResponse, UsageStats, TaskType, RoutingDecision } from './cost-router';
export { TreasuryTracker, treasuryTracker, TreasurySnapshot, CashFlowEntry, TokenHolding } from './treasury-tracker';
export { ProcurementEngine, procurementEngine } from './procurement-engine';
export { EscrowManager, escrowManager } from './escrow-manager';
export { RestakingOptimizer, restakingOptimizer } from './restaking-optimizer';
export { InsuranceEngine, insuranceEngine } from './insurance-engine';
// Week 5
export { TradingEngine, tradingEngine } from './trading-engine';
export type { Order, Position, Trade, PerformanceMetrics, LeaderboardEntry } from './trading-engine';
export { PredictionMarketEngine, predictionMarketEngine } from './prediction-market';
export type { PredictionMarket, MarketPosition, MarketTrade, MarketResolution } from './prediction-market';
export { DeFiAggregator, defiAggregator } from './defi-aggregator';
export type { YieldPool, YieldStrategy, DeFiProtocol, DeFiSnapshot } from './defi-aggregator';
export { RevenueSharingEngine, revenueSharingEngine } from './revenue-sharing';
export type { SkillListing, SkillUsage, AgentEarnings, MarketplaceStats } from './revenue-sharing';
