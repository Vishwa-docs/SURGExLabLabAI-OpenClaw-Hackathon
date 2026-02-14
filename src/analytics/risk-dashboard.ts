// ============================================================
// src/analytics/risk-dashboard.ts — Risk Dashboard Data Provider
// ============================================================
// Aggregates risk data into dashboard-ready structures:
// Sankey money flow, risk heatmaps, timeline graphs.
// ============================================================

import logger from '../utils/logger';
import { riskScorer } from '../governance/risk-scorer';
import { gnnFraudEngine } from '../risk-engine/gnn-fraud-engine';

// ---- Types ----

export interface DashboardSnapshot {
  overall: OverallRiskMetrics;
  timeline: TimelineEntry[];
  heatmap: HeatmapCell[];
  moneyFlow: SankeyData;
  topRisks: RiskAlert[];
  generatedAt: number;
}

export interface OverallRiskMetrics {
  currentRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  totalAssessments: number;
  blockedActions: number;
  highRiskAddresses: number;
}

export interface TimelineEntry {
  timestamp: number;
  riskScore: number;
  actionCount: number;
  blockedCount: number;
  label: string;
}

export interface HeatmapCell {
  actionClass: string;
  riskBucket: string;
  count: number;
  intensity: number;    // 0-1
}

export interface SankeyData {
  nodes: Array<{ id: string; label: string; value: number }>;
  links: Array<{ source: string; target: string; value: number }>;
}

export interface RiskAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  address?: string;
  actionClass?: string;
  timestamp: number;
}

// ---- Risk Dashboard ----

export class RiskDashboard {
  private timelineHistory: TimelineEntry[] = [];
  private alerts: RiskAlert[] = [];

  // ---- Main Snapshot ----

  getSnapshot(): DashboardSnapshot {
    const gnnStats = gnnFraudEngine.getGraphStats();
    const riskStats = riskScorer.getStats();
    const riskTrend = riskScorer.getRiskTrend(10);

    return {
      overall: this.computeOverallMetrics(gnnStats, riskStats, riskTrend),
      timeline: this.timelineHistory.slice(-50),
      heatmap: this.generateHeatmap(),
      moneyFlow: this.generateSankeyData(),
      topRisks: this.alerts.slice(-10),
      generatedAt: Date.now(),
    };
  }

  private computeOverallMetrics(gnnStats: any, riskStats: any, riskTrend: any): OverallRiskMetrics {
    const avgRisk = gnnStats.avgRiskScore || 0;
    const riskLevel: OverallRiskMetrics['currentRiskLevel'] =
      avgRisk >= 75 ? 'critical' :
      avgRisk >= 50 ? 'high' :
      avgRisk >= 25 ? 'medium' : 'low';

    const trend: OverallRiskMetrics['trend'] =
      riskTrend.direction === 'increasing' ? 'deteriorating' :
      riskTrend.direction === 'decreasing' ? 'improving' : 'stable';

    return {
      currentRiskLevel: riskLevel,
      riskScore: avgRisk,
      trend,
      totalAssessments: gnnStats.assessments + (riskStats.assessments || 0),
      blockedActions: riskStats.highRiskBlocks || 0,
      highRiskAddresses: gnnStats.suspiciousNodes + gnnStats.maliciousNodes,
    };
  }

  // ---- Record Events ----

  recordTimelineEntry(params: {
    riskScore: number;
    actionCount: number;
    blockedCount: number;
    label?: string;
  }): void {
    this.timelineHistory.push({
      timestamp: Date.now(),
      riskScore: params.riskScore,
      actionCount: params.actionCount,
      blockedCount: params.blockedCount,
      label: params.label || new Date().toISOString().slice(11, 19),
    });

    if (this.timelineHistory.length > 500) {
      this.timelineHistory = this.timelineHistory.slice(-250);
    }
  }

  addAlert(severity: RiskAlert['severity'], message: string, address?: string): void {
    this.alerts.push({
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severity,
      message,
      address,
      timestamp: Date.now(),
    });

    if (this.alerts.length > 200) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  // ---- Generators ----

  private generateHeatmap(): HeatmapCell[] {
    const actionClasses = ['payment', 'transfer', 'token_launch', 'swap', 'stake', 'governance_vote', 'api_call'];
    const riskBuckets = ['0-25', '25-50', '50-75', '75-100'];
    const cells: HeatmapCell[] = [];

    for (const action of actionClasses) {
      for (const bucket of riskBuckets) {
        // Generate simulated data based on action risk profiles
        const baseIntensity =
          action === 'token_launch' ? 0.7 :
          action === 'transfer' ? 0.5 :
          action === 'payment' ? 0.3 :
          action === 'swap' ? 0.6 :
          action === 'stake' ? 0.4 : 0.2;

        const bucketWeight =
          bucket === '0-25' ? 0.3 :
          bucket === '25-50' ? 0.4 :
          bucket === '50-75' ? 0.6 : 0.9;

        const count = Math.round(Math.random() * 20 * baseIntensity);
        const intensity = Math.min(1, baseIntensity * bucketWeight + Math.random() * 0.1);

        cells.push({ actionClass: action, riskBucket: bucket, count, intensity });
      }
    }

    return cells;
  }

  private generateSankeyData(): SankeyData {
    const gnnStats = gnnFraudEngine.getGraphStats();

    // Build from GNN graph data
    const nodes: SankeyData['nodes'] = [
      { id: 'agent-wallet', label: 'Ridhwan Agent', value: 100 },
      { id: 'surge-platform', label: 'SURGE Platform', value: 60 },
      { id: 'external-wallets', label: 'External Wallets', value: 30 },
      { id: 'gas-fees', label: 'Gas Fees', value: 5 },
      { id: 'token-launches', label: 'Token Launches', value: 20 },
      { id: 'vendor-payments', label: 'Vendor Payments', value: 15 },
    ];

    const links: SankeyData['links'] = [
      { source: 'agent-wallet', target: 'surge-platform', value: 60 },
      { source: 'agent-wallet', target: 'external-wallets', value: 25 },
      { source: 'agent-wallet', target: 'gas-fees', value: 5 },
      { source: 'surge-platform', target: 'token-launches', value: 20 },
      { source: 'surge-platform', target: 'vendor-payments', value: 15 },
      { source: 'external-wallets', target: 'vendor-payments', value: 10 },
    ];

    return { nodes, links };
  }

  // ---- Stats ----

  getStats(): {
    timelineEntries: number;
    alertCount: number;
    criticalAlerts: number;
    warningAlerts: number;
  } {
    return {
      timelineEntries: this.timelineHistory.length,
      alertCount: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length,
      warningAlerts: this.alerts.filter(a => a.severity === 'warning').length,
    };
  }
}

export const riskDashboard = new RiskDashboard();
export default riskDashboard;
