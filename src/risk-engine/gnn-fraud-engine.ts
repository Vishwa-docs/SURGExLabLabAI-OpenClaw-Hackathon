// ============================================================
// src/risk-engine/gnn-fraud-engine.ts — GNN Fraud Detection Engine
// ============================================================
// Graph Neural Network-inspired fraud detection.
// Models transaction graphs, clusters addresses, detects illicit flows.
// Uses message-passing anomaly scoring without external ML dependencies.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface GraphNode {
  id: string;
  address: string;
  type: 'agent' | 'wallet' | 'contract' | 'exchange' | 'unknown';
  features: NodeFeatures;
  cluster?: string;
  riskLabel: 'safe' | 'suspicious' | 'malicious' | 'unknown';
  updatedAt: number;
}

export interface NodeFeatures {
  transactionCount: number;
  totalVolumeUsd: number;
  uniqueCounterparties: number;
  avgTransactionUsd: number;
  maxTransactionUsd: number;
  txFrequencyPerHour: number;
  inOutRatio: number;
  ageMs: number;
  riskScore: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;       // total value transferred
  count: number;        // number of transactions
  lastSeen: number;
  actionClass: string;
  riskContribution: number;
}

export interface FraudAssessment {
  assessmentId: string;
  address: string;
  overallScore: number;        // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: FraudSignal[];
  neighborhood: NeighborhoodAnalysis;
  recommendations: string[];
  timestamp: number;
}

export interface FraudSignal {
  name: string;
  score: number;
  weight: number;
  description: string;
  evidence: string;
}

export interface NeighborhoodAnalysis {
  depth: number;
  nodeCount: number;
  edgeCount: number;
  avgNeighborRisk: number;
  maxNeighborRisk: number;
  clusterRisk: number;
  centralityScore: number;
}

export interface TransactionEvent {
  from: string;
  to: string;
  amountUsd: number;
  actionClass: string;
  txHash?: string;
  timestamp: number;
}

// ---- GNN Fraud Engine ----

export class GnnFraudEngine {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // address -> set of neighbor addresses
  private assessmentHistory: FraudAssessment[] = [];

  // Known malicious patterns (simulation)
  private readonly KNOWN_PATTERNS = {
    rapidDrain: { threshold: 5, windowMs: 60_000, weight: 0.3 },
    unusualVolume: { zScoreThreshold: 2.5, weight: 0.25 },
    circularFlow: { maxDepth: 4, weight: 0.2 },
    newAddressBurst: { ageThresholdMs: 3600_000, txThreshold: 10, weight: 0.15 },
    concentratedCounterparty: { threshold: 0.8, weight: 0.1 },
  };

  // ---- Graph Construction ----

  recordTransaction(event: TransactionEvent): void {
    // Ensure nodes exist
    this.ensureNode(event.from);
    this.ensureNode(event.to);

    // Update node features
    this.updateNodeFeatures(event.from, event, 'outgoing');
    this.updateNodeFeatures(event.to, event, 'incoming');

    // Update edge
    const edgeKey = `${event.from}->${event.to}`;
    const existing = this.edges.get(edgeKey);
    if (existing) {
      existing.weight += event.amountUsd;
      existing.count += 1;
      existing.lastSeen = event.timestamp;
      existing.actionClass = event.actionClass;
    } else {
      this.edges.set(edgeKey, {
        id: uuidv4(),
        from: event.from,
        to: event.to,
        weight: event.amountUsd,
        count: 1,
        lastSeen: event.timestamp,
        actionClass: event.actionClass,
        riskContribution: 0,
      });
    }

    // Update adjacency
    if (!this.adjacency.has(event.from)) this.adjacency.set(event.from, new Set());
    if (!this.adjacency.has(event.to)) this.adjacency.set(event.to, new Set());
    this.adjacency.get(event.from)!.add(event.to);
    this.adjacency.get(event.to)!.add(event.from);

    // Run message passing on affected neighborhood
    this.messagePass(event.from, 2);
    this.messagePass(event.to, 2);

    logger.debug(`[GNN] Recorded tx: ${event.from.slice(0, 8)}→${event.to.slice(0, 8)} $${event.amountUsd}`);
  }

