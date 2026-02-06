// ============================================================
// src/policy-engine/db/database.ts — SQLite Database Layer
// ============================================================
// Manages the SQLite database for policies, audit logs,
// receipts, and budget tracking.
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../../utils/config';
import logger from '../../utils/logger';

class DatabaseManager {
  private db: Database.Database | null = null;

  /**
   * Get/initialize the database connection.
   */
  getDb(): Database.Database {
    if (this.db) return this.db;

    const dbPath = path.resolve(config.db.path);
    const dir = path.dirname(dbPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    logger.info(`[DB] Connected to SQLite: ${dbPath}`);
    this.initializeTables();
    return this.db;
  }

  /**
   * Create all required tables.
   */
  private initializeTables(): void {
    const db = this.db!;

    // ---- Policies Table ----
    db.exec(`
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        description TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        agent_id TEXT,
        org_id TEXT,
        policy_json TEXT NOT NULL,
        hash TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // ---- Audit Log Table ----
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        action_class TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        policy_decision_json TEXT,
        receipt_json TEXT,
        params_json TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
    `);

    // ---- Receipts Table ----
    db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id TEXT NOT NULL UNIQUE,
        agent_id TEXT NOT NULL,
        action_class TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        tx_hash TEXT,
        explorer_url TEXT,
        gas_used TEXT,
        cost_usd REAL,
        metadata_json TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
    `);

    // ---- Budget Tracking Table ----
    db.exec(`
      CREATE TABLE IF NOT EXISTS budget_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        action_class TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        date_key TEXT NOT NULL,
        week_key TEXT NOT NULL,
        month_key TEXT NOT NULL
      );
    `);

    // ---- Indexes ----
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_agent_id ON audit_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_action_class ON audit_log(action_class);
      CREATE INDEX IF NOT EXISTS idx_receipts_agent_id ON receipts(agent_id);
      CREATE INDEX IF NOT EXISTS idx_budget_agent_date ON budget_tracking(agent_id, date_key);
      CREATE INDEX IF NOT EXISTS idx_budget_agent_week ON budget_tracking(agent_id, week_key);
      CREATE INDEX IF NOT EXISTS idx_budget_agent_month ON budget_tracking(agent_id, month_key);
    `);

    logger.info('[DB] Tables initialized');
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('[DB] Connection closed');
    }
  }
}

export const databaseManager = new DatabaseManager();
export default databaseManager;
