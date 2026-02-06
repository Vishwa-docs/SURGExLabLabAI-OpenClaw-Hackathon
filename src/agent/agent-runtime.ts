// ============================================================
// src/agent/agent-runtime.ts — OpenClaw Agent Runtime
// ============================================================
// The core agent loop: receives actions, runs them through hooks,
// executes, and emits receipts.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { config } from '../utils/config';
import hookManager from './hooks/hook-manager';
import { policyHook } from './hooks/policy-hook';
import { auditHook } from './hooks/audit-hook';
import { surgeWallet } from '../surge/wallet/wallet-manager';
import { heartbeatScheduler } from './heartbeat/scheduler';
import { dailyPoster } from '../moltbook/daily-poster';
import {
  AgentAction,
  AgentConfig,
  ActionClass,
  ActionReceipt,
} from './types';

export class AgentRuntime {
  private agentConfig: AgentConfig;
  private running: boolean = false;
  private actionQueue: AgentAction[] = [];

  constructor() {
    this.agentConfig = {
      id: config.agent.id,
      name: config.agent.name,
      walletAddress: '',
      policies: [],
      skills: ['surge-wallet', 'surge-transfer', 'surge-token-launch'],
      createdAt: Date.now(),
    };
  }

  /**
   * Initialize the agent: wallet, hooks, heartbeat.
   */
  async initialize(): Promise<void> {
    logger.info('='.repeat(60));
    logger.info('🔥 RIDHWAN AGENT RUNTIME — Initializing...');
    logger.info('='.repeat(60));

    // 1. Setup wallet
    logger.info('[Runtime] Setting up SURGE wallet...');
    const walletInfo = await surgeWallet.setup();
    this.agentConfig.walletAddress = walletInfo.address;
    logger.info(`[Runtime] Wallet ready: ${walletInfo.address} (${walletInfo.network})`);
    logger.info(`[Runtime] Balance: ${walletInfo.balance} ETH`);

    // 2. Register hooks
    logger.info('[Runtime] Registering hooks...');
    hookManager.register({
      name: 'PolicyEnforcement',
      phase: 'pre',
      priority: 10,
      handler: policyHook,
    });
    hookManager.register({
      name: 'AuditLogger',
      phase: 'post',
      priority: 10,
      handler: auditHook,
    });
    logger.info(`[Runtime] ${hookManager.list().length} hooks registered`);

    // 3. Start heartbeat
    heartbeatScheduler.start();

    // 4. Start Moltbook daily poster
    logger.info('[Runtime] Starting Moltbook daily poster...');
    dailyPoster.start();
    logger.info('[Runtime] Moltbook daily poster active — will auto-post build updates');

    this.running = true;
    logger.info('[Runtime] ✅ Agent initialized and running');
  }

  /**
   * Submit an action for execution. Goes through the full hook pipeline.
   */
  async executeAction(
    actionClass: ActionClass,
    description: string,
    params: Record<string, unknown>,
    executor?: (action: AgentAction) => Promise<ActionReceipt>
  ): Promise<AgentAction> {
    const action: AgentAction = {
      id: uuidv4(),
      agentId: this.agentConfig.id,
      actionClass,
      description,
      params,
      timestamp: Date.now(),
      status: 'proposed',
    };

    logger.info(`[Runtime] Action proposed: ${action.id} (${actionClass}) — ${description}`);

    // PRE hooks (policy check, etc.)
    const preResult = await hookManager.run('pre', action, this.agentConfig);
    if (!preResult.proceed) {
      action.status = 'rejected';
      action.policyResult = preResult.action.policyResult;
      logger.warn(`[Runtime] Action REJECTED: ${preResult.reasons.join('; ')}`);

      // Still run post hooks for audit
      await hookManager.run('post', action, this.agentConfig);
      return action;
    }

    // Execute the action
    action.status = 'approved';
    try {
      if (executor) {
        action.receipt = await executor(preResult.action);
        action.status = 'executed';
      } else {
        // Default: mark as executed with no-op receipt
        action.receipt = {
          actionId: action.id,
          agentId: action.agentId,
          actionClass: action.actionClass,
          description: action.description,
          status: 'success',
          timestamp: Date.now(),
          metadata: {},
        };
        action.status = 'executed';
      }
      logger.info(`[Runtime] Action EXECUTED: ${action.id}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      action.status = 'failed';
      action.receipt = {
        actionId: action.id,
        agentId: action.agentId,
        actionClass: action.actionClass,
        description: action.description,
        status: 'failure',
        timestamp: Date.now(),
        metadata: { error: errMsg },
      };
      logger.error(`[Runtime] Action FAILED: ${errMsg}`);
    }

    // POST hooks (audit, etc.)
    await hookManager.run('post', action, this.agentConfig);

    return action;
  }

  /**
   * Shutdown the agent cleanly.
   */
  async shutdown(): Promise<void> {
    logger.info('[Runtime] Shutting down...');
    heartbeatScheduler.stop();
    dailyPoster.stop();
    this.running = false;
    logger.info('[Runtime] Shutdown complete');
  }

  getConfig(): AgentConfig {
    return { ...this.agentConfig };
  }

  isRunning(): boolean {
    return this.running;
  }
}

export const agentRuntime = new AgentRuntime();
export default agentRuntime;
