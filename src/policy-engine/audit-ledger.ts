// ============================================================
// src/policy-engine/audit-ledger.ts — Immutable Audit Ledger
// ============================================================
// Records every action, decision, and receipt into SQLite.
// Generates JSON receipts with tx hashes and explorer URLs.
// ============================================================

import databaseManager from './db/database';
import logger from '../utils/logger';

export interface AuditEntry {
  actionId: string;
  agentId: string;
  actionClass: string;
  description: string;
  status: string;
  policyDecision?: {
    allowed: boolean;
    reason: string;
    riskScore: number;
  };
  receipt?: {
    txHash?: string;
    explorerUrl?: string;
    gasUsed?: string;
    costUsd?: number;
  };
  params: Record<string, unknown>;
  timestamp: number;
}

export interface ReceiptJSON {
  version: string;
  actionId: string;
  agentId: string;
  actionClass: string;
  description: string;
  status: string;
  transaction?: {
    hash: string;
    explorerUrl: string;
    gasUsed: string;
    costUsd: number;
  };
  policy: {
    allowed: boolean;
    reason: string;
    riskScore: number;
  };
  timestamp: number;
  generatedAt: number;
}

export class AuditLedger {
  /**
   * Log an action into the audit ledger.
   */
  logAction(entry: AuditEntry): void {
    const db = databaseManager.getDb();

    db.prepare(`
      INSERT INTO audit_log (action_id, agent_id, action_class, description, status, policy_decision_json, receipt_json, params_json, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.actionId,
      entry.agentId,
      entry.actionClass,
      entry.description,
      entry.status,
      entry.policyDecision ? JSON.stringify(entry.policyDecision) : null,
      entry.receipt ? JSON.stringify(entry.receipt) : null,
      JSON.stringify(entry.params),
      entry.timestamp
    );

    // Also store receipt if present
    if (entry.receipt) {
      this.storeReceipt(entry);
    }

    logger.debug(`[Audit] Logged: ${entry.actionId} (${entry.actionClass}) — ${entry.status}`);
  }

  /**
   * Store a receipt record.
   */
  private storeReceipt(entry: AuditEntry): void {
    const db = databaseManager.getDb();

    try {
      db.prepare(`
        INSERT OR REPLACE INTO receipts (action_id, agent_id, action_class, description, status, tx_hash, explorer_url, gas_used, cost_usd, metadata_json, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.actionId,
        entry.agentId,
        entry.actionClass,
        entry.description,
        entry.status,
        entry.receipt?.txHash || null,
        entry.receipt?.explorerUrl || null,
        entry.receipt?.gasUsed || null,
        entry.receipt?.costUsd || null,
        JSON.stringify(entry.params),
        entry.timestamp
      );
    } catch (err) {
      // Ignore duplicates
    }
  }

  /**
   * Generate a JSON receipt for an action.
   */
  generateReceipt(actionId: string): ReceiptJSON | null {
    const db = databaseManager.getDb();
    const row = db
      .prepare('SELECT * FROM audit_log WHERE action_id = ? ORDER BY id DESC LIMIT 1')
      .get(actionId) as any;

    if (!row) return null;

    const policyDecision = row.policy_decision_json
      ? JSON.parse(row.policy_decision_json)
      : { allowed: true, reason: 'N/A', riskScore: 0 };

    const receipt = row.receipt_json ? JSON.parse(row.receipt_json) : null;

    return {
      version: '1.0.0',
      actionId: row.action_id,
      agentId: row.agent_id,
      actionClass: row.action_class,
      description: row.description,
      status: row.status,
      transaction: receipt?.txHash
        ? {
            hash: receipt.txHash,
            explorerUrl: receipt.explorerUrl || `https://basescan.org/tx/${receipt.txHash}`,
            gasUsed: receipt.gasUsed || '0',
            costUsd: receipt.costUsd || 0,
          }
        : undefined,
      policy: policyDecision,
      timestamp: row.timestamp,
      generatedAt: Date.now(),
    };
  }

  /**
   * Get recent audit entries.
   */
  getRecentEntries(limit: number = 50): AuditEntry[] {
    const db = databaseManager.getDb();
    const rows = db
      .prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as any[];

    return rows.map((row) => ({
      actionId: row.action_id,
      agentId: row.agent_id,
      actionClass: row.action_class,
      description: row.description,
      status: row.status,
      policyDecision: row.policy_decision_json ? JSON.parse(row.policy_decision_json) : undefined,
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : undefined,
      params: row.params_json ? JSON.parse(row.params_json) : {},
      timestamp: row.timestamp,
    }));
  }

  /**
   * Get statistics for heartbeat reporting.
   */
  getStats(): { executed: number; blocked: number; total: number } {
    const db = databaseManager.getDb();

    const total = db
      .prepare('SELECT COUNT(*) as count FROM audit_log')
      .get() as { count: number };

    const executed = db
      .prepare("SELECT COUNT(*) as count FROM audit_log WHERE status = 'executed'")
      .get() as { count: number };

    const blocked = db
      .prepare("SELECT COUNT(*) as count FROM audit_log WHERE status = 'rejected'")
      .get() as { count: number };

    return {
      executed: executed.count,
      blocked: blocked.count,
      total: total.count,
    };
  }

  /**
   * Get entries filtered by action class.
   */
  getByActionClass(actionClass: string, limit: number = 50): AuditEntry[] {
    const db = databaseManager.getDb();
    const rows = db
      .prepare('SELECT * FROM audit_log WHERE action_class = ? ORDER BY timestamp DESC LIMIT ?')
      .all(actionClass, limit) as any[];

    return rows.map((row) => ({
      actionId: row.action_id,
      agentId: row.agent_id,
      actionClass: row.action_class,
      description: row.description,
      status: row.status,
      policyDecision: row.policy_decision_json ? JSON.parse(row.policy_decision_json) : undefined,
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : undefined,
      params: row.params_json ? JSON.parse(row.params_json) : {},
      timestamp: row.timestamp,
    }));
  }
}

export const auditLedger = new AuditLedger();
export default auditLedger;
