// ============================================================
// src/agent/heartbeat/scheduler.ts — Heartbeat & Moltbook Poster
// ============================================================
// Periodically posts build updates to Moltbook submolt.
// Uses the MoltbookClient for real API integration.
// Satisfies the "daily Moltbook lablab submolt posting" requirement.
// ============================================================

import { config } from '../../utils/config';
import logger from '../../utils/logger';
import { HeartbeatPayload } from '../types';
import { auditLedger } from '../../policy-engine/audit-ledger';
import { surgeWallet } from '../../surge/wallet/wallet-manager';
import { moltbookClient } from '../../moltbook/moltbook-client';

// ---- Heartbeat Generator ----

async function generateHeartbeat(): Promise<HeartbeatPayload> {
  const stats = auditLedger.getStats();
  let balance = 'unknown';
  try {
    balance = await surgeWallet.getBalance();
  } catch {
    // wallet may not be configured yet
  }

  return {
    agentId: config.agent.id,
    agentName: config.agent.name,
    timestamp: Date.now(),
    status: 'running',
    actionsExecuted: stats.executed,
    actionsBlocked: stats.blocked,
    walletBalance: balance,
    summary: `Ridhwan agent "${config.agent.name}" is operational. ${stats.executed} actions executed, ${stats.blocked} blocked by policy. Wallet balance: ${balance} ETH.`,
  };
}

// ---- Public API ----

export async function runHeartbeat(): Promise<void> {
  logger.info('[Heartbeat] Generating heartbeat...');
  const heartbeat = await generateHeartbeat();
  const date = new Date(heartbeat.timestamp).toISOString().split('T')[0];

  // Use MoltbookClient for posting (handles real API, verification, local fallback)
  const result = await moltbookClient.publish({
    submolt: config.moltbook.submolt,
    title: `🔥 Ridhwan Daily Build Update — ${date}`,
    body: [
      `## Agent Status: ${heartbeat.status.toUpperCase()}`,
      '',
      `**Agent:** ${heartbeat.agentName} (\`${heartbeat.agentId}\`)`,
      `**Wallet Balance:** ${heartbeat.walletBalance} ETH`,
      '',
      `### Activity Summary`,
      `- Actions Executed: **${heartbeat.actionsExecuted}**`,
      `- Actions Blocked by Policy: **${heartbeat.actionsBlocked}**`,
      '',
      `### What We Built Today`,
      `- Policy engine enforcement active`,
      `- Hook interception system operational`,
      `- SURGE wallet integration live (server-managed via API)`,
      `- Audit ledger recording all actions`,
      '',
      `> ${heartbeat.summary}`,
      '',
      `---`,
      `*Posted automatically by Ridhwan Heartbeat System*`,
    ].join('\n'),
    tags: ['ridhwan', 'build-in-public', 'openclaw', 'surge', 'ai-agents'],
  });

  if (result.success) {
    logger.info(`[Heartbeat] Successfully posted to Moltbook (id: ${result.postId})`);
  } else {
    logger.error(`[Heartbeat] Failed to post: ${result.error}`);
  }
}

export class HeartbeatScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;

  constructor(intervalHours: number = 24) {
    this.intervalMs = intervalHours * 60 * 60 * 1000;
  }

  start(): void {
    logger.info(`[Heartbeat] Scheduler started — posting every ${this.intervalMs / 3600000}h`);
    // Run immediately on start
    runHeartbeat().catch((err) => logger.error(`[Heartbeat] Error: ${err}`));
    // Then schedule repeating
    this.intervalId = setInterval(() => {
      runHeartbeat().catch((err) => logger.error(`[Heartbeat] Error: ${err}`));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[Heartbeat] Scheduler stopped');
    }
  }

  /** Manually trigger a heartbeat post */
  async postNow(): Promise<void> {
    await runHeartbeat();
  }
}

export const heartbeatScheduler = new HeartbeatScheduler(24);
