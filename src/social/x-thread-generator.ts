// ============================================================
// src/social/x-thread-generator.ts — Build-in-Public X Thread Generator
// ============================================================
// Generates formatted X (Twitter) threads for build-in-public
// posting. Required for final hackathon submission.
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';
import { auditLedger } from '../policy-engine/audit-ledger';

export interface XThread {
  tweets: string[];
  hashtags: string[];
  generatedAt: number;
}

export class XThreadGenerator {
  private readonly maxTweetLength = 280;
  private readonly requiredTags = ['#Ridhwan', '#OpenClaw', '#SURGE', '#BuildInPublic', '#AI'];

  /**
   * Generate a daily build-in-public X thread.
   */
  generateDailyThread(customHighlights?: string[]): XThread {
    const stats = auditLedger.getStats();
    const date = new Date().toISOString().split('T')[0];
    const tweets: string[] = [];

    // Tweet 1: Hook
    tweets.push(
      `🔥 Ridhwan Daily Build Update — ${date}\n\n` +
      `Building the enterprise trust & governance layer for autonomous AI agents.\n\n` +
      `Today's stats:\n` +
      `✅ ${stats.executed} actions executed\n` +
      `🚫 ${stats.blocked} blocked by policy\n\n` +
      `Thread 🧵👇`
    );

    // Tweet 2: What we built
    const highlights = customHighlights || [
      'Policy engine enforcing budget caps & action gating',
      'SURGE wallet integration for Base L2',
      'Immutable audit ledger with receipt generation',
      'Hook interception system for pre/post action checks',
    ];

    let buildTweet = `🏗 What we built:\n\n`;
    for (const h of highlights.slice(0, 4)) {
      buildTweet += `• ${h}\n`;
    }
    tweets.push(buildTweet.trim());

    // Tweet 3: Tech stack
    tweets.push(
      `🛠 Tech Stack:\n\n` +
      `• OpenClaw Agent Runtime\n` +
      `• SURGE on Base (Coinbase L2)\n` +
      `• Policy Engine (TypeScript + Zod)\n` +
      `• SQLite Audit Ledger\n` +
      `• Next.js Governance Dashboard\n` +
      `• x402 Gasless Transactions`
    );

    // Tweet 4: Why it matters
    tweets.push(
      `💡 Why Ridhwan matters:\n\n` +
      `AI agents are powerful but need guardrails.\n\n` +
      `Ridhwan provides:\n` +
      `→ Budget caps & spending limits\n` +
      `→ Action-level policy enforcement\n` +
      `→ Address allow/deny lists\n` +
      `→ Human-in-the-loop approvals\n` +
      `→ Full audit trail with receipts`
    );

    // Tweet 5: CTA
    tweets.push(
      `🚀 Ridhwan is NOT just another trading bot.\n\n` +
      `It's the trust, risk, compliance, and economic intelligence backbone ` +
      `that makes the Agent Internet enterprise-safe.\n\n` +
      `Follow along as we build! 🔥\n\n` +
      this.requiredTags.join(' ')
    );

    // Validate tweet lengths
    for (let i = 0; i < tweets.length; i++) {
      if (tweets[i].length > this.maxTweetLength) {
        tweets[i] = tweets[i].slice(0, this.maxTweetLength - 3) + '...';
      }
    }

    return {
      tweets,
      hashtags: this.requiredTags,
      generatedAt: Date.now(),
    };
  }

  /**
   * Generate a final submission X thread.
   */
  generateSubmissionThread(demoLink: string, repoLink: string): XThread {
    const tweets: string[] = [];

    tweets.push(
      `🏆 Introducing RIDHWAN\n\n` +
      `The Enterprise Trust & Commerce Mesh for Autonomous Agents.\n\n` +
      `Built for the SURGE x lablab hackathon.\n\n` +
      `🎬 Demo: ${demoLink}\n` +
      `💻 Repo: ${repoLink}\n\n` +
      `Thread 🧵👇`
    );

    tweets.push(
      `🔥 What is Ridhwan?\n\n` +
      `The governance, fraud intelligence, payment optimization, ` +
      `compliance and economic control layer that makes autonomous ` +
      `AI agents enterprise-deployable.\n\n` +
      `It transforms OpenClaw agents into policy-controlled, ` +
      `audit-ready digital economic actors.`
    );

    tweets.push(
      `🛡️ Core Features:\n\n` +
      `1. Universal Policy Engine\n` +
      `2. Budget caps & spending limits\n` +
      `3. Hook-based action interception\n` +
      `4. Immutable audit ledger\n` +
      `5. SURGE wallet + transfers\n` +
      `6. x402 gasless transactions\n` +
      `7. Governance dashboard`
    );

    tweets.push(
      `📊 By the numbers:\n\n` +
      `• 30+ features across 7 modules\n` +
      `• Full policy enforcement pipeline\n` +
      `• One-command reproducible setup\n` +
      `• Daily Moltbook build updates\n` +
      `• Real autonomous agent execution\n\n` +
      this.requiredTags.join(' ')
    );

    return {
      tweets,
      hashtags: this.requiredTags,
      generatedAt: Date.now(),
    };
  }

  /**
   * Format thread for display / copy-paste.
   */
  formatForDisplay(thread: XThread): string {
    return thread.tweets
      .map((t, i) => `--- Tweet ${i + 1}/${thread.tweets.length} (${t.length} chars) ---\n${t}`)
      .join('\n\n');
  }

  /**
   * Validate a submission thread has all required elements.
   */
  validateSubmission(thread: XThread, demoLink: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const fullText = thread.tweets.join(' ');

    if (!fullText.includes(demoLink)) {
      issues.push('Missing demo link in thread');
    }

    for (const tag of this.requiredTags) {
      if (!fullText.toLowerCase().includes(tag.toLowerCase())) {
        issues.push(`Missing required hashtag: ${tag}`);
      }
    }

    if (thread.tweets.length < 3) {
      issues.push('Thread should have at least 3 tweets');
    }

    for (let i = 0; i < thread.tweets.length; i++) {
      if (thread.tweets[i].length > this.maxTweetLength) {
        issues.push(`Tweet ${i + 1} exceeds ${this.maxTweetLength} character limit (${thread.tweets[i].length} chars)`);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

export const xThreadGenerator = new XThreadGenerator();
export default xThreadGenerator;
