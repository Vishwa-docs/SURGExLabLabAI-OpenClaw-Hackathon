// ============================================================
// src/policy-engine/db/init.ts — Database initialization script
// ============================================================

import databaseManager from './database';
import logger from '../../utils/logger';
import { DEFAULT_POLICY } from '../schemas/policy-schema';
import { policyStore } from '../policy-store';

async function init() {
  logger.info('Initializing Ridhwan database...');

  // Force table creation
  databaseManager.getDb();

  // Insert default policy if not exists
  const existing = policyStore.getPolicy('default-policy');
  if (!existing) {
    policyStore.savePolicy(DEFAULT_POLICY);
    logger.info('Default policy inserted');
  } else {
    logger.info('Default policy already exists');
  }

  logger.info('Database initialization complete');
  databaseManager.close();
}

init().catch((err) => {
  logger.error(`DB init error: ${err}`);
  process.exit(1);
});
