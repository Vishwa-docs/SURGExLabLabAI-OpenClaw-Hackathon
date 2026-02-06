// ============================================================
// src/policy-engine/engine.ts — Universal Policy Engine
// ============================================================
// Core control plane: evaluates every action against all
// active policies and returns allow/deny decisions.
// ============================================================

import logger from '../utils/logger';
import { policyStore } from './policy-store';
import { budgetTracker } from './budget-tracker';
import { Policy } from './schemas/policy-schema';
import { AgentAction, AgentConfig, PolicyDecision } from '../agent/types';

export class PolicyEngine {
  /**
   * Evaluate an action against all active policies for the agent.
   * Returns a PolicyDecision with allow/deny, reason, and risk score.
   */
  evaluate(action: AgentAction, agent: AgentConfig): PolicyDecision {
    const policies = policyStore.getActivePolicies(agent.id);

    if (policies.length === 0) {
      logger.warn('[PolicyEngine] No active policies found — allowing by default');
      return {
        allowed: true,
        reason: 'No policies configured',
        policyId: 'none',
        riskScore: 0,
        evaluatedAt: Date.now(),
      };
    }

    let riskScore = 0;
    const violations: string[] = [];

    for (const policy of policies) {
      const result = this.evaluatePolicy(action, agent, policy);
      riskScore = Math.max(riskScore, result.riskScore);

      if (!result.allowed) {
        violations.push(`[${policy.name}] ${result.reason}`);
      }
    }

    if (violations.length > 0) {
      return {
        allowed: false,
        reason: violations.join('; '),
        policyId: policies.map((p) => p.id).join(','),
        riskScore,
        evaluatedAt: Date.now(),
      };
    }

    return {
      allowed: true,
      reason: 'All policies passed',
      policyId: policies.map((p) => p.id).join(','),
      riskScore,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluate a single policy against an action.
   */
  private evaluatePolicy(
    action: AgentAction,
    agent: AgentConfig,
    policy: Policy
  ): { allowed: boolean; reason: string; riskScore: number } {
    let riskScore = 0;

    // 1. Action Gating
    if (policy.actionGating) {
      const { blockedActions, allowedActions, requireApproval } = policy.actionGating;

      if (blockedActions.includes(action.actionClass as any)) {
        return {
          allowed: false,
          reason: `Action class "${action.actionClass}" is explicitly blocked`,
          riskScore: 100,
        };
      }

      if (allowedActions.length > 0 && !allowedActions.includes(action.actionClass as any)) {
        return {
          allowed: false,
          reason: `Action class "${action.actionClass}" is not in allowed list`,
          riskScore: 80,
        };
      }

      if (requireApproval.includes(action.actionClass as any)) {
        riskScore += 30;
        // For MVP: log that approval is needed
        logger.warn(`[PolicyEngine] Action "${action.actionClass}" requires human approval`);
      }
    }

    // 2. Budget Check (for payment/transfer/swap actions)
    if (policy.budget && ['payment', 'transfer', 'swap', 'stake'].includes(action.actionClass)) {
      const amountUsd = this.extractAmountUsd(action);
      if (amountUsd > 0) {
        const budgetResult = budgetTracker.checkBudget(agent.id, amountUsd, policy.budget);
        if (!budgetResult.allowed) {
          return {
            allowed: false,
            reason: budgetResult.reason,
            riskScore: 90,
          };
        }
        // Scale risk by how close to limits
        const dailyPct = (budgetResult.usage.dailySpend + amountUsd) / policy.budget.maxDaily;
        riskScore += Math.min(dailyPct * 40, 40);
      }
    }

    // 3. Address Check
    if (policy.addresses) {
      const targetAddress = (action.params.to || action.params.address || '') as string;
      if (targetAddress) {
        const addr = targetAddress.toLowerCase();

        if (
          policy.addresses.mode !== 'allowlist' &&
          policy.addresses.denylist.map((a: string) => a.toLowerCase()).includes(addr)
        ) {
          return {
            allowed: false,
            reason: `Address ${targetAddress} is on the denylist`,
            riskScore: 100,
          };
        }

        if (
          policy.addresses.mode !== 'denylist' &&
          policy.addresses.allowlist.length > 0 &&
          !policy.addresses.allowlist.map((a: string) => a.toLowerCase()).includes(addr)
        ) {
          return {
            allowed: false,
            reason: `Address ${targetAddress} is not on the allowlist`,
            riskScore: 85,
          };
        }
      }
    }

    // 4. Risk Threshold
    if (policy.riskThreshold) {
      if (riskScore > policy.riskThreshold.maxRiskScore) {
        return {
          allowed: false,
          reason: `Risk score ${riskScore} exceeds threshold ${policy.riskThreshold.maxRiskScore}`,
          riskScore,
        };
      }

      if (riskScore > policy.riskThreshold.warnThreshold) {
        logger.warn(
          `[PolicyEngine] Risk warning: score ${riskScore} above warn threshold ${policy.riskThreshold.warnThreshold}`
        );
      }
    }

    // 5. API Domain Check
    if (policy.apiDomains && action.actionClass === 'api_call') {
      const domain = (action.params.domain || action.params.url || '') as string;
      if (domain && policy.apiDomains.blockedDomains.length > 0) {
        for (const blocked of policy.apiDomains.blockedDomains) {
          if (this.domainMatches(domain, blocked)) {
            return {
              allowed: false,
              reason: `Domain "${domain}" matches blocked pattern "${blocked}"`,
              riskScore: 90,
            };
          }
        }
      }
    }

    return { allowed: true, reason: 'Policy passed', riskScore };
  }

  /**
   * Extract USD amount from action params.
   */
  private extractAmountUsd(action: AgentAction): number {
    const amount = action.params.amountUsd || action.params.amount || action.params.value;
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') return parseFloat(amount) || 0;
    return 0;
  }

  /**
   * Simple domain matching with wildcard support.
   */
  private domainMatches(domain: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    return regex.test(domain);
  }
}

export const policyEngine = new PolicyEngine();
export default policyEngine;
