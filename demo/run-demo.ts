// ============================================================
// demo/run-demo.ts — Replayable Autonomy Demo
// ============================================================
// Demonstrates the full RIDHWAN agent flow:
//   1. Wallet setup
//   2. Policy evaluation (allowed action)
//   3. Policy evaluation (blocked action)
//   4. Budget tracking
//   5. Moltbook auto-post
//   6. Audit log review
//   7. Budget usage summary
//   8. Receipt generation
//   9. X thread generation
// ============================================================

import { config } from '../src/utils/config';
import logger from '../src/utils/logger';
import { agentRuntime } from '../src/agent/agent-runtime';
import { policyStore } from '../src/policy-engine/policy-store';
import { budgetTracker } from '../src/policy-engine/budget-tracker';
import { auditLedger } from '../src/policy-engine/audit-ledger';
import { DEFAULT_POLICY } from '../src/policy-engine/schemas/policy-schema';
import { moltbookClient } from '../src/moltbook/moltbook-client';
import { xThreadGenerator } from '../src/social/x-thread-generator';
import databaseManager from '../src/policy-engine/db/database';

function banner(text: string) {
  logger.info('');
  logger.info('─'.repeat(60));
  logger.info(`  🔥 ${text}`);
  logger.info('─'.repeat(60));
}

function step(n: number, text: string) {
  logger.info('');
  logger.info(`  ▶ Step ${n}: ${text}`);
  logger.info('');
}

