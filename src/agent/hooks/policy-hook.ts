// ============================================================
// src/agent/hooks/policy-hook.ts — Pre-hook: Policy Engine Gate
// ============================================================
// Intercepts every action and runs it through the policy engine
// before allowing execution.
// ============================================================

import { HookHandler } from '../types';
import { policyEngine } from '../../policy-engine/engine';
import logger from '../../utils/logger';

/**
 * Policy enforcement hook — runs before every agent action.
 * Evaluates the action against all active policies and blocks
 * if any policy is violated.
 */
export const policyHook: HookHandler = async (ctx) => {
  const { action, agent } = ctx;

  logger.info(`[PolicyHook] Evaluating action ${action.id} (${action.actionClass})`);

  const decision = policyEngine.evaluate(action, agent);

  // Attach the decision to the action
  ctx.action.policyResult = decision;

  if (!decision.allowed) {
    logger.warn(
      `[PolicyHook] Action BLOCKED: ${action.actionClass} — ${decision.reason} (risk: ${decision.riskScore})`
    );
    return {
      proceed: false,
      reason: `Policy violation: ${decision.reason}`,
    };
  }

  logger.info(
    `[PolicyHook] Action APPROVED: ${action.actionClass} (risk: ${decision.riskScore})`
  );

  return { proceed: true, reason: 'Policy check passed' };
};
