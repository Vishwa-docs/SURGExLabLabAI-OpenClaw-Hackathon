// ============================================================
// demo/run-scenarios.ts — Scenario Runner CLI
// ============================================================
// Runs Week 2 governance scenarios for demo & testing.
//
// Usage:
//   npm run scenario              — Interactive menu
//   npm run scenario:all          — Run all scenarios
//   ts-node demo/run-scenarios.ts happy-path  — Run specific
// ============================================================

import { config } from '../src/utils/config';
import logger from '../src/utils/logger';
import { agentRuntime } from '../src/agent/agent-runtime';
import { policyStore } from '../src/policy-engine/policy-store';
import { DEFAULT_POLICY } from '../src/policy-engine/schemas/policy-schema';
import databaseManager from '../src/policy-engine/db/database';
import { scenarioRunner } from '../src/scenarios/scenario-runner';

function banner(text: string) {
  logger.info('');
  logger.info('═'.repeat(60));
  logger.info(`  🔥 ${text}`);
  logger.info('═'.repeat(60));
}

async function main() {
  banner('RIDHWAN SCENARIO RUNNER v1');
  logger.info('  Week 2 — Governance, Economic & Security Scenarios');
  logger.info('');

  // ── Init ──────────────────────────────────────────────────
  logger.info('[Scenarios] Initializing...');
  databaseManager.getDb();
  const existing = policyStore.getPolicy('default-policy');
  if (!existing) policyStore.savePolicy(DEFAULT_POLICY);
  await agentRuntime.initialize();
  logger.info('[Scenarios] ✅ Agent ready\n');

  // Parse CLI args
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.includes('-a');
  const scenarioId = args.find(a => !a.startsWith('-'));

  // List available scenarios
  const scenarios = scenarioRunner.listScenarios();
  logger.info('[Scenarios] Available scenarios:');
  for (const s of scenarios) {
    logger.info(`  • ${s.id.padEnd(16)} ${s.name} (${s.steps} steps) [${s.tags.join(', ')}]`);
  }
  logger.info('');

  if (runAll) {
    // ── Run All ──────────────────────────────────────────────
    banner('Running ALL Scenarios');
    const results = await scenarioRunner.runAll();

    // Summary
    banner('SCENARIO RESULTS');
    const passed = results.filter(r => r.allPassed).length;
    const total = results.length;

    for (const r of results) {
      const icon = r.allPassed ? '✅' : '❌';
      logger.info(`  ${icon} ${r.scenarioName}`);
      logger.info(`     ${r.summary} (${r.durationMs}ms)`);
      for (const step of r.steps) {
        const stepIcon = step.success ? '  ✓' : '  ✗';
        logger.info(`     ${stepIcon} ${step.name}: ${step.logs[0] || 'done'} (${step.durationMs}ms)`);
      }
      logger.info('');
    }

    logger.info(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`  ${passed === total ? '🎉' : '⚠️'}  ${passed}/${total} scenarios passed`);
    logger.info('');

  } else if (scenarioId) {
    // ── Run Specific ─────────────────────────────────────────
    banner(`Running: ${scenarioId}`);
    try {
      const result = await scenarioRunner.runScenario(scenarioId);
      logger.info('');
      for (const step of result.steps) {
        const icon = step.success ? '✅' : '❌';
        logger.info(`  ${icon} ${step.name}`);
        for (const log of step.logs) {
          logger.info(`     ${log}`);
        }
        logger.info(`     Output: ${JSON.stringify(step.output)}`);
      }
      logger.info('');
      logger.info(`  Result: ${result.summary}`);
    } catch (err) {
      logger.error(`  Error: ${err}`);
    }

  } else {
    // ── Default: Run the most interesting scenario ───────────
    banner('Running: full-cycle (default)');
    logger.info('  Tip: Use --all to run all scenarios, or pass a scenario ID\n');

    try {
      const result = await scenarioRunner.runScenario('full-cycle');
      logger.info('');
      for (const step of result.steps) {
        const icon = step.success ? '✅' : '❌';
        logger.info(`  ${icon} ${step.name}`);
        for (const log of step.logs) {
          logger.info(`     ${log}`);
        }
      }
      logger.info('');
      logger.info(`  ${result.allPassed ? '🎉' : '⚠️'} ${result.summary}`);
    } catch (err) {
      logger.error(`  Error: ${err}`);
    }
  }

  // Cleanup
  await agentRuntime.shutdown();
  databaseManager.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`Scenario runner failed: ${err}`);
  process.exit(1);
});
