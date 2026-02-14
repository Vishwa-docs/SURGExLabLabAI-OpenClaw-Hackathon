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
// Week 3 imports
import { gnnFraudEngine } from '../risk-engine/gnn-fraud-engine';
import { didManager } from '../identity/did-manager';
import { agentRegistry } from '../identity/agent-registry';
import { zkPrivacy } from '../identity/zk-privacy';
import { votingSystem } from '../governance/voting-system';
import { policyVersioning } from '../governance/policy-versioning';
import { procurementEngine } from '../economic/procurement-engine';
import { escrowManager } from '../economic/escrow-manager';
import { riskDashboard } from '../analytics/risk-dashboard';
import { carbonTracker } from '../analytics/carbon-tracker';
import { auditExport } from '../analytics/audit-export';
// Week 4 imports
import { restakingOptimizer } from '../economic/restaking-optimizer';
import { insuranceEngine } from '../economic/insurance-engine';
import { creditScoringEngine } from '../agent/credit-scoring';

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

  // ============================================================
  // WEEK 3 — Advanced Intelligence & Analytics Endpoints
  // ============================================================

  // ---- GNN Fraud Detection ----
  app.get('/api/fraud/assess/:address', (req, res) => {
    const result = gnnFraudEngine.assessAddress(req.params.address);
    res.json(result);
  });

  app.get('/api/fraud/circular', (req, res) => {
    // detectCircularFlow is private; use demo scenario for circular flow demo
    const result = gnnFraudEngine.runDemoScenario();
    res.json({ circularFlowDemo: result });
  });

  app.get('/api/fraud/demo', (req, res) => {
    const result = gnnFraudEngine.runDemoScenario();
    res.json(result);
  });

  app.post('/api/fraud/transaction', (req, res) => {
    const { from, to, amount, actionClass } = req.body;
    gnnFraudEngine.recordTransaction({
      from: from || '0xA',
      to: to || '0xB',
      amountUsd: parseFloat(amount) || 10,
      actionClass: actionClass || 'transfer',
      timestamp: Date.now(),
    });
    const assessment = gnnFraudEngine.assessAddress(from || '0xA');
    res.json({ recorded: true, assessment });
  });

  // ---- DID Manager ----
  app.post('/api/identity/did/create', (req, res) => {
    const { agentId, walletAddress } = req.body;
    const did = didManager.createDID(agentId || 'agent-' + Date.now(), walletAddress || '0x0000');
    res.json(did);
  });

  app.get('/api/identity/did/:did', (req, res) => {
    const doc = didManager.resolve(req.params.did);
    if (!doc) return res.status(404).json({ error: 'DID not found' });
    res.json(doc);
  });

  app.post('/api/identity/credential/issue', (req, res) => {
    const { did, credentialType, claims } = req.body;
    const credential = didManager.issueCredential(
      did || '',
      credentialType || 'AgentTrustCredential',
      claims || { trustLevel: 'basic' }
    );
    if (!credential) return res.status(400).json({ error: 'DID not found' });
    res.json(credential);
  });

  app.post('/api/identity/credential/verify', (req, res) => {
    const result = didManager.verifyCredential(req.body);
    res.json(result);
  });

  // ---- Agent Registry ----
  app.post('/api/registry/register', (req, res) => {
    const { agentId, name, capabilities, did, walletAddress } = req.body;
    const agent = agentRegistry.register({
      agentId: agentId || 'agent-' + Date.now(),
      name: name || 'Unnamed Agent',
      capabilities: capabilities || ['general'],
      did: did || 'did:ridhwan:' + (agentId || 'unknown'),
      walletAddress: walletAddress || '0x0000',
    });
    res.json(agent);
  });

  app.get('/api/registry/discover', (req, res) => {
    const capability = req.query.capability as string;
    const minTrustLevel = req.query.minTrust as string;
    const agents = agentRegistry.discover({
      capabilities: capability ? [capability] : undefined,
      minTrustLevel: minTrustLevel as any || undefined,
    });
    res.json(agents);
  });

  app.get('/api/registry/trust/:agentId', (req, res) => {
    const trust = agentRegistry.lookupTrust(req.params.agentId);
    res.json(trust);
  });

  // ---- ZK Privacy ----
  app.post('/api/privacy/obfuscate', (req, res) => {
    const { address } = req.body;
    const result = zkPrivacy.obfuscateAddress(address || '0x0000');
    res.json(result);
  });

  app.post('/api/privacy/proof/balance', (req, res) => {
    const { balance, threshold } = req.body;
    const proof = zkPrivacy.generateBalanceProof(balance || 1000, threshold || 500);
    res.json(proof);
  });

  app.post('/api/privacy/proof/compliance', (req, res) => {
    const { agentId, checks } = req.body;
    const proof = zkPrivacy.generateComplianceProof(
      agentId || config.agent.id,
      checks || { kycVerified: true, sanctionsCleared: true }
    );
    res.json(proof);
  });

  app.post('/api/privacy/proof/verify', (req, res) => {
    const result = zkPrivacy.verifyProof(req.body);
    res.json(result);
  });

  // ---- Governance Voting ----
  app.post('/api/governance/proposal', (req, res) => {
    const { title, description, proposer, type, payload } = req.body;
    const proposal = votingSystem.createProposal({
      title: title || 'Untitled Proposal',
      description: description || '',
      proposer: proposer || config.agent.id,
      type: type || 'policy_change',
      payload: payload || {},
    });
    res.json(proposal);
  });

  app.post('/api/governance/vote', (req, res) => {
    const { proposalId, voterId, vote, reason } = req.body;
    const result = votingSystem.castVote(proposalId, voterId, vote, reason);
    res.json(result);
  });

  app.get('/api/governance/proposal/:id/tally', (req, res) => {
    const tally = votingSystem.tallyVotes(req.params.id);
    if (!tally) return res.status(404).json({ error: 'Proposal not found' });
    res.json(tally);
  });

  app.get('/api/governance/demo', (req, res) => {
    const result = votingSystem.runDemoVote();
    res.json(result);
  });

  // ---- Policy Versioning ----
  app.post('/api/policy-version/record', (req, res) => {
    const { policyId, content, author, reason } = req.body;
    const version = policyVersioning.recordVersion({
      policyId: policyId || 'default',
      content: content || {},
      author: author || config.agent.id,
      reason: reason || 'Manual update',
    });
    res.json(version);
  });

  app.get('/api/policy-version/chains', (req, res) => {
    const chains = policyVersioning.listChains();
    res.json(chains);
  });

  app.get('/api/policy-version/:policyId/diff', (req, res) => {
    const v1 = parseInt(req.query.v1 as string) || 1;
    const v2 = parseInt(req.query.v2 as string) || 2;
    const diff = policyVersioning.diffVersions(req.params.policyId, v1, v2);
    res.json(diff || { error: 'Versions not found' });
  });

  app.get('/api/policy-version/verify/:policyId', (req, res) => {
    const integrity = policyVersioning.verifyIntegrity(req.params.policyId);
    res.json(integrity);
  });

  // ---- Procurement ----
  app.post('/api/procurement/request', (req, res) => {
    const { title, description, budgetUsd, category, priority } = req.body;
    const request = procurementEngine.createRequest({
      requestorId: config.agent.id,
      title: title || 'Service Request',
      description: description || '',
      category: category || 'services',
      budgetUsd: budgetUsd || 100,
      priority: priority || 'medium',
    });
    res.json(request);
  });

  app.get('/api/procurement/demo', (req, res) => {
    const result = procurementEngine.runDemoProcurement();
    res.json(result);
  });

  app.get('/api/procurement/stats', (req, res) => {
    res.json(procurementEngine.getStats());
  });

  // ---- Escrow ----
  app.post('/api/escrow/create', (req, res) => {
    const { title, depositor, beneficiary, arbiter, amountUsd, milestones, durationMs } = req.body;
    const escrow = escrowManager.createEscrow({
      title: title || 'Escrow Contract',
      depositor: depositor || config.agent.id,
      beneficiary: beneficiary || 'vendor-001',
      arbiter: arbiter,
      amountUsd: amountUsd || 100,
      milestones: milestones || [{ description: 'Delivery', amountUsd: amountUsd || 100 }],
      durationMs: durationMs,
    });
    res.json(escrow);
  });

  app.get('/api/escrow/demo', (req, res) => {
    const result = escrowManager.runDemoEscrow();
    res.json(result);
  });

  app.get('/api/escrow/stats', (req, res) => {
    res.json(escrowManager.getStats());
  });

  // ---- Analytics — Risk Dashboard ----
  app.get('/api/dashboard/snapshot', (req, res) => {
    const snapshot = riskDashboard.getSnapshot();
    res.json(snapshot);
  });

  // ---- Analytics — Carbon Tracker ----
  app.get('/api/carbon/report', (req, res) => {
    const report = carbonTracker.generateReport();
    res.json(report);
  });

  app.get('/api/carbon/esg', (req, res) => {
    const score = carbonTracker.getESGScore();
    res.json(score);
  });

  app.post('/api/carbon/record', (req, res) => {
    const { chain, actionType, gasUsed } = req.body;
    carbonTracker.recordTransaction({
      actionType: actionType || 'transfer',
      chain: chain || 'base',
      gasUsed: gasUsed || 21000,
    });
    res.json({ recorded: true });
  });

  // ---- Analytics — Audit Export ----
  app.get('/api/audit/export', (req, res) => {
    const packet = auditExport.generatePacket();
    res.json(packet);
  });

  // ============================================================
  // WEEK 4 — Hardening & Advanced Modules
  // ============================================================

  // ---- Restaking Optimizer ----
  app.post('/api/restaking/optimize', (req, res) => {
    const { totalStake, riskTolerance } = req.body;
    const result = restakingOptimizer.optimize(
      totalStake || 1000,
      riskTolerance || 'moderate'
    );
    res.json(result);
  });

  app.get('/api/restaking/stats', (req, res) => {
    res.json(restakingOptimizer.getStats());
  });

  // ---- Insurance Engine ----
  app.post('/api/insurance/policy', (req, res) => {
    const { holderId, type, coverageUsd, riskScore, durationDays } = req.body;
    const policy = insuranceEngine.issuePolicy({
      holderId: holderId || config.agent.id,
      type: type || 'comprehensive',
      coverageUsd: coverageUsd || 1000,
      riskScore: riskScore || 25,
      durationDays: durationDays || 30,
    });
    res.json(policy);
  });

  app.post('/api/insurance/claim', (req, res) => {
    const { policyId, claimantId, amountRequested, evidence } = req.body;
    const claim = insuranceEngine.submitClaim({
      policyId,
      claimantId: claimantId || config.agent.id,
      amountRequested: amountRequested || 100,
      evidence: evidence || 'Loss description pending',
    });
    if (!claim) return res.status(400).json({ error: 'Invalid claim or policy' });
    res.json(claim);
  });

  app.get('/api/insurance/policies', (req, res) => {
    const holderId = req.query.holderId as string;
    res.json(insuranceEngine.listPolicies(holderId));
  });

  app.get('/api/insurance/pool', (req, res) => {
    res.json(insuranceEngine.getPool());
  });

  app.get('/api/insurance/demo', (req, res) => {
    const result = insuranceEngine.runDemoInsurance();
    res.json(result);
  });

  app.get('/api/insurance/stats', (req, res) => {
    res.json(insuranceEngine.getStats());
  });

  // ---- Credit Scoring ----
  app.get('/api/credit/score/:agentId', (req, res) => {
    const report = creditScoringEngine.computeScore(req.params.agentId);
    res.json(report);
  });

  app.get('/api/credit/report/:agentId', (req, res) => {
    const report = creditScoringEngine.getReport(req.params.agentId);
    if (!report) return res.status(404).json({ error: 'No report found' });
    res.json(report);
  });

  app.post('/api/credit/compare', (req, res) => {
    const { agentIds } = req.body;
    const comparison = creditScoringEngine.compareAgents(agentIds || []);
    res.json(comparison);
  });

  app.get('/api/credit/demo', (req, res) => {
    const reports = creditScoringEngine.runDemoCreditScoring();
    res.json(reports);
  });

  app.get('/api/credit/stats', (req, res) => {
    res.json(creditScoringEngine.getStats());
  });

  return app;
}
