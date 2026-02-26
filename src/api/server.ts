// ============================================================
// src/api/server.ts — Express API Server
// ============================================================
// REST API that the dashboard connects to.
// Exposes: overview, policies, audit log, wallet, receipts, budget.
// ============================================================

import express from 'express';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { policyStore } from '../policy-engine/policy-store';
import { auditLedger } from '../policy-engine/audit-ledger';
import { budgetTracker } from '../policy-engine/budget-tracker';
import { surgeWallet } from '../surge/wallet/wallet-manager';
import { agentRuntime } from '../agent/agent-runtime';
import { moltbookClient } from '../moltbook/moltbook-client';
import { dailyPoster } from '../moltbook/daily-poster';
import { xThreadGenerator } from '../social/x-thread-generator';

export function createApiServer(): express.Express {
  const app = express();
  app.use(express.json());

  // CORS for dashboard
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // ---- Health ----
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', agent: config.agent.name, uptime: process.uptime() });
  });

  // ---- Overview ----
  app.get('/api/overview', async (req, res) => {
    try {
      const stats = auditLedger.getStats();
      const recentActions = auditLedger.getRecentEntries(10);
      const agentConfig = agentRuntime.getConfig();
      let walletInfo = { address: agentConfig.walletAddress, balance: '0', network: 'base-sepolia' };
      try {
        walletInfo = await surgeWallet.getInfo();
      } catch {}
      const budget = budgetTracker.getUsage(config.agent.id);

      res.json({
        agent: { id: agentConfig.id, name: agentConfig.name, status: agentRuntime.isRunning() ? 'running' : 'stopped' },
        wallet: walletInfo,
        stats,
        budget,
        recentActions,
        moltbook: {
          postCount: moltbookClient.getPostCount(),
          postedToday: moltbookClient.hasPostedToday(),
          history: moltbookClient.getPostHistory().slice(-5),
        },
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ---- Policies ----
  app.get('/api/policies', (req, res) => {
    res.json(policyStore.listPolicies());
  });

  app.get('/api/policies/:id', (req, res) => {
    const policy = policyStore.getPolicy(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  });

  app.put('/api/policies/:id', (req, res) => {
    try {
      const existing = policyStore.getPolicy(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Policy not found' });
      const updated = { ...existing, ...req.body, updatedAt: Date.now() };
      policyStore.savePolicy(updated);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  app.post('/api/policies/:id/toggle', (req, res) => {
    const { enabled } = req.body;
    policyStore.togglePolicy(req.params.id, enabled);
    res.json({ success: true });
  });

  // ---- Audit Log ----
  app.get('/api/audit', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(auditLedger.getRecentEntries(limit));
  });

  // ---- Wallet ----
  app.get('/api/wallet', async (req, res) => {
    try {
      const info = await surgeWallet.getInfo();
      res.json(info);
    } catch (err) {
      res.json({ address: 'not-initialized', balance: '0', network: 'base-sepolia' });
    }
  });

  // ---- Budget ----
  app.get('/api/budget', (req, res) => {
    res.json(budgetTracker.getUsage(config.agent.id));
  });

  // ---- Receipts ----
  app.get('/api/receipts', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = auditLedger.getRecentEntries(limit);
    const receipts = entries
      .filter(e => e.receipt || e.status === 'executed')
      .map(e => ({
        actionId: e.actionId,
        agentId: e.agentId,
        actionClass: e.actionClass,
        description: e.description,
        status: e.status === 'executed' ? 'success' : 'failure',
        txHash: e.receipt?.txHash,
        explorerUrl: e.receipt?.explorerUrl,
        gasUsed: e.receipt?.gasUsed,
        costUsd: e.receipt?.costUsd,
        timestamp: e.timestamp,
      }));
    res.json(receipts);
  });

  app.get('/api/receipts/:actionId', (req, res) => {
    const receipt = auditLedger.generateReceipt(req.params.actionId);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  });

  // ---- Moltbook ----
  app.get('/api/moltbook/history', (req, res) => {
    res.json(moltbookClient.getPostHistory());
  });

  app.post('/api/moltbook/post', async (req, res) => {
    try {
      const { title, body, tags } = req.body;
      if (title && body) {
        await dailyPoster.postCustom(title, body, tags);
      } else {
        await dailyPoster.postNow(req.body.highlights);
      }
      res.json({ success: true, postCount: moltbookClient.getPostCount() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/moltbook/daily', async (req, res) => {
    try {
      await dailyPoster.postNow();
      res.json({ success: true, postedToday: moltbookClient.hasPostedToday() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ---- X Thread Generator ----
  app.get('/api/social/x-thread', (req, res) => {
    const thread = xThreadGenerator.generateDailyThread();
    res.json({
      thread,
      formatted: xThreadGenerator.formatForDisplay(thread),
    });
  });

  app.post('/api/social/x-thread/submission', (req, res) => {
    const { demoLink, repoLink } = req.body;
    const thread = xThreadGenerator.generateSubmissionThread(
      demoLink || 'https://demo.ridhwan.dev',
      repoLink || 'https://github.com/ridhwan'
    );
    const validation = xThreadGenerator.validateSubmission(thread, demoLink || '');
    res.json({ thread, formatted: xThreadGenerator.formatForDisplay(thread), validation });
  });

  return app;
}