  private ensureNode(address: string): void {
    if (!this.nodes.has(address)) {
      this.nodes.set(address, {
        id: uuidv4(),
        address,
        type: this.classifyAddress(address),
        features: {
          transactionCount: 0,
          totalVolumeUsd: 0,
          uniqueCounterparties: 0,
          avgTransactionUsd: 0,
          maxTransactionUsd: 0,
          txFrequencyPerHour: 0,
          inOutRatio: 1.0,
          ageMs: 0,
          riskScore: 0,
        },
        riskLabel: 'unknown',
        updatedAt: Date.now(),
      });
    }
  }

  private classifyAddress(address: string): GraphNode['type'] {
    if (address.startsWith('0x') && address.length === 42) return 'wallet';
    if (address.includes('contract')) return 'contract';
    if (address.includes('exchange')) return 'exchange';
    if (address.includes('agent')) return 'agent';
    return 'unknown';
  }

  private updateNodeFeatures(address: string, event: TransactionEvent, direction: 'incoming' | 'outgoing'): void {
    const node = this.nodes.get(address)!;
    const f = node.features;

    f.transactionCount += 1;
    f.totalVolumeUsd += event.amountUsd;
    f.avgTransactionUsd = f.totalVolumeUsd / f.transactionCount;
    f.maxTransactionUsd = Math.max(f.maxTransactionUsd, event.amountUsd);

    // Count unique counterparties
    const neighbors = this.adjacency.get(address);
    f.uniqueCounterparties = neighbors ? neighbors.size : 0;

    // In/out ratio
    const outEdges = Array.from(this.edges.values()).filter(e => e.from === address);
    const inEdges = Array.from(this.edges.values()).filter(e => e.to === address);
    const outVolume = outEdges.reduce((s, e) => s + e.weight, 0);
    const inVolume = inEdges.reduce((s, e) => s + e.weight, 0);
    f.inOutRatio = inVolume > 0 ? outVolume / inVolume : outVolume > 0 ? 999 : 1.0;

    // Frequency
    if (f.ageMs <= 0) f.ageMs = 1;
    const firstSeen = node.updatedAt - f.ageMs;
    f.ageMs = Date.now() - firstSeen;
    const hours = Math.max(f.ageMs / 3_600_000, 0.001);
    f.txFrequencyPerHour = f.transactionCount / hours;

    node.updatedAt = Date.now();
  }

  // ---- Message Passing (GNN Core) ----

  private messagePass(address: string, depth: number): void {
    if (depth <= 0) return;

    const node = this.nodes.get(address);
    if (!node) return;

    const neighbors = this.adjacency.get(address);
    if (!neighbors || neighbors.size === 0) return;

    // Aggregate neighbor features
    let neighborRiskSum = 0;
    let neighborCount = 0;

    for (const neighborAddr of neighbors) {
      const neighbor = this.nodes.get(neighborAddr);
      if (neighbor) {
        neighborRiskSum += neighbor.features.riskScore;
        neighborCount += 1;
      }
    }

    const avgNeighborRisk = neighborCount > 0 ? neighborRiskSum / neighborCount : 0;

    // Update this node's risk score incorporating neighbor influence (0.3 weight)
    const selfRisk = this.computeSelfRisk(node);
    node.features.riskScore = 0.7 * selfRisk + 0.3 * avgNeighborRisk;

    // Classify
    if (node.features.riskScore >= 75) node.riskLabel = 'malicious';
    else if (node.features.riskScore >= 50) node.riskLabel = 'suspicious';
    else if (node.features.riskScore >= 25) node.riskLabel = 'unknown';
    else node.riskLabel = 'safe';

    // Propagate to neighbors (reduced depth)
    if (depth > 1) {
      for (const neighborAddr of neighbors) {
        this.messagePass(neighborAddr, depth - 1);
      }
    }
  }

