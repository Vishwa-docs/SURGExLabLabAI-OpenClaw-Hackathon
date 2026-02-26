// ============================================================
// src/agent/hooks/hook-manager.ts — Hook Interception System
// ============================================================
// Intercepts every agent action before/after execution,
// enabling policy checks, risk scoring, and audit logging.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import {
  AgentAction,
  AgentConfig,
  HookContext,
  HookHandler,
  HookResult,
  ActionClass,
} from '../types';

export type HookPhase = 'pre' | 'post';

interface RegisteredHook {
  id: string;
  name: string;
  phase: HookPhase;
  priority: number; // lower = runs first
  actionClasses: ActionClass[] | '*';
  handler: HookHandler;
}

export class HookManager {
  private hooks: RegisteredHook[] = [];

  /**
   * Register a hook that fires before or after agent actions.
   */
  register(opts: {
    name: string;
    phase: HookPhase;
    priority?: number;
    actionClasses?: ActionClass[] | '*';
    handler: HookHandler;
  }): string {
    const id = uuidv4();
    this.hooks.push({
      id,
      name: opts.name,
      phase: opts.phase,
      priority: opts.priority ?? 100,
      actionClasses: opts.actionClasses ?? '*',
      handler: opts.handler,
    });
    this.hooks.sort((a, b) => a.priority - b.priority);
    logger.info(`Hook registered: [${opts.phase}] ${opts.name} (priority ${opts.priority ?? 100})`);
    return id;
  }

  /**
   * Remove a hook by its ID.
   */
  unregister(hookId: string): boolean {
    const idx = this.hooks.findIndex((h) => h.id === hookId);
    if (idx >= 0) {
      const removed = this.hooks.splice(idx, 1)[0];
      logger.info(`Hook unregistered: ${removed.name}`);
      return true;
    }
    return false;
  }

  /**
   * Run all hooks for a given phase and action.
   * For 'pre' hooks: if any hook returns proceed=false, the chain stops.
   * For 'post' hooks: all hooks run regardless.
   */
  async run(
    phase: HookPhase,
    action: AgentAction,
    agent: AgentConfig,
    metadata: Record<string, unknown> = {}
  ): Promise<{ proceed: boolean; action: AgentAction; reasons: string[] }> {
    const applicable = this.hooks.filter((h) => {
      if (h.phase !== phase) return false;
      if (h.actionClasses === '*') return true;
      return h.actionClasses.includes(action.actionClass);
    });

    let currentAction = { ...action };
    const reasons: string[] = [];

    for (const hook of applicable) {
      const ctx: HookContext = {
        action: currentAction,
        agent,
        metadata,
      };

      try {
        const result: HookResult = await hook.handler(ctx);

        if (result.modified) {
          currentAction = { ...currentAction, ...result.modified };
        }

        if (!result.proceed && phase === 'pre') {
          const reason = result.reason || `Blocked by hook: ${hook.name}`;
          reasons.push(reason);
          logger.warn(`Action ${action.id} blocked by pre-hook "${hook.name}": ${reason}`);
          return { proceed: false, action: currentAction, reasons };
        }

        if (result.reason) {
          reasons.push(result.reason);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Hook "${hook.name}" threw error: ${errMsg}`);
        if (phase === 'pre') {
          reasons.push(`Hook error in "${hook.name}": ${errMsg}`);
          return { proceed: false, action: currentAction, reasons };
        }
      }
    }

    return { proceed: true, action: currentAction, reasons };
  }

  /**
   * List all registered hooks (for dashboard / debugging).
   */
  list(): Array<{ id: string; name: string; phase: HookPhase; priority: number }> {
    return this.hooks.map((h) => ({
      id: h.id,
      name: h.name,
      phase: h.phase,
      priority: h.priority,
    }));
  }
}

// Singleton instance
export const hookManager = new HookManager();
export default hookManager;
