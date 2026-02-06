// ============================================================
// src/policy-engine/policy-store.ts — Policy CRUD over SQLite
// ============================================================

import { createHash } from 'crypto';
import databaseManager from './db/database';
import logger from '../utils/logger';
import { Policy, PolicySchema } from './schemas/policy-schema';

export class PolicyStore {
  /**
   * Save or update a policy.
   */
  savePolicy(policy: Policy): void {
    const db = databaseManager.getDb();
    const policyJson = JSON.stringify(policy);
    const hash = createHash('sha256').update(policyJson).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO policies (id, name, version, description, enabled, agent_id, org_id, policy_json, hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        description = excluded.description,
        enabled = excluded.enabled,
        agent_id = excluded.agent_id,
        org_id = excluded.org_id,
        policy_json = excluded.policy_json,
        hash = excluded.hash,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      policy.id,
      policy.name,
      policy.version,
      policy.description || null,
      policy.enabled ? 1 : 0,
      policy.agentId || null,
      policy.orgId || null,
      policyJson,
      hash,
      policy.createdAt,
      Date.now()
    );

    logger.info(`[PolicyStore] Saved policy: ${policy.id} (hash: ${hash.slice(0, 12)}...)`);
  }

  /**
   * Get a policy by ID.
   */
  getPolicy(policyId: string): Policy | null {
    const db = databaseManager.getDb();
    const row = db
      .prepare('SELECT policy_json FROM policies WHERE id = ?')
      .get(policyId) as { policy_json: string } | undefined;

    if (!row) return null;
    return PolicySchema.parse(JSON.parse(row.policy_json));
  }

  /**
   * Get all active policies for an agent.
   */
  getActivePolicies(agentId?: string): Policy[] {
    const db = databaseManager.getDb();
    let rows: Array<{ policy_json: string }>;

    if (agentId) {
      rows = db
        .prepare(
          'SELECT policy_json FROM policies WHERE enabled = 1 AND (agent_id IS NULL OR agent_id = ?)'
        )
        .all(agentId) as Array<{ policy_json: string }>;
    } else {
      rows = db
        .prepare('SELECT policy_json FROM policies WHERE enabled = 1')
        .all() as Array<{ policy_json: string }>;
    }

    return rows.map((r) => PolicySchema.parse(JSON.parse(r.policy_json)));
  }

  /**
   * List all policies (for dashboard).
   */
  listPolicies(): Array<{
    id: string;
    name: string;
    version: string;
    enabled: boolean;
    hash: string;
    updatedAt: number;
  }> {
    const db = databaseManager.getDb();
    const rows = db
      .prepare('SELECT id, name, version, enabled, hash, updated_at FROM policies ORDER BY updated_at DESC')
      .all() as Array<{
      id: string;
      name: string;
      version: string;
      enabled: number;
      hash: string;
      updated_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      version: r.version,
      enabled: r.enabled === 1,
      hash: r.hash,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Delete a policy.
   */
  deletePolicy(policyId: string): boolean {
    const db = databaseManager.getDb();
    const result = db.prepare('DELETE FROM policies WHERE id = ?').run(policyId);
    return result.changes > 0;
  }

  /**
   * Toggle a policy's enabled state.
   */
  togglePolicy(policyId: string, enabled: boolean): void {
    const db = databaseManager.getDb();
    db.prepare('UPDATE policies SET enabled = ?, updated_at = ? WHERE id = ?').run(
      enabled ? 1 : 0,
      Date.now(),
      policyId
    );
  }
}

export const policyStore = new PolicyStore();
export default policyStore;
