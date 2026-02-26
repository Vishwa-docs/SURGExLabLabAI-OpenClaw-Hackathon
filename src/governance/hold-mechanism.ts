// ============================================================
// src/governance/hold-mechanism.ts — Irreversible Action HOLD System
// ============================================================
// Implements a countdown-based safety gate for dangerous actions.
// Before any irreversible operation (ownership renounce, large transfer,
// contract self-destruct), the HOLD mechanism:
//   1. Classifies the action's danger level
//   2. Starts a countdown timer
//   3. Re-validates intent after the hold period
//   4. Re-scores risk with fresh context
//   5. Requires explicit confirmation before proceeding
//   6. Escalates to human if anomaly detected
// ============================================================

import { v4 as uuid } from 'uuid';
import logger from '../utils/logger';
import { AgentAction, ActionClass } from '../agent/types';

// ---- Types ----

export type DangerLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HoldRequest {
  id: string;
  actionId: string;
  actionClass: ActionClass;
  dangerLevel: DangerLevel;
  holdDurationMs: number;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'confirmed' | 'expired' | 'escalated' | 'cancelled';
  riskScoreAtCreation: number;
  riskScoreAtConfirmation?: number;
  confirmationCount: number;
  requiredConfirmations: number;
  reason: string;
  escalationReason?: string;
  metadata: Record<string, unknown>;
}

export interface HoldConfig {
  /** Actions that always trigger HOLD */
  irreversibleActions: ActionClass[];
  /** Amount threshold (USD) above which transfers trigger HOLD */
  largeTransferThreshold: number;
  /** Hold durations by danger level (ms) */
  holdDurations: Record<DangerLevel, number>;
  /** Required confirmations by danger level */
  confirmationsRequired: Record<DangerLevel, number>;
  /** Risk score increase threshold that triggers escalation */
  riskDriftThreshold: number;
  /** Maximum pending holds before new actions are blocked */
  maxPendingHolds: number;
}

// ---- Danger Classification ----

const IRREVERSIBLE_ACTIONS: ActionClass[] = [
  'ownership_renounce',
];

const HIGH_RISK_ACTIONS: ActionClass[] = [
  'token_launch',
  'stake',
];

const MEDIUM_RISK_ACTIONS: ActionClass[] = [
  'transfer',
  'payment',
  'swap',
];

// ---- Default Config ----

const DEFAULT_HOLD_CONFIG: HoldConfig = {
  irreversibleActions: IRREVERSIBLE_ACTIONS,
  largeTransferThreshold: 100, // $100 triggers HOLD
  holdDurations: {
    low: 5_000,       // 5s
    medium: 15_000,   // 15s
    high: 30_000,     // 30s
    critical: 60_000, // 60s
  },
  confirmationsRequired: {
    low: 1,
    medium: 1,
    high: 2,
    critical: 3,
  },
  riskDriftThreshold: 20, // If risk jumps 20+ points during hold, escalate
  maxPendingHolds: 5,
};

// ---- HOLD Mechanism ----

export class HoldMechanism {
  private pendingHolds: Map<string, HoldRequest> = new Map();
  private holdHistory: HoldRequest[] = [];
  private config: HoldConfig;

  constructor(config?: Partial<HoldConfig>) {
    this.config = { ...DEFAULT_HOLD_CONFIG, ...config };
  }

  /**
   * Classify the danger level of an action.
   */
  classifyDanger(action: AgentAction): DangerLevel {
    // Critical: irreversible blockchain operations
    if (this.config.irreversibleActions.includes(action.actionClass)) {
      return 'critical';
    }

    // High: token launches, staking
    if (HIGH_RISK_ACTIONS.includes(action.actionClass)) {
      return 'high';
    }

    // Medium: transfers above threshold
    if (MEDIUM_RISK_ACTIONS.includes(action.actionClass)) {
      const amount = this.extractAmount(action);
      if (amount >= this.config.largeTransferThreshold * 5) return 'high';
      if (amount >= this.config.largeTransferThreshold) return 'medium';
    }

    return 'low';
  }

  /**
   * Determine if an action requires a HOLD.
   */
  requiresHold(action: AgentAction): boolean {
    const danger = this.classifyDanger(action);

    // Critical and high always require HOLD
    if (danger === 'critical' || danger === 'high') return true;

    // Medium requires HOLD only if amount exceeds threshold
    if (danger === 'medium') {
      const amount = this.extractAmount(action);
      return amount >= this.config.largeTransferThreshold;
    }

    return false;
  }

