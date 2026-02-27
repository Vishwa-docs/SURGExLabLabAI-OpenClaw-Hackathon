// ============================================================
// src/moltbook/moltbook-client.ts — Moltbook Publishing Client
// ============================================================
// Dedicated Moltbook client for posting daily build updates
// to the lablab submolt. This is a HARD hackathon requirement:
// missing daily posts = disqualification.
//
// Features:
//  - Post to any submolt
//  - Automatic daily posting via scheduler
//  - Build-in-public formatted posts
//  - Local fallback with audit log when API key is absent
//  - Post history tracking
//  - Template engine for consistent formatting
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';
import { auditLedger } from '../policy-engine/audit-ledger';
import fetch from 'node-fetch';

// ---- Types ----

export interface MoltbookPost {
  submolt: string;
  title: string;
  body: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface MoltbookPostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  postedAt: number;
  local: boolean; // true if stored locally (no API key)
}

export interface MoltbookPostRecord {
  id: string;
  submolt: string;
  title: string;
  body: string;
  tags: string[];
  postedAt: number;
  local: boolean;
  url?: string;
}

// ---- Templates ----

export type PostTemplate = 'daily_update' | 'milestone' | 'launch' | 'technical' | 'custom';

interface TemplateData {
  agentName: string;
  agentId: string;
  date: string;
  actionsExecuted: number;
  actionsBlocked: number;
  walletBalance: string;
  highlights: string[];
  techStack?: string[];
  customContent?: string;
}

function renderTemplate(template: PostTemplate, data: TemplateData): { title: string; body: string } {
  switch (template) {
    case 'daily_update':
      return {
        title: `🔥 Ridhwan Daily Build Update — ${data.date}`,
        body: [
          `## Agent Status: OPERATIONAL`,
          ``,
          `**Agent:** ${data.agentName} (\`${data.agentId}\`)`,
          `**Wallet Balance:** ${data.walletBalance} ETH`,
          `**Date:** ${data.date}`,
          ``,
          `### 📊 Activity Summary`,
          `- ✅ Actions Executed: **${data.actionsExecuted}**`,
          `- 🚫 Actions Blocked by Policy: **${data.actionsBlocked}**`,
          `- 📈 Policy Enforcement Rate: **${data.actionsExecuted + data.actionsBlocked > 0 ? Math.round((data.actionsBlocked / (data.actionsExecuted + data.actionsBlocked)) * 100) : 0}%**`,
          ``,
          `### 🏗 What We Built Today`,
          ...data.highlights.map(h => `- ${h}`),
          ``,
          ...(data.techStack && data.techStack.length > 0
            ? [`### 🛠 Tech Stack`, ...data.techStack.map(t => `- ${t}`), ``]
            : []),
          `---`,
          `> Ridhwan is the enterprise trust, risk, compliance, and economic intelligence backbone that makes the Agent Internet enterprise-safe.`,
          ``,
          `*Posted automatically by Ridhwan Agent — Build in Public 🔥*`,
        ].join('\n'),
      };

    case 'milestone':
      return {
        title: `🎯 Ridhwan Milestone Reached — ${data.date}`,
        body: [
          `## 🏆 Milestone Achievement`,
          ``,
          ...data.highlights.map(h => `### ${h}`),
          ``,
          `**Agent:** ${data.agentName}`,
          `**Total Actions:** ${data.actionsExecuted + data.actionsBlocked}`,
          ``,
          `---`,
          `*Ridhwan — Enterprise Trust & Commerce Mesh for Autonomous Agents*`,
        ].join('\n'),
      };

    case 'launch':
      return {
        title: `🚀 Ridhwan Token/Feature Launch — ${data.date}`,
        body: [
          `## 🚀 New Launch`,
          ``,
          ...data.highlights.map(h => `- ${h}`),
          ``,
          `**Launched by:** ${data.agentName}`,
          `**Wallet:** ${data.walletBalance} ETH`,
          ``,
          `---`,
          `*Built with Ridhwan Governance Layer*`,
        ].join('\n'),
      };

    case 'technical':
      return {
        title: `🧠 Ridhwan Technical Update — ${data.date}`,
        body: [
          `## Technical Deep Dive`,
          ``,
          ...data.highlights.map(h => `${h}`),
          ``,
          ...(data.techStack ? [`### Stack`, ...data.techStack.map(t => `- ${t}`)] : []),
          ``,
          `---`,
          `*Ridhwan Engineering Log*`,
        ].join('\n'),
      };

    case 'custom':
    default:
      return {
        title: data.highlights[0] || `Ridhwan Update — ${data.date}`,
        body: data.customContent || data.highlights.join('\n\n'),
      };
  }
}

// ---- Client ----

export class MoltbookClient {
  private postHistory: MoltbookPostRecord[] = [];