  private computeSelfRisk(node: GraphNode): number {
    const f = node.features;
    let risk = 0;

    // High frequency transactions
    if (f.txFrequencyPerHour > 100) risk += 25;
    else if (f.txFrequencyPerHour > 50) risk += 15;
    else if (f.txFrequencyPerHour > 20) risk += 8;

    // Very high volume
    if (f.totalVolumeUsd > 100_000) risk += 20;
    else if (f.totalVolumeUsd > 10_000) risk += 10;

    // Extreme in/out imbalance (possible drain)
    if (f.inOutRatio > 10 || f.inOutRatio < 0.1) risk += 20;
    else if (f.inOutRatio > 5 || f.inOutRatio < 0.2) risk += 10;

    // Large single transactions
    if (f.maxTransactionUsd > 50_000) risk += 15;
    else if (f.maxTransactionUsd > 5_000) risk += 8;

    // New address with many transactions (sybil indicator)
    if (f.ageMs < 3_600_000 && f.transactionCount > 10) risk += 15;

    // Concentrated counterparty
    if (f.uniqueCounterparties === 1 && f.transactionCount > 5) risk += 10;

    return Math.min(risk, 100);
  }

  // ---- Fraud Assessment ----

  assessAddress(address: string): FraudAssessment {
    this.ensureNode(address);
    const node = this.nodes.get(address)!;
    const signals = this.detectSignals(address);
    const neighborhood = this.analyzeNeighborhood(address, 2);

    // Weighted score from signals
    const signalScore = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
    const neighborScore = neighborhood.avgNeighborRisk * 0.2;
    const overallScore = Math.min(100, Math.round(signalScore + neighborScore));

    const riskLevel: FraudAssessment['riskLevel'] =
      overallScore >= 75 ? 'critical' :
      overallScore >= 50 ? 'high' :
      overallScore >= 25 ? 'medium' : 'low';

    const recommendations = this.generateRecommendations(riskLevel, signals);

    const assessment: FraudAssessment = {
      assessmentId: uuidv4(),
      address,
      overallScore,
      riskLevel,
      signals,
      neighborhood,
      recommendations,
      timestamp: Date.now(),
    };

    this.assessmentHistory.push(assessment);
    if (this.assessmentHistory.length > 1000) {
      this.assessmentHistory = this.assessmentHistory.slice(-500);
    }

    logger.info(`[GNN] Fraud assessment for ${address.slice(0, 10)}: score=${overallScore} level=${riskLevel}`);
    return assessment;
  }

  private detectSignals(address: string): FraudSignal[] {
    const node = this.nodes.get(address)!;
    const f = node.features;
    const signals: FraudSignal[] = [];

    // Signal 1: Rapid drain
    if (f.inOutRatio > 5) {
      signals.push({
        name: 'rapid_drain',
        score: Math.min(100, f.inOutRatio * 10),
        weight: this.KNOWN_PATTERNS.rapidDrain.weight,
        description: 'Outflow significantly exceeds inflow',
        evidence: `In/Out ratio: ${f.inOutRatio.toFixed(2)}`
      });
    }

    // Signal 2: Unusual volume
    const globalAvg = this.getGlobalAvgVolume();
    const globalStd = this.getGlobalStdVolume();
    if (globalStd > 0) {
      const zScore = (f.totalVolumeUsd - globalAvg) / globalStd;
      if (zScore > this.KNOWN_PATTERNS.unusualVolume.zScoreThreshold) {
        signals.push({
          name: 'unusual_volume',
          score: Math.min(100, zScore * 20),
          weight: this.KNOWN_PATTERNS.unusualVolume.weight,
          description: 'Transaction volume is statistical outlier',
          evidence: `Z-score: ${zScore.toFixed(2)}`,
        });
      }
    }

    // Signal 3: Circular flow detection
    const hasCircle = this.detectCircularFlow(address, 4);
    if (hasCircle) {
      signals.push({
        name: 'circular_flow',
        score: 80,
        weight: this.KNOWN_PATTERNS.circularFlow.weight,
        description: 'Circular transaction pattern detected',
        evidence: 'Funds return to origin within 4 hops',
      });
    }

    // Signal 4: New address burst
    if (f.ageMs < this.KNOWN_PATTERNS.newAddressBurst.ageThresholdMs &&
        f.transactionCount > this.KNOWN_PATTERNS.newAddressBurst.txThreshold) {
      signals.push({
        name: 'new_address_burst',
        score: Math.min(100, f.transactionCount * 5),
        weight: this.KNOWN_PATTERNS.newAddressBurst.weight,
        description: 'New address with unusually high activity',
        evidence: `${f.transactionCount} txs in ${(f.ageMs / 60_000).toFixed(1)} minutes`,
      });
    }

    // Signal 5: Concentrated counterparty
    if (f.uniqueCounterparties <= 2 && f.transactionCount > 5) {
      const concentration = f.transactionCount / Math.max(f.uniqueCounterparties, 1);
      if (concentration > 5) {
        signals.push({
          name: 'concentrated_counterparty',
          score: Math.min(100, concentration * 10),
          weight: this.KNOWN_PATTERNS.concentratedCounterparty.weight,
          description: 'Highly concentrated transaction partners',
          evidence: `${f.transactionCount} txs with only ${f.uniqueCounterparties} counterpart(s)`,
        });
      }
    }

    // Signal 6: High-frequency trading
    if (f.txFrequencyPerHour > 30) {
      signals.push({
        name: 'high_frequency',
        score: Math.min(100, f.txFrequencyPerHour * 2),
        weight: 0.15,
        description: 'Abnormally high transaction frequency',
        evidence: `${f.txFrequencyPerHour.toFixed(1)} tx/hour`,
      });
    }

    return signals;
  }