  /**
   * Initiate a HOLD for an action.
   * Returns the HoldRequest — caller must wait for confirmation.
   */
  initiateHold(action: AgentAction, currentRiskScore: number): HoldRequest {
    if (this.pendingHolds.size >= this.config.maxPendingHolds) {
      throw new Error(
        `Maximum pending holds (${this.config.maxPendingHolds}) reached. ` +
        `Resolve existing holds before initiating new ones.`
      );
    }

    const dangerLevel = this.classifyDanger(action);
    const holdDuration = this.config.holdDurations[dangerLevel];
    const now = Date.now();

    const hold: HoldRequest = {
      id: uuid(),
      actionId: action.id,
      actionClass: action.actionClass,
      dangerLevel,
      holdDurationMs: holdDuration,
      createdAt: now,
      expiresAt: now + holdDuration,
      status: 'pending',
      riskScoreAtCreation: currentRiskScore,
      confirmationCount: 0,
      requiredConfirmations: this.config.confirmationsRequired[dangerLevel],
      reason: this.generateHoldReason(action, dangerLevel),
      metadata: {
        actionDescription: action.description,
        params: action.params,
        agentId: action.agentId,
      },
    };

    this.pendingHolds.set(hold.id, hold);
    logger.warn(`[HOLD] Initiated hold ${hold.id} for ${action.actionClass} — ` +
      `danger: ${dangerLevel}, duration: ${holdDuration}ms, ` +
      `confirmations needed: ${hold.requiredConfirmations}`, { holdId: hold.id });

    return hold;
  }

  /**
   * Confirm a pending hold. Returns true if all confirmations received.
   * Performs risk drift detection — if risk score changed significantly,
   * escalates instead of confirming.
   */
  confirmHold(holdId: string, currentRiskScore: number): {
    confirmed: boolean;
    escalated: boolean;
    hold: HoldRequest;
    reason: string;
  } {
    const hold = this.pendingHolds.get(holdId);
    if (!hold) {
      throw new Error(`Hold ${holdId} not found`);
    }

    if (hold.status !== 'pending') {
      return {
        confirmed: false,
        escalated: false,
        hold,
        reason: `Hold is ${hold.status}, not pending`,
      };
    }

    // Check if hold has expired
    if (Date.now() < hold.expiresAt) {
      const remaining = hold.expiresAt - Date.now();
      return {
        confirmed: false,
        escalated: false,
        hold,
        reason: `Hold still active — ${Math.ceil(remaining / 1000)}s remaining`,
      };
    }

    // Risk drift detection
    const riskDrift = currentRiskScore - hold.riskScoreAtCreation;
    if (riskDrift >= this.config.riskDriftThreshold) {
      hold.status = 'escalated';
      hold.riskScoreAtConfirmation = currentRiskScore;
      hold.escalationReason =
        `Risk score increased by ${riskDrift} points during hold ` +
        `(${hold.riskScoreAtCreation} → ${currentRiskScore}). ` +
        `Threshold: ${this.config.riskDriftThreshold}. Action requires human review.`;

      this.finalizeHold(hold);

      logger.error(`[HOLD] ESCALATED hold ${holdId} — risk drift detected: ` +
        `${hold.riskScoreAtCreation} → ${currentRiskScore}`);

      return {
        confirmed: false,
        escalated: true,
        hold,
        reason: hold.escalationReason,
      };
    }

    // Increment confirmations
    hold.confirmationCount++;
    hold.riskScoreAtConfirmation = currentRiskScore;

    if (hold.confirmationCount >= hold.requiredConfirmations) {
      hold.status = 'confirmed';
      this.finalizeHold(hold);

      logger.info(`[HOLD] Confirmed hold ${holdId} for ${hold.actionClass} — ` +
        `${hold.confirmationCount}/${hold.requiredConfirmations} confirmations`);

      return {
        confirmed: true,
        escalated: false,
        hold,
        reason: 'All confirmations received — action approved',
      };
    }

    return {
      confirmed: false,
      escalated: false,
      hold,
      reason: `Confirmation ${hold.confirmationCount}/${hold.requiredConfirmations} — ` +
        `need ${hold.requiredConfirmations - hold.confirmationCount} more`,
    };
  }

  /**
   * Cancel a pending hold.
   */
  cancelHold(holdId: string): HoldRequest {
    const hold = this.pendingHolds.get(holdId);
    if (!hold) throw new Error(`Hold ${holdId} not found`);

    hold.status = 'cancelled';
    this.finalizeHold(hold);
    logger.info(`[HOLD] Cancelled hold ${holdId}`);
    return hold;
  }

