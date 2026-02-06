// ============================================================
// src/moltbook/daily-poster.ts — Automated Daily Moltbook Poster
// ============================================================
// Runs on a schedule (every 24h) to post build updates to
// the configured Moltbook submolt. This is REQUIRED for
// hackathon compliance — missing daily posts = disqualification.
//
// Can also be triggered manually via CLI or agent action.
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';
import { moltbookClient } from './moltbook-client';
import { auditLedger } from '../policy-engine/audit-ledger';
import { agentRuntime } from '../agent/agent-runtime';

// ---- Daily Highlights Generator ----

function generateDailyHighlights(): string[] {
  const stats = auditLedger.getStats();
  const recent = auditLedger.getRecentEntries(20);

  const highlights: string[] = [];

  // Summarize by action class
  const actionCounts = new Map<string, number>();
  for (const entry of recent) {
    const count = actionCounts.get(entry.actionClass) || 0;
    actionCounts.set(entry.actionClass, count + 1);
  }

  if (stats.executed > 0) {
    highlights.push(`${stats.executed} agent actions executed successfully`);
  }

  if (stats.blocked > 0) {
    highlights.push(`${stats.blocked} risky actions blocked by policy engine`);
  }

  // Find notable actions
  const transfers = recent.filter(e => e.actionClass === 'transfer' && e.status === 'executed');
  if (transfers.length > 0) {
    highlights.push(`${transfers.length} transfers processed through governance layer`);
  }

  const tokenLaunches = recent.filter(e => e.actionClass === 'token_launch');
  if (tokenLaunches.length > 0) {
    highlights.push(`${tokenLaunches.length} token launch requests handled`);
  }

  const swaps = recent.filter(e => e.actionClass === 'swap');
  if (swaps.length > 0) {
    highlights.push(`${swaps.length} swap operations monitored`);
  }

  // Always include core system status
  highlights.push('Policy engine enforcing budget caps, action gating, and address controls');
  highlights.push('Immutable audit ledger recording all actions with receipts');
  highlights.push('Hook interception system operational for pre/post action processing');

  // High-risk blocks
  const highRiskBlocks = recent.filter(
    e => e.status === 'rejected' && e.policyDecision && e.policyDecision.riskScore > 70
  );
  if (highRiskBlocks.length > 0) {
    highlights.push(`🚨 ${highRiskBlocks.length} high-risk actions detected and blocked`);
  }

  return highlights;
}

// ---- Daily Poster Class ----

export class DailyPoster {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private lastPostDate: string = '';

  constructor(intervalHours: number = 24) {
    this.intervalMs = intervalHours * 60 * 60 * 1000;
  }

  /**
   * Start the daily posting scheduler.
   */
  start(): void {
    logger.info(`[DailyPoster] Starting — will post every ${this.intervalMs / 3600000}h`);

    // Post immediately on start
    this.postIfNeeded().catch(err =>
      logger.error(`[DailyPoster] Initial post error: ${err}`)
    );

    // Schedule recurring posts
    this.intervalId = setInterval(() => {
      this.postIfNeeded().catch(err =>
        logger.error(`[DailyPoster] Scheduled post error: ${err}`)
      );
    }, this.intervalMs);
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[DailyPoster] Stopped');
    }
  }

  /**
   * Post only if we haven't posted today yet.
   */
  async postIfNeeded(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    if (this.lastPostDate === today) {
      logger.info(`[DailyPoster] Already posted today (${today}) — skipping`);
      return false;
    }

    if (moltbookClient.hasPostedToday()) {
      logger.info(`[DailyPoster] Moltbook already has a post for today — skipping`);
      this.lastPostDate = today;
      return false;
    }

    await this.postNow();
    this.lastPostDate = today;
    return true;
  }

  /**
   * Force a post right now (bypasses the daily check).
   */
  async postNow(customHighlights?: string[]): Promise<void> {
    const highlights = customHighlights || generateDailyHighlights();

    logger.info('[DailyPoster] Publishing daily update to Moltbook...');

    // Execute through the agent runtime for policy checks + audit
    const result = await agentRuntime.executeAction(
      'moltbook_post',
      'Daily Moltbook build update',
      { highlights, template: 'daily_update' },
      async () => {
        const postResult = await moltbookClient.publishDailyUpdate(highlights);

        return {
          actionId: '',
          agentId: config.agent.id,
          actionClass: 'moltbook_post' as const,
          description: 'Daily Moltbook build update',
          status: postResult.success ? ('success' as const) : ('failure' as const),
          timestamp: Date.now(),
          metadata: {
            postId: postResult.postId,
            url: postResult.url,
            local: postResult.local,
            error: postResult.error,
          },
        };
      }
    );

    if (result.status === 'executed') {
      logger.info(`[DailyPoster] ✅ Daily update published successfully`);
    } else if (result.status === 'rejected') {
      logger.warn(`[DailyPoster] ⚠️ Post blocked by policy: ${result.policyResult?.reason}`);
    } else {
      logger.error(`[DailyPoster] ❌ Post failed`);
    }
  }

  /**
   * Post a custom message to Moltbook.
   */
  async postCustom(title: string, body: string, tags?: string[]): Promise<void> {
    await agentRuntime.executeAction(
      'moltbook_post',
      title,
      { title, body, tags },
      async () => {
        const result = await moltbookClient.publish({
          submolt: config.moltbook.submolt,
          title,
          body,
          tags: tags || ['ridhwan', 'build-in-public'],
        });

        return {
          actionId: '',
          agentId: config.agent.id,
          actionClass: 'moltbook_post' as const,
          description: title,
          status: result.success ? ('success' as const) : ('failure' as const),
          timestamp: Date.now(),
          metadata: {
            postId: result.postId,
            url: result.url,
            local: result.local,
          },
        };
      }
    );
  }
}

export const dailyPoster = new DailyPoster(24);
export default dailyPoster;
