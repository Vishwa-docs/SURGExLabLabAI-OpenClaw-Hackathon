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
import { mcpServer } from './api/mcp-server';
import { wsEventHub } from './api/websocket';
import { tradingEngine } from './economic/trading-engine';
import { defiAggregator } from './economic/defi-aggregator';

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

  // 4. Initialize MCP server (register self, seed demo agents)
  logger.info('[Main] Initializing MCP server...');
  mcpServer.registerSelf(
    config.agent.id,
    config.agent.name,
    `did:ridhwan:${config.agent.id}`,
    `http://localhost:${config.server.port}`
  );
  logger.info(`[Main] MCP registered self with 8 capabilities`);

  // 5. Seed trading engine with default market prices
  tradingEngine.setMarketPrice('ETH/USDC', 2000);
  tradingEngine.setMarketPrice('BTC/USDC', 60000);
  tradingEngine.setMarketPrice('SURGE/USDC', 1.50);
  tradingEngine.setMarketPrice('BASE/USDC', 0.025);
  tradingEngine.setInitialCapital(config.agent.id, 10000);
  logger.info('[Main] Trading engine seeded with 4 market pairs');

  // 6. Pre-fetch DeFi pools
  defiAggregator.fetchPools().then(pools => {
    logger.info(`[Main] DeFi aggregator loaded ${pools.length} yield pools`);
  }).catch(() => {
    logger.warn('[Main] DeFi pool fetch failed (using seed data)');
  });

  // 7. Start API server
  const app = createApiServer();
  app.listen(config.server.port, () => {
    logger.info(`[Main] API server running at http://localhost:${config.server.port}`);
    logger.info(`[Main] Dashboard: http://localhost:${config.server.dashboardPort}`);
  });

  // 8. Emit system startup event
  wsEventHub.emitSystemEvent('startup', {
    agent: config.agent.name,
    modules: [
      'policy-engine', 'audit-ledger', 'wallet', 'governance', 'gnn-fraud',
      'identity', 'trading', 'prediction-markets', 'defi-aggregator',
      'revenue-sharing', 'web3-verifier', 'trend-engine', 'mcp-server',
      'websocket-events', 'insurance', 'credit-scoring',
    ],
    timestamp: Date.now(),
  });

  logger.info('');
  logger.info('='.repeat(60));
  logger.info('✅ RIDHWAN IS LIVE');
  logger.info('');
  logger.info(`   Agent:       ${config.agent.name} (${config.agent.id})`);
  logger.info(`   API:         http://localhost:${config.server.port}`);
  logger.info(`   Dashboard:   http://localhost:${config.server.dashboardPort}`);
  logger.info(`   Swagger:     http://localhost:${config.server.port}/api/docs`);
  logger.info(`   SSE Stream:  http://localhost:${config.server.port}/api/events/stream`);
  logger.info(`   MCP Manifest:http://localhost:${config.server.port}/api/mcp/manifest`);
  logger.info(`   Moltbook:    Daily auto-posting to "${config.moltbook.submolt}"`);
  logger.info('');
  logger.info('   Modules: 17 active');
  logger.info('   Endpoints: 100+');
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