  private detectCircularFlow(startAddress: string, maxDepth: number): boolean {
    const visited = new Set<string>();
    const stack = [{ address: startAddress, depth: 0 }];

    while (stack.length > 0) {
      const { address, depth } = stack.pop()!;
      if (depth > 0 && address === startAddress) return true;
      if (depth >= maxDepth) continue;
      if (visited.has(address) && address !== startAddress) continue;
      visited.add(address);

      // Follow outgoing edges only
      for (const [key, edge] of this.edges) {
        if (edge.from === address) {
          stack.push({ address: edge.to, depth: depth + 1 });
        }
      }
    }
    return false;
  }

  private analyzeNeighborhood(address: string, depth: number): NeighborhoodAnalysis {
    const visited = new Set<string>();
    const queue = [{ addr: address, d: 0 }];
    let edgeCount = 0;
    let riskSum = 0;
    let maxRisk = 0;

    while (queue.length > 0) {
      const { addr, d } = queue.shift()!;
      if (visited.has(addr)) continue;
      visited.add(addr);

      const node = this.nodes.get(addr);
      if (node && addr !== address) {
        riskSum += node.features.riskScore;
        maxRisk = Math.max(maxRisk, node.features.riskScore);
      }

      if (d < depth) {
        const neighbors = this.adjacency.get(addr);
        if (neighbors) {
          for (const n of neighbors) {
            queue.push({ addr: n, d: d + 1 });
            edgeCount++;
          }
        }
      }
    }

    const neighborCount = visited.size - 1;

    // Centrality: ratio of connections to total graph
    const totalNodes = this.nodes.size || 1;
    const centralityScore = neighborCount / totalNodes;

    // Cluster risk: if neighbors are interconnected
    const clusterRisk = neighborCount > 0 ? riskSum / neighborCount : 0;

    return {
      depth,
      nodeCount: visited.size,
      edgeCount,
      avgNeighborRisk: neighborCount > 0 ? riskSum / neighborCount : 0,
      maxNeighborRisk: maxRisk,
      clusterRisk,
      centralityScore: Math.min(1, centralityScore),
    };
  }

  private generateRecommendations(riskLevel: string, signals: FraudSignal[]): string[] {
    const recs: string[] = [];

    if (riskLevel === 'critical') {
      recs.push('BLOCK all transactions immediately');
      recs.push('Escalate to human review');
      recs.push('Freeze associated wallet');
    } else if (riskLevel === 'high') {
      recs.push('Apply HOLD mechanism on all transactions');
      recs.push('Require multi-sig approval');
      recs.push('Increase monitoring frequency');
    } else if (riskLevel === 'medium') {
      recs.push('Enable enhanced logging');
      recs.push('Set lower budget caps');
    }

    for (const s of signals) {
      if (s.name === 'circular_flow') recs.push('Investigate circular fund flow pattern');
      if (s.name === 'rapid_drain') recs.push('Check for unauthorized wallet drain');
      if (s.name === 'new_address_burst') recs.push('Verify identity of new address');
    }

    return recs;
  }