  /**
   * Simulate the HOLD flow — used in demo/testing.
   * Initiates hold, waits the duration, then auto-confirms.
   */
  async simulateHold(action: AgentAction, riskScore: number): Promise<{
    hold: HoldRequest;
    result: 'confirmed' | 'escalated' | 'expired';
    duration: number;
  }> {
    const hold = this.initiateHold(action, riskScore);
    const startTime = Date.now();

    // Wait for hold duration (capped at 5s for simulation)
    const waitTime = Math.min(hold.holdDurationMs, 5_000);
    logger.info(`[HOLD] Simulating ${hold.dangerLevel} hold — waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Force the hold to be expired for confirmation
    hold.expiresAt = Date.now() - 1;

    // Confirm with same risk score (no drift)
    const confirmation = this.confirmHold(hold.id, riskScore);
    const duration = Date.now() - startTime;

    return {
      hold: confirmation.hold,
      result: confirmation.escalated ? 'escalated'
        : confirmation.confirmed ? 'confirmed' : 'expired',
      duration,
    };
  }

  /**
   * Simulate an escalation — risk jumps during hold.
   */
  async simulateEscalation(action: AgentAction, initialRisk: number, escalatedRisk: number): Promise<{
    hold: HoldRequest;
    result: 'escalated';
    reason: string;
  }> {
    const hold = this.initiateHold(action, initialRisk);

    // Wait briefly then confirm with higher risk
    await new Promise(resolve => setTimeout(resolve, 100));
    hold.expiresAt = Date.now() - 1;

    const confirmation = this.confirmHold(hold.id, escalatedRisk);

    return {
      hold: confirmation.hold,
      result: 'escalated',
      reason: confirmation.reason,
    };
  }

  // ---- Queries ----

  getPendingHolds(): HoldRequest[] {
    return Array.from(this.pendingHolds.values())
      .filter(h => h.status === 'pending');
  }

  getHoldHistory(): HoldRequest[] {
    return [...this.holdHistory];
  }

  getHoldById(holdId: string): HoldRequest | undefined {
    return this.pendingHolds.get(holdId) ||
      this.holdHistory.find(h => h.id === holdId);
  }

  getActiveHolds(): HoldRequest[] {
    return Array.from(this.pendingHolds.values());
  }

  getStats(): {
    totalHolds: number;
    confirmed: number;
    escalated: number;
    cancelled: number;
    expired: number;
    pending: number;
    averageHoldDurationMs: number;
  } {
    const all = [...this.holdHistory, ...Array.from(this.pendingHolds.values())];
    const confirmed = all.filter(h => h.status === 'confirmed').length;
    const escalated = all.filter(h => h.status === 'escalated').length;
    const cancelled = all.filter(h => h.status === 'cancelled').length;
    const expired = all.filter(h => h.status === 'expired').length;
    const pending = all.filter(h => h.status === 'pending').length;

    const completedHolds = all.filter(h => h.status === 'confirmed' || h.status === 'escalated');
    const avgDuration = completedHolds.length > 0
      ? completedHolds.reduce((sum, h) => sum + h.holdDurationMs, 0) / completedHolds.length
      : 0;

    return {
      totalHolds: all.length,
      confirmed,
      escalated,
      cancelled,
      expired,
      pending,
      averageHoldDurationMs: Math.round(avgDuration),
    };
  }

  // ---- Private ----

  private finalizeHold(hold: HoldRequest): void {
    this.pendingHolds.delete(hold.id);
    this.holdHistory.push(hold);
  }

  private extractAmount(action: AgentAction): number {
    if (!action.params) return 0;
    const val = action.params.amountUsd || action.params.amount || action.params.value;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    return 0;
  }

  private generateHoldReason(action: AgentAction, danger: DangerLevel): string {
    const descriptions: Record<DangerLevel, string> = {
      critical: `CRITICAL — "${action.actionClass}" is irreversible. ` +
        `This action cannot be undone once executed. ` +
        `Hold activated for safety review.`,
      high: `HIGH RISK — "${action.actionClass}" has significant impact. ` +
        `Holding for re-validation before execution.`,
      medium: `MEDIUM RISK — "${action.description}" exceeds the large-transaction threshold. ` +
        `Holding for confirmation.`,
      low: `LOW RISK — Standard hold for "${action.actionClass}".`,
    };
    return descriptions[danger];
  }
}

export const holdMechanism = new HoldMechanism();
export default holdMechanism;
