// ============================================================
// src/agent/hooks/audit-hook.ts — Post-hook: Audit Logging
// ============================================================
// Records every executed action into the immutable audit ledger.
// ============================================================

import { HookHandler } from '../types';
import { auditLedger } from '../../policy-engine/audit-ledger';
import logger from '../../utils/logger';

/**
 * Audit logging hook — runs after every agent action.
 * Records the action, its policy decision, and receipt
 * into the SQLite audit ledger.
 */
export const auditHook: HookHandler = async (ctx) => {
  const { action, agent } = ctx;

  try {
    auditLedger.logAction({
      actionId: action.id,
      agentId: agent.id,
      actionClass: action.actionClass,
      description: action.description,
      status: action.status,
      policyDecision: action.policyResult
        ? {
            allowed: action.policyResult.allowed,
            reason: action.policyResult.reason,
            riskScore: action.policyResult.riskScore,
          }
        : undefined,
      receipt: action.receipt
        ? {
            txHash: action.receipt.txHash,
            explorerUrl: action.receipt.explorerUrl,
            gasUsed: action.receipt.gasUsed,
            costUsd: action.receipt.costUsd,
          }
        : undefined,
      params: action.params,
      timestamp: Date.now(),
    });

    logger.info(`[AuditHook] Action ${action.id} recorded in audit ledger`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[AuditHook] Failed to log action: ${errMsg}`);
  }

  return { proceed: true, reason: 'Audit logged' };
};
