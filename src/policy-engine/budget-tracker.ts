// ============================================================
// src/policy-engine/budget-tracker.ts — Budget Cap Enforcement
// ============================================================
// Tracks agent spending and enforces budget caps defined
// in the policy schema.
// ============================================================

import databaseManager from './db/database';
import logger from '../utils/logger';
import { BudgetPolicy } from './schemas/policy-schema';

export class BudgetTracker {
  /**
   * Record a spend event.
   */
  recordSpend(agentId: string, actionId: string, amountUsd: number, actionClass: string): void {
    const db = databaseManager.getDb();
    const now = Date.now();
    const date = new Date(now);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const weekKey = this.getWeekKey(date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    db.prepare(`
      INSERT INTO budget_tracking (agent_id, action_id, amount_usd, action_class, timestamp, date_key, week_key, month_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agentId, actionId, amountUsd, actionClass, now, dateKey, weekKey, monthKey);

    logger.info(`[Budget] Recorded $${amountUsd} spend for agent ${agentId} (${actionClass})`);
  }

  /**
   * Check if a proposed spend would violate budget caps.
   */
  checkBudget(
    agentId: string,
    proposedAmountUsd: number,
    budgetPolicy: BudgetPolicy
  ): { allowed: boolean; reason: string; usage: BudgetUsage } {
    const usage = this.getUsage(agentId);

    // Check per-transaction limit
    if (proposedAmountUsd > budgetPolicy.maxPerTransaction) {
      return {
        allowed: false,
        reason: `Transaction amount $${proposedAmountUsd} exceeds per-transaction limit of $${budgetPolicy.maxPerTransaction}`,
        usage,
      };
    }

    // Check daily limit
    if (usage.dailySpend + proposedAmountUsd > budgetPolicy.maxDaily) {
      return {
        allowed: false,
        reason: `Daily spend would be $${usage.dailySpend + proposedAmountUsd}, exceeding daily limit of $${budgetPolicy.maxDaily}`,
        usage,
      };
    }

    // Check weekly limit
    if (budgetPolicy.maxWeekly && usage.weeklySpend + proposedAmountUsd > budgetPolicy.maxWeekly) {
      return {
        allowed: false,
        reason: `Weekly spend would be $${usage.weeklySpend + proposedAmountUsd}, exceeding weekly limit of $${budgetPolicy.maxWeekly}`,
        usage,
      };
    }

    // Check monthly limit
    if (budgetPolicy.maxMonthly && usage.monthlySpend + proposedAmountUsd > budgetPolicy.maxMonthly) {
      return {
        allowed: false,
        reason: `Monthly spend would be $${usage.monthlySpend + proposedAmountUsd}, exceeding monthly limit of $${budgetPolicy.maxMonthly}`,
        usage,
      };
    }

    return {
      allowed: true,
      reason: 'Within budget limits',
      usage,
    };
  }

  /**
   * Get current budget usage for an agent.
   */
  getUsage(agentId: string): BudgetUsage {
    const db = databaseManager.getDb();
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const weekKey = this.getWeekKey(now);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const daily = db
      .prepare('SELECT COALESCE(SUM(amount_usd), 0) as total FROM budget_tracking WHERE agent_id = ? AND date_key = ?')
      .get(agentId, dateKey) as { total: number };

    const weekly = db
      .prepare('SELECT COALESCE(SUM(amount_usd), 0) as total FROM budget_tracking WHERE agent_id = ? AND week_key = ?')
      .get(agentId, weekKey) as { total: number };

    const monthly = db
      .prepare('SELECT COALESCE(SUM(amount_usd), 0) as total FROM budget_tracking WHERE agent_id = ? AND month_key = ?')
      .get(agentId, monthKey) as { total: number };

    const allTime = db
      .prepare('SELECT COALESCE(SUM(amount_usd), 0) as total FROM budget_tracking WHERE agent_id = ?')
      .get(agentId) as { total: number };

    return {
      dailySpend: daily.total,
      weeklySpend: weekly.total,
      monthlySpend: monthly.total,
      allTimeSpend: allTime.total,
      dateKey,
      weekKey,
      monthKey,
    };
  }

  private getWeekKey(date: Date): string {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    const weekNum = Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }
}

export interface BudgetUsage {
  dailySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  allTimeSpend: number;
  dateKey: string;
  weekKey: string;
  monthKey: string;
}

export const budgetTracker = new BudgetTracker();
export default budgetTracker;
