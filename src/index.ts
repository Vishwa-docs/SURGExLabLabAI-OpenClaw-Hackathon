// ============================================================
// src/index.ts — Main Entry Point
// ============================================================
// Starts the Ridhwan agent runtime, API server, and all
// background services (heartbeat, Moltbook daily poster).
// ============================================================

import { config } from './utils/config';
import logger from './utils/logger';
import { agentRuntime } from './agent/agent-runtime';
import { createApiServer } from './api/server';
import databaseManager from './policy-engine/db/database';
import { policyStore } from './policy-engine/policy-store';
import { DEFAULT_POLICY } from './policy-engine/schemas/policy-schema';

async function main() {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║       🔥 RIDHWAN — Enterprise Trust & Commerce Mesh     ║');
  logger.info('║              for Autonomous AI Agents                    ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');
  logger.info('');

  // 1. Initialize database
  logger.info('[Main] Initializing database...');
  databaseManager.getDb();

  // 2. Load default policy if needed
  const existing = policyStore.getPolicy('default-policy');
  if (!existing) {
    logger.info('[Main] Loading default policy...');
    policyStore.savePolicy(DEFAULT_POLICY);
  }

  // 3. Initialize agent runtime (wallet, hooks, heartbeat, Moltbook poster)
  await agentRuntime.initialize();

  // 4. Start API server
  const app = createApiServer();
  app.listen(config.server.port, () => {
    logger.info(`[Main] API server running at http://localhost:${config.server.port}`);
    logger.info(`[Main] Dashboard: http://localhost:${config.server.dashboardPort}`);
  });

  logger.info('');
  logger.info('='.repeat(60));
  logger.info('✅ RIDHWAN IS LIVE');
  logger.info('');
  logger.info(`   Agent:     ${config.agent.name} (${config.agent.id})`);
  logger.info(`   API:       http://localhost:${config.server.port}`);
  logger.info(`   Dashboard: http://localhost:${config.server.dashboardPort}`);
  logger.info(`   Moltbook:  Daily auto-posting to "${config.moltbook.submolt}"`);
  logger.info('');
  logger.info('   Ctrl+C to stop');
  logger.info('='.repeat(60));
  logger.info('');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('\n[Main] Shutting down gracefully...');
    await agentRuntime.shutdown();
    databaseManager.close();
    logger.info('[Main] Goodbye! 🔥');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
