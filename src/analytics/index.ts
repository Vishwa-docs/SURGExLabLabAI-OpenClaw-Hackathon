// ============================================================
// src/analytics/index.ts — Analytics module re-exports
// ============================================================

export { riskDashboard, RiskDashboard } from './risk-dashboard';
export type { DashboardSnapshot, RiskAlert, SankeyData } from './risk-dashboard';

export { carbonTracker, CarbonTracker } from './carbon-tracker';
export type { CarbonReport, ESGScore, CarbonEntry } from './carbon-tracker';

export { auditExport, AuditExport } from './audit-export';
export type { AuditPacket, AuditSummary } from './audit-export';

// Week 5
export { trendEngine, TrendEngine } from './trend-engine';
export type { MarketTrend, MomentumIndicators, TrendSignal, SectorPerformance, AnomalyAlert, MarketOverview } from './trend-engine';