async function runDemo() {
  banner('RIDHWAN DEMO — Replayable Autonomy');
  logger.info('  This demo walks through the full agent governance flow.');
  logger.info('  Everything runs locally with SQLite + demo data.');
  logger.info('');

  // ── Init ──────────────────────────────────────────────────
  step(0, 'Initializing RIDHWAN...');
  databaseManager.getDb();
  const existing = policyStore.getPolicy('default-policy');
  if (!existing) policyStore.savePolicy(DEFAULT_POLICY);
  await agentRuntime.initialize();
  logger.info('  ✓ Agent initialized');

  // ── Step 1: Wallet ────────────────────────────────────────
  step(1, 'Wallet Info');
  const agentConfig = agentRuntime.getConfig();
  logger.info(`  Wallet Address: ${agentConfig.walletAddress || '(dry-run / not set)'}`);
  logger.info(`  Agent ID:       ${agentConfig.id}`);
  logger.info(`  Agent Name:     ${agentConfig.name}`);

  // ── Step 2: Policy — allowed action ───────────────────────
  step(2, 'Policy Check — Transfer $10 (should ALLOW)');

  const result = await agentRuntime.executeAction(
    'transfer',
    'Transfer $10 USDC for demo',
    {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
      amount: '10',
      currency: 'USDC',
    }
  );

  if (result.status === 'executed') {
    logger.info(`  ✓ ACTION ALLOWED`);
    logger.info(`  Status: ${result.status}`);
    logger.info(`  Receipt: ${result.receipt?.status ?? 'n/a'}`);
  } else {
    logger.info(`  Status: ${result.status}`);
  }

  // ── Step 3: Policy — blocked action ───────────────────────
  step(3, 'Policy Check — Ownership Renounce (should BLOCK)');

  const blockResult = await agentRuntime.executeAction(
    'ownership_renounce',
    'Renounce ownership of token contract',
    {
      contractAddress: '0xABCDEF1234567890',
      action: 'renounceOwnership',
    }
  );

  if (blockResult.status === 'rejected') {
    logger.info(`  ✗ ACTION BLOCKED (as expected)`);
    logger.info(`  Decision: ${blockResult.status}`);
    logger.info(`  Reason:   ${blockResult.policyResult?.reason ?? 'policy violation'}`);
  } else {
    logger.info(`  Result: ${blockResult.status}`);
  }

  // ── Step 4: Policy — over budget ─────────────────────────
  step(4, 'Budget Check — $600 Transfer (over $500/day limit)');

  const budgetResult = await agentRuntime.executeAction(
    'transfer',
    'Transfer $600 USDC — exceeds daily limit',
    {
      to: '0x1234567890ABCDEF',
      amount: '600',
      currency: 'USDC',
    }
  );

  if (budgetResult.status === 'rejected') {
    logger.info(`  ✗ BUDGET EXCEEDED (as expected)`);
    logger.info(`  Reason: ${budgetResult.policyResult?.reason ?? 'over daily cap'}`);
  } else {
    logger.info(`  Result: ${budgetResult.status}`);
  }

  // ── Step 5: Moltbook Post ─────────────────────────────────
  step(5, 'Moltbook Auto-Post');
  const postResult = await moltbookClient.publishDailyUpdate([
    'Agent runtime initialized successfully',
    'Policy engine blocked unauthorized ownership renounce',
    'Budget tracker caught over-limit transfer',
    'Full audit trail generated',
  ]);
  logger.info(`  ✓ Posted to Moltbook: ${postResult.postId}`);
  if (postResult.url) logger.info(`  URL: ${postResult.url}`);

  // ── Step 6: Audit Log Review ────────────────────────────
  step(6, 'Audit Log Review');
  const stats = auditLedger.getStats();
  const recent = auditLedger.getRecentEntries(5);
  logger.info(`  Total:           ${stats.total}`);
  logger.info(`  Executed:        ${stats.executed}`);
  logger.info(`  Blocked:         ${stats.blocked}`);
  logger.info('');
  logger.info('  Recent entries:');
  for (const entry of recent) {
    logger.info(`    [${entry.timestamp}] ${entry.actionClass} → ${entry.status}`);
  }

  // ── Step 7: Budget Usage ─────────────────────────────────
  step(7, 'Budget Usage Summary');
  const usage = budgetTracker.getUsage(config.agent.id);
  const budget = DEFAULT_POLICY.budget;
  logger.info(`  Daily spend:   $${usage.dailySpend.toFixed(2)} / $${budget?.maxDaily ?? 'N/A'}`);
  logger.info(`  Weekly spend:  $${usage.weeklySpend.toFixed(2)} / $${budget?.maxWeekly ?? 'N/A'}`);
  logger.info(`  Monthly spend: $${usage.monthlySpend.toFixed(2)} / $${budget?.maxMonthly ?? 'N/A'}`);

  // ── Step 8: Receipt ──────────────────────────────────────
  step(8, 'Receipt Generation');
  if (result.receipt) {
    const receipt = auditLedger.generateReceipt(result.id);
    if (receipt) {
      logger.info(`  Action ID:     ${receipt.actionId}`);
      logger.info(`  Action:        ${receipt.actionClass}`);
      logger.info(`  Status:        ${receipt.status}`);
      logger.info(`  Tx hash:       ${receipt.transaction?.hash ?? 'N/A (no on-chain tx)'}`);
      logger.info('');
      logger.info('  Full receipt JSON:');
      logger.info(JSON.stringify(receipt, null, 2).split('\n').map((l: string) => `    ${l}`).join('\n'));
    }
  }

  // ── Step 9: X Thread Generation ──────────────────────────
  step(9, 'X/Twitter Build-in-Public Thread');
  const thread = xThreadGenerator.generateDailyThread([
    'Built autonomous agent runtime',
    'Policy engine blocks dangerous actions',
    'Budget tracker enforces spending limits',
    'Full audit trail with receipts',
  ]);
  logger.info('  Generated Twitter thread:');
  for (const tweet of thread.tweets) {
    logger.info(`    ---`);
    logger.info(tweet.split('\n').map((l: string) => `    ${l}`).join('\n'));
  }

  // ── Done ─────────────────────────────────────────────────
  banner('DEMO COMPLETE');
  logger.info('  All 9 steps executed successfully.');
  logger.info('  The agent is alive. Governance holds.');
  logger.info('');
  logger.info('  Next steps:');
  logger.info('    npm run dev          — Start full system');
  logger.info('    npm run dev:dashboard — Start dashboard UI');
  logger.info('');

  await agentRuntime.shutdown();
  databaseManager.close();
  process.exit(0);
}

runDemo().catch((err) => {
  logger.error(`Demo failed: ${err}`);
  process.exit(1);
});