  /**
   * Publish a post to the configured Moltbook submolt.
   * 
   * Real API: POST https://www.moltbook.com/api/v1/posts
   * Body: { submolt_name, title, content }
   * Auth: Authorization: Bearer <api_key>
   * 
   * New agents may receive a verification challenge (obfuscated math).
   * Rate limit: 1 post per 30 minutes.
   * 
   * Falls back to local audit logging if no API key is set.
   */
  async publish(post: MoltbookPost): Promise<MoltbookPostResult> {
    const { apiUrl, apiKey, submolt } = config.moltbook;
    const targetSubmolt = post.submolt || submolt;

    logger.info(`[Moltbook] Publishing to submolt "${targetSubmolt}": ${post.title}`);

    // Always log to audit ledger regardless of API availability
    const auditId = `moltbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    auditLedger.logAction({
      actionId: auditId,
      agentId: config.agent.id,
      actionClass: 'moltbook_post',
      description: post.title,
      status: 'executed',
      params: {
        submolt: targetSubmolt,
        body: post.body,
        tags: post.tags,
        metadata: post.metadata,
      },
      timestamp: Date.now(),
    });

    // If no API key, store locally
    if (!apiKey) {
      logger.warn('[Moltbook] No MOLTBOOK_API_KEY — post stored locally in audit ledger');
      logger.info(`[Moltbook] ===== LOCAL POST =====`);
      logger.info(`[Moltbook] Submolt: ${targetSubmolt}`);
      logger.info(`[Moltbook] Title: ${post.title}`);
      logger.info(`[Moltbook] Body:\n${post.body.slice(0, 500)}...`);
      logger.info(`[Moltbook] Tags: ${post.tags.join(', ')}`);
      logger.info(`[Moltbook] ======================`);

      const record: MoltbookPostRecord = {
        id: auditId,
        submolt: targetSubmolt,
        title: post.title,
        body: post.body,
        tags: post.tags,
        postedAt: Date.now(),
        local: true,
      };
      this.postHistory.push(record);

      return {
        success: true,
        postId: auditId,
        postedAt: Date.now(),
        local: true,
      };
    }

    // Post to real Moltbook API
    // Endpoint: POST /posts (apiUrl already includes /api/v1)
    try {
      const response = await fetch(`${apiUrl}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          submolt_name: targetSubmolt,
          title: post.title,
          content: post.body,
        }),
      });

      const responseData = (await response.json()) as Record<string, unknown>;

      // Handle verification challenge (new agents may get this)
      if (responseData.verification_required) {
        logger.info('[Moltbook] Verification challenge received — solving...');
        const challengeResult = await this.solveVerificationChallenge(
          responseData as { verification_required: boolean; challenge: string; challenge_id: string }
        );
        if (!challengeResult.success) {
          return {
            success: false,
            error: `Moltbook verification failed: ${challengeResult.error}`,
            postedAt: Date.now(),
            local: false,
          };
        }

        // Retry post after verification
        const retryResponse = await fetch(`${apiUrl}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            submolt_name: targetSubmolt,
            title: post.title,
            content: post.body,
          }),
        });

        if (!retryResponse.ok) {
          const errText = await retryResponse.text();
          return {
            success: false,
            error: `Moltbook post retry failed: ${retryResponse.status} ${errText}`,
            postedAt: Date.now(),
            local: false,
          };
        }

        const retryData = (await retryResponse.json()) as { post_id: string; url?: string };
        return this.recordSuccess(retryData, targetSubmolt, post);
      }

      if (!response.ok) {
        const errorText = JSON.stringify(responseData);
        logger.error(`[Moltbook] API error ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `Moltbook API error: ${response.status} ${errorText}`,
          postedAt: Date.now(),
          local: false,
        };
      }

      return this.recordSuccess(
        responseData as { post_id: string; url?: string },
        targetSubmolt,
        post
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[Moltbook] Publish failed: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
        postedAt: Date.now(),
        local: false,
      };
    }
  }

  /**
   * Solve a Moltbook verification challenge (obfuscated math problem).
   */
  private async solveVerificationChallenge(challenge: {
    verification_required: boolean;
    challenge: string;
    challenge_id: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { apiUrl, apiKey } = config.moltbook;

    try {
      // The challenge is an obfuscated math expression — deobfuscate and evaluate
      const answer = this.deobfuscateAndSolve(challenge.challenge);
      logger.info(`[Moltbook] Challenge: "${challenge.challenge}" → Answer: ${answer}`);

      const response = await fetch(`${apiUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          answer,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Verification failed: ${errText}` };
      }

      logger.info('[Moltbook] Verification challenge solved successfully');
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Deobfuscate and solve a Moltbook math challenge.
   * Challenges are simple math with word substitutions like
   * "What is FIVE plus THREE?" → 8
   */
  private deobfuscateAndSolve(challenge: string): number {
    const wordToNum: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4,
      five: 5, six: 6, seven: 7, eight: 8, nine: 9,
      ten: 10, eleven: 11, twelve: 12, thirteen: 13,
      fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
      eighteen: 18, nineteen: 19, twenty: 20,
    };

    let expr = challenge.toLowerCase();

    // Replace word numbers with digits
    for (const [word, num] of Object.entries(wordToNum)) {
      expr = expr.replace(new RegExp(`\\b${word}\\b`, 'gi'), String(num));
    }

    // Replace word operators
    expr = expr.replace(/plus|add|added to/gi, '+');
    expr = expr.replace(/minus|subtract|subtracted from/gi, '-');
    expr = expr.replace(/times|multiplied by/gi, '*');
    expr = expr.replace(/divided by/gi, '/');

    // Extract numbers and operators
    const matches = expr.match(/[\d.]+|[+\-*/]/g);
    if (!matches || matches.length < 3) {
      // Fallback: try to extract just numbers and assume addition
      const nums = expr.match(/\d+/g);
      if (nums && nums.length >= 2) {
        return parseInt(nums[0]) + parseInt(nums[1]);
      }
      return 0;
    }

    // Simple left-to-right evaluation
    let result = parseFloat(matches[0]);
    for (let i = 1; i < matches.length - 1; i += 2) {
      const op = matches[i];
      const num = parseFloat(matches[i + 1]);
      switch (op) {
        case '+': result += num; break;
        case '-': result -= num; break;
        case '*': result *= num; break;
        case '/': result = num !== 0 ? result / num : 0; break;
      }
    }
    return Math.round(result);
  }

  /**
   * Record a successful post to history.
   */
  private recordSuccess(
    data: { post_id: string; url?: string },
    targetSubmolt: string,
    post: MoltbookPost
  ): MoltbookPostResult {
    const record: MoltbookPostRecord = {
      id: data.post_id,
      submolt: targetSubmolt,
      title: post.title,
      body: post.body,
      tags: post.tags,
      postedAt: Date.now(),
      local: false,
      url: data.url || `https://www.moltbook.com/submolts/${targetSubmolt}/posts/${data.post_id}`,
    };
    this.postHistory.push(record);

    logger.info(`[Moltbook] ✅ Published successfully: ${record.url}`);

    return {
      success: true,
      postId: data.post_id,
      url: record.url,
      postedAt: Date.now(),
      local: false,
    };
  }

  /**
   * Get Moltbook home dashboard (one-call overview).
   */
  async getHome(): Promise<Record<string, unknown> | null> {
    const { apiUrl, apiKey } = config.moltbook;
    if (!apiKey) return null;

    try {
      const response = await fetch(`${apiUrl}/home`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Publish a templated post (daily update, milestone, etc.)
   */
  async publishTemplated(
    template: PostTemplate,
    data: Partial<TemplateData> & { highlights: string[] },
    tags?: string[]
  ): Promise<MoltbookPostResult> {
    const stats = auditLedger.getStats();
    let walletBalance = 'N/A';
    try {
      const { surgeWallet } = await import('../surge/wallet/wallet-manager');
      walletBalance = await surgeWallet.getBalance();
    } catch {
      // wallet not initialized
    }

    const fullData: TemplateData = {
      agentName: data.agentName || config.agent.name,
      agentId: data.agentId || config.agent.id,
      date: data.date || new Date().toISOString().split('T')[0],
      actionsExecuted: data.actionsExecuted ?? stats.executed,
      actionsBlocked: data.actionsBlocked ?? stats.blocked,
      walletBalance: data.walletBalance || walletBalance,
      highlights: data.highlights,
      techStack: data.techStack,
      customContent: data.customContent,
    };

    const rendered = renderTemplate(template, fullData);

    return this.publish({
      submolt: config.moltbook.submolt,
      title: rendered.title,
      body: rendered.body,
      tags: tags || ['ridhwan', 'build-in-public', 'openclaw', 'surge', 'ai-agents'],
    });
  }

  /**
   * Publish a daily build update — call this once per day.
   */
  async publishDailyUpdate(highlights: string[]): Promise<MoltbookPostResult> {
    return this.publishTemplated('daily_update', {
      highlights,
      techStack: [
        'OpenClaw Agent Runtime',
        'SURGE (Base L2) Integration',
        'Policy Engine (TypeScript)',
        'SQLite Audit Ledger',
        'Real-Time Dashboard (HTML/CSS/JS)',
        'Multi-Agent Orchestrator',
        'x402 Autonomous Commerce',
      ],
    });
  }

  /**
   * Get all posts published during this session.
   */
  getPostHistory(): MoltbookPostRecord[] {
    return [...this.postHistory];
  }

  /**
   * Check if a post was made today.
   */
  hasPostedToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.postHistory.some(p => {
      const postDate = new Date(p.postedAt).toISOString().split('T')[0];
      return postDate === today;
    });
  }

  /**
   * Get count of posts published.
   */
  getPostCount(): number {
    return this.postHistory.length;
  }
}

// Singleton
export const moltbookClient = new MoltbookClient();
export default moltbookClient;