  // ---- Utility ----

  private getGlobalAvgVolume(): number {
    if (this.nodes.size === 0) return 0;
    let sum = 0;
    for (const node of this.nodes.values()) {
      sum += node.features.totalVolumeUsd;
    }
    return sum / this.nodes.size;
  }

  private getGlobalStdVolume(): number {
    const avg = this.getGlobalAvgVolume();
    if (this.nodes.size <= 1) return 0;
    let sumSqDiff = 0;
    for (const node of this.nodes.values()) {
      sumSqDiff += (node.features.totalVolumeUsd - avg) ** 2;
    }
    return Math.sqrt(sumSqDiff / (this.nodes.size - 1));
  }

  // ---- Stats & Getters ----

  getNode(address: string): GraphNode | undefined {
    return this.nodes.get(address);
  }

  getGraphStats(): {
    totalNodes: number;
    totalEdges: number;
    safeNodes: number;
    suspiciousNodes: number;
    maliciousNodes: number;
    assessments: number;
    avgRiskScore: number;
  } {
    let safeCount = 0, suspCount = 0, malCount = 0, riskSum = 0;
    for (const node of this.nodes.values()) {
      riskSum += node.features.riskScore;
      if (node.riskLabel === 'safe') safeCount++;
      else if (node.riskLabel === 'suspicious') suspCount++;
      else if (node.riskLabel === 'malicious') malCount++;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      safeNodes: safeCount,
      suspiciousNodes: suspCount,
      maliciousNodes: malCount,
      assessments: this.assessmentHistory.length,
      avgRiskScore: this.nodes.size > 0 ? Math.round(riskSum / this.nodes.size) : 0,
    };
  }

  getRecentAssessments(limit: number = 20): FraudAssessment[] {
    return this.assessmentHistory.slice(-limit);
  }

  // ---- Demo ----

  runDemoScenario(): { legitimate: FraudAssessment; suspicious: FraudAssessment; malicious: FraudAssessment } {
    // Legitimate pattern
    const legit = '0x1111111111111111111111111111111111111111';
    const vendor = '0x2222222222222222222222222222222222222222';
    for (let i = 0; i < 5; i++) {
      this.recordTransaction({
        from: legit, to: vendor,
        amountUsd: 50 + Math.random() * 100,
        actionClass: 'payment',
        timestamp: Date.now() - (i * 86_400_000),
      });
    }

    // Suspicious pattern (high frequency, new address)
    const susp = '0x3333333333333333333333333333333333333333';
    const dest = '0x4444444444444444444444444444444444444444';
    for (let i = 0; i < 15; i++) {
      this.recordTransaction({
        from: susp, to: dest,
        amountUsd: 200 + Math.random() * 500,
        actionClass: 'transfer',
        timestamp: Date.now() - (i * 60_000), // all within minutes
      });
    }

    // Malicious pattern (circular flow + drain + new)
    const mal1 = '0x5555555555555555555555555555555555555555';
    const mal2 = '0x6666666666666666666666666666666666666666';
    const mal3 = '0x7777777777777777777777777777777777777777';
    for (let i = 0; i < 10; i++) {
      this.recordTransaction({ from: mal1, to: mal2, amountUsd: 5000, actionClass: 'transfer', timestamp: Date.now() - i * 1000 });
      this.recordTransaction({ from: mal2, to: mal3, amountUsd: 4900, actionClass: 'transfer', timestamp: Date.now() - i * 1000 });
      this.recordTransaction({ from: mal3, to: mal1, amountUsd: 4800, actionClass: 'transfer', timestamp: Date.now() - i * 1000 });
    }

    return {
      legitimate: this.assessAddress(legit),
      suspicious: this.assessAddress(susp),
      malicious: this.assessAddress(mal1),
    };
  }
}

export const gnnFraudEngine = new GnnFraudEngine();
export default gnnFraudEngine;
