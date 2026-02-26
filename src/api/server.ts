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
// Week 2 imports
import { riskScorer } from '../governance/risk-scorer';
import { holdMechanism } from '../governance/hold-mechanism';
import { surgeActionLoop } from '../surge/action-loop';
import { costRouter } from '../economic/cost-router';
import { treasuryTracker } from '../economic/treasury-tracker';
import { skillScanner } from '../security/skill-scanner';
import { scenarioRunner } from '../scenarios/scenario-runner';

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

  // ============================================================
  // WEEK 2 — Governance, Economic & Security Endpoints
  // ============================================================

  // ---- Risk Scorer ----
  app.get('/api/risk/assess', (req, res) => {
    const { actionClass, amount, toAddress } = req.query;
    const assessment = riskScorer.assess({
      actionClass: (actionClass as string) || 'transfer',
      amountUsd: parseFloat(amount as string) || 10,
      toAddress: (toAddress as string) || '0x0',
      agentId: config.agent.id,
    });
    res.json(assessment);
  });

  app.get('/api/risk/trend', (req, res) => {
    const window = parseInt(req.query.window as string) || 10;
    res.json(riskScorer.getRiskTrend(window));
  });

  app.get('/api/risk/stats', (req, res) => {
    res.json(riskScorer.getStats());
  });

  // ---- HOLD Mechanism ----
  app.get('/api/hold/stats', (req, res) => {
    res.json(holdMechanism.getStats());
  });

  app.get('/api/hold/active', (req, res) => {
    res.json(holdMechanism.getActiveHolds());
  });

  // ---- Action Loop ----
  app.post('/api/actions/transfer', async (req, res) => {
    try {
      const { to, amount, currency } = req.body;
      const result = await surgeActionLoop.executeTransfer({ to, amount, currency });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/actions/token-launch', async (req, res) => {
    try {
      const { name, ticker, description, initialBuyEth } = req.body;
      const result = await surgeActionLoop.executeTokenLaunch({ name, ticker, description, initialBuyEth });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/actions/summary', (req, res) => {
    res.json(surgeActionLoop.getSummary());
  });

  // ---- Cost Router ----
  app.get('/api/cost-router/providers', (req, res) => {
    res.json(costRouter.getProviders());
  });

  app.get('/api/cost-router/usage', (req, res) => {
    res.json(costRouter.getUsage());
  });

  app.post('/api/cost-router/route', async (req, res) => {
    try {
      const { prompt, taskType, maxTokens } = req.body;
      const response = await costRouter.route({
        prompt: prompt || 'Hello',
        taskType: taskType || 'chat',
        maxTokens: maxTokens || 256,
      });
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ---- Treasury ----
  app.get('/api/treasury/snapshot', (req, res) => {
    res.json(treasuryTracker.getSnapshot());
  });

  app.get('/api/treasury/stats', (req, res) => {
    res.json(treasuryTracker.getStats());
  });

  // ---- Skill Scanner ----
  app.post('/api/skills/scan', (req, res) => {
    try {
      const { skillName, code, manifest } = req.body;
      const result = skillScanner.scan(skillName || 'unknown', code || '');
      if (manifest) {
        const validation = skillScanner.validateManifest(manifest, result);
        return res.json({ ...result, manifestValidation: validation });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/skills/scan/demo', (req, res) => {
    const safe = skillScanner.scanDemoSkill();
    const malicious = skillScanner.scanMaliciousDemo();
    res.json({ safe, malicious });
  });

  app.get('/api/skills/stats', (req, res) => {
    res.json(skillScanner.getStats());
  });

  // ---- Scenario Runner ----
  app.get('/api/scenarios', (req, res) => {
    res.json(scenarioRunner.listScenarios());
  });

  app.post('/api/scenarios/:id/run', async (req, res) => {
    try {
      const result = await scenarioRunner.runScenario(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/scenarios/run-all', async (req, res) => {
    try {
      const results = await scenarioRunner.runAll();
      res.json({
        total: results.length,
        passed: results.filter(r => r.allPassed).length,
        results,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/scenarios/history', (req, res) => {
    res.json(scenarioRunner.getHistory());
  });

  return app;
}
