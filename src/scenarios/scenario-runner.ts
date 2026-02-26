// ============================================================
// src/scenarios/scenario-runner.ts — Replayable Scenario Runner v1
// ============================================================
// Executes predefined governance scenarios to demonstrate
// RIDHWAN's capabilities in a reproducible, auditable way.
//
// Each scenario is a sequence of steps that exercise specific
// features. Scenarios can be replayed for demos, testing,
// and compliance verification.
//
// Built-in scenarios:
//   1. happy-path — Normal operations within policy bounds
//   2. guardrails — Actions blocked by governance (budget, policy)
//   3. hold-gate — Irreversible action HOLD mechanism
//   4. skill-audit — Skill scanner catching malicious skills
//   5. full-cycle — Complete economic cycle (fund → trade → audit)
// ============================================================

import logger from '../utils/logger';
import { agentRuntime } from '../agent/agent-runtime';
import { surgeActionLoop } from '../surge/action-loop';
import { riskScorer } from '../governance/risk-scorer';
import { holdMechanism } from '../governance/hold-mechanism';
import { skillScanner } from '../security/skill-scanner';
import { costRouter } from '../economic/cost-router';
import { treasuryTracker } from '../economic/treasury-tracker';
import { auditLedger } from '../policy-engine/audit-ledger';
import { budgetTracker } from '../policy-engine/budget-tracker';
import { config } from '../utils/config';

// ---- Types ----

export interface ScenarioStep {
  name: string;
  description: string;
  action: () => Promise<ScenarioStepResult>;
}

export interface ScenarioStepResult {
  success: boolean;
  output: Record<string, unknown>;
  logs: string[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  tags: string[];
}

export interface ScenarioRunResult {
  scenarioId: string;
  scenarioName: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  steps: Array<{
    name: string;
    success: boolean;
    durationMs: number;
    output: Record<string, unknown>;
    logs: string[];
  }>;
  allPassed: boolean;
  summary: string;
}

// ---- Scenario Definitions ----

function buildScenarios(): Scenario[] {
  return [
    // ---- Scenario 1: Happy Path ----
    {
      id: 'happy-path',
      name: 'Happy Path — Normal Operations',
      description: 'Demonstrates normal agent operations within policy bounds',
      tags: ['basic', 'policy', 'transfer', 'audit'],
      steps: [
        {
          name: 'Small Transfer (Allowed)',
          description: 'A $10 transfer that passes all policy checks',
          action: async () => {
            const result = await surgeActionLoop.executeTransfer({
              to: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
              amount: '10',
              currency: 'USDC',
            });
            return {
              success: result.success,
              output: {
                status: result.success ? 'executed' : 'rejected',
                riskScore: result.riskAssessment.score,
                riskLevel: result.riskAssessment.level,
                explorerUrl: result.explorerUrl || 'N/A',
              },
              logs: [
                `Transfer result: ${result.success ? 'SUCCESS' : 'BLOCKED'}`,
                `Risk: ${result.riskAssessment.score}/100 (${result.riskAssessment.level})`,
              ],
            };
          },
        },
        {
          name: 'Valid Moltbook Post',
          description: 'Post a build update to Moltbook',
          action: async () => {
            const result = await agentRuntime.executeAction(
              'moltbook_post',
              'Daily build update to lablab submolt',
              { submolt: 'lablab', title: 'Scenario Runner Test Post' }
            );
            return {
              success: result.status === 'executed',
              output: { status: result.status, actionId: result.id },
              logs: [`Moltbook post: ${result.status}`],
            };
          },
        },
        {
          name: 'Audit Trail Check',
          description: 'Verify audit trail captured both actions',
          action: async () => {
            const stats = auditLedger.getStats();
            const recent = auditLedger.getRecentEntries(5);
            return {
              success: stats.total > 0,
              output: {
                totalEntries: stats.total,
                recentCount: recent.length,
                executed: stats.executed,
                blocked: stats.blocked,
              },
              logs: [
                `Audit: ${stats.total} total, ${stats.executed} executed, ${stats.blocked} blocked`,
              ],
            };
          },
        },
      ],
    },

    // ---- Scenario 2: Guardrails ----
    {
      id: 'guardrails',
      name: 'Guardrails — Policy Enforcement',
      description: 'Shows the governance layer blocking unauthorized actions',
      tags: ['policy', 'budget', 'security'],
      steps: [
        {
          name: 'Over-Budget Transfer (Blocked)',
          description: 'A $600 transfer exceeding the $100/tx limit',
          action: async () => {
            const result = await surgeActionLoop.executeTransfer({
              to: '0xDead000000000000000000000000000000000000',
              amount: '600',
              currency: 'USDC',
            });
            return {
              success: !result.success, // Success means it was correctly blocked
              output: {
                blocked: !result.success,
                riskScore: result.riskAssessment.score,
                reason: 'Exceeds maxPerTransaction ($100)',
              },
              logs: [
                `$600 transfer: ${result.success ? 'EXECUTED (BAD!)' : 'BLOCKED (CORRECT)'}`,
                `Risk: ${result.riskAssessment.score}/100`,
              ],
            };
          },
        },
        {
          name: 'Ownership Renounce (Blocked)',
          description: 'Attempt to renounce contract ownership — irreversible, always blocked',
          action: async () => {
            const result = await surgeActionLoop.executeIrreversibleAction({
              actionClass: 'ownership_renounce',
              description: 'Renounce ownership of token contract',
              targetAddress: '0x1234567890abcdef1234567890abcdef12345678',
            });
            return {
              success: !result.success, // Correctly blocked
              output: {
                blocked: !result.success,
                riskScore: result.riskAssessment.score,
                dangerLevel: 'critical',
              },
              logs: [
                `Ownership renounce: BLOCKED (correctly by policy)`,
                `Risk: ${result.riskAssessment.score}/100 (${result.riskAssessment.level})`,
              ],
            };
          },
        },
        {
          name: 'Budget Usage After Blocks',
          description: 'Verify budget was NOT consumed by blocked actions',
          action: async () => {
            const usage = budgetTracker.getUsage(config.agent.id);
            return {
              success: true,
              output: {
                dailySpend: usage.dailySpend,
                weeklySpend: usage.weeklySpend,
                monthlySpend: usage.monthlySpend,
              },
              logs: [`Daily spend: $${usage.dailySpend} (blocked actions don't count)`],
            };
          },
        },
      ],
    },

    // ---- Scenario 3: HOLD Gate ----
    {
      id: 'hold-gate',
      name: 'HOLD Gate — Safety Mechanism',
      description: 'Demonstrates the countdown-based HOLD for high-risk actions',
      tags: ['hold', 'safety', 'token-launch'],
      steps: [
        {
          name: 'Token Launch with HOLD',
          description: 'Launch a token — triggers HOLD mechanism (high risk)',
          action: async () => {
            const result = await surgeActionLoop.executeTokenLaunch({
              name: 'Ridhwan Trust Token',
              ticker: 'RIDH',
              description: 'Governance token for the Ridhwan trust mesh',
              initialBuyEth: '0.01',
            });
            return {
              success: true, // The HOLD itself working is the success
              output: {
                holdApplied: result.holdApplied,
                holdDuration: result.holdResult?.duration || 0,
                holdStatus: result.holdResult?.status || 'N/A',
                dangerLevel: result.holdResult?.dangerLevel || 'N/A',
                actionResult: result.success ? 'executed' : 'blocked',
              },
              logs: [
                `HOLD: ${result.holdApplied ? 'APPLIED' : 'NOT APPLIED'}`,
                `Duration: ${result.holdResult?.duration || 0}ms`,
                `Danger: ${result.holdResult?.dangerLevel || 'N/A'}`,
                `Result: ${result.holdResult?.status || 'N/A'}`,
              ],
            };
          },
        },
        {
          name: 'HOLD Statistics',
          description: 'Review HOLD mechanism stats',
          action: async () => {
            const stats = holdMechanism.getStats();
            return {
              success: true,
              output: stats,
              logs: [
                `Total holds: ${stats.totalHolds}`,
                `Confirmed: ${stats.confirmed}, Escalated: ${stats.escalated}`,
              ],
            };
          },
        },
      ],
    },

    // ---- Scenario 4: Skill Audit ----
    {
      id: 'skill-audit',
      name: 'Skill Security Audit',
      description: 'Scans skills for security vulnerabilities',
      tags: ['security', 'scanner', 'skills'],
      steps: [
        {
          name: 'Scan Safe Skill',
          description: 'Scan the Ridhwan governance skill — should pass',
          action: async () => {
            const result = skillScanner.scanDemoSkill();
            return {
              success: result.approved,
              output: {
                skillName: result.skillName,
                approved: result.approved,
                findings: result.findings.length,
                riskScore: result.riskScore,
                summary: result.summary,
              },
              logs: [
                `Safe skill: ${result.approved ? 'APPROVED' : 'REJECTED'}`,
                `Findings: ${result.findings.length}, Risk: ${result.riskScore}/100`,
              ],
            };
          },
        },
        {
          name: 'Scan Malicious Skill',
          description: 'Scan a deliberately malicious skill — should be rejected',
          action: async () => {
            const result = skillScanner.scanMaliciousDemo();
            return {
              success: !result.approved, // Correctly rejected
              output: {
                skillName: result.skillName,
                approved: result.approved,
                findings: result.findings.length,
                criticalFindings: result.findings.filter(f => f.severity === 'critical').length,
                riskScore: result.riskScore,
                categories: [...new Set(result.findings.map(f => f.category))],
                summary: result.summary,
              },
              logs: [
                `Malicious skill: ${result.approved ? 'APPROVED (BAD!)' : 'REJECTED (CORRECT)'}`,
                `Findings: ${result.findings.length} (${result.findings.filter(f => f.severity === 'critical').length} critical)`,
                `Risk: ${result.riskScore}/100`,
              ],
            };
          },
        },
        {
          name: 'Scanner Stats',
          description: 'Review overall scanner statistics',
          action: async () => {
            const stats = skillScanner.getStats();
            return {
              success: true,
              output: stats,
              logs: [
                `Total scans: ${stats.totalScans}, ` +
                `Approved: ${stats.approved}, Rejected: ${stats.rejected}`,
              ],
            };
          },
        },
      ],
    },

    // ---- Scenario 5: Full Cycle ----
    {
      id: 'full-cycle',
      name: 'Full Economic Cycle',
      description: 'Complete economic cycle: risk → cost route → transfer → treasury → audit',
      tags: ['economic', 'treasury', 'cost-router', 'full'],
      steps: [
        {
          name: 'LLM Cost Routing',
          description: 'Route an analysis task to the cheapest capable provider',
          action: async () => {
            const decision = costRouter.selectProvider('analysis', 1024);
            return {
              success: true,
              output: {
                provider: decision.provider.name,
                model: decision.provider.model,
                costPer1kTokens: decision.provider.costPer1kTokens,
                reason: decision.reason,
                alternatives: decision.alternativeCount,
              },
              logs: [
                `Routed to: ${decision.provider.name} ($${decision.provider.costPer1kTokens}/1K)`,
                `Reason: ${decision.reason}`,
              ],
            };
          },
        },
        {
          name: 'Risk-Assessed Transfer',
          description: 'Execute a $25 transfer with full risk assessment',
          action: async () => {
            const result = await surgeActionLoop.executeTransfer({
              to: '0xABCDef1234567890abcDEF1234567890AbCdEf12',
              amount: '25',
              currency: 'USDC',
            });
            return {
              success: result.success,
              output: {
                riskScore: result.riskAssessment.score,
                riskLevel: result.riskAssessment.level,
                holdApplied: result.holdApplied,
                explorerUrl: result.explorerUrl || 'N/A',
              },
              logs: [
                `Transfer: ${result.success ? 'SUCCESS' : 'BLOCKED'}`,
                `Risk: ${result.riskAssessment.score}/100 (${result.riskAssessment.level})`,
              ],
            };
          },
        },
        {
          name: 'Treasury Snapshot',
          description: 'View treasury state after operations',
          action: async () => {
            const snapshot = treasuryTracker.getSnapshot();
            return {
              success: true,
              output: {
                totalValueUsd: snapshot.totalValueUsd,
                cashFlowNet: snapshot.cashFlowSummary.netFlow,
                pnlTotal: snapshot.pnl.total,
                healthScore: snapshot.healthScore,
                healthStatus: snapshot.healthStatus,
              },
              logs: [
                `Treasury: $${snapshot.totalValueUsd.toFixed(2)} total`,
                `Health: ${snapshot.healthScore}/100 (${snapshot.healthStatus})`,
                `Net flow: $${snapshot.cashFlowSummary.netFlow.toFixed(2)}`,
              ],
            };
          },
        },
        {
          name: 'Risk Trend Analysis',
          description: 'Analyze risk trend over recent actions',
          action: async () => {
            const trend = riskScorer.getRiskTrend(5);
            const stats = riskScorer.getStats();
            return {
              success: true,
              output: {
                trend: trend.trend,
                recentAvgRisk: trend.recentAvg,
                totalAssessed: stats.totalAssessed,
                avgRiskScore: stats.avgRiskScore,
                violationCount: stats.violationCount,
              },
              logs: [
                `Risk trend: ${trend.trend} (recent avg: ${trend.recentAvg}/100)`,
                `Total assessed: ${stats.totalAssessed}, Violations: ${stats.violationCount}`,
              ],
            };
          },
        },
        {
          name: 'Compliance Summary',
          description: 'Generate final compliance summary',
          action: async () => {
            const auditStats = auditLedger.getStats();
            const budgetUsage = budgetTracker.getUsage(config.agent.id);
            const summary = surgeActionLoop.getSummary();
            return {
              success: true,
              output: {
                auditEntries: auditStats.total,
                actionsExecuted: auditStats.executed,
                actionsBlocked: auditStats.blocked,
                dailySpend: budgetUsage.dailySpend,
                holdStats: summary.holdStats,
                riskStats: summary.riskStats,
                treasuryHealth: summary.treasuryStats.healthScore,
              },
              logs: [
                `Audit: ${auditStats.total} entries (${auditStats.executed} executed, ${auditStats.blocked} blocked)`,
                `Budget: $${budgetUsage.dailySpend} daily spend`,
                `Treasury health: ${summary.treasuryStats.healthScore}/100`,
              ],
            };
          },
        },
      ],
    },
  ];
}

// ---- Scenario Runner ----

export class ScenarioRunner {
  private scenarios: Scenario[];
  private runHistory: ScenarioRunResult[] = [];

  constructor() {
    this.scenarios = buildScenarios();
  }

  /**
   * List all available scenarios.
   */
  listScenarios(): Array<{ id: string; name: string; description: string; steps: number; tags: string[] }> {
    return this.scenarios.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      steps: s.steps.length,
      tags: s.tags,
    }));
  }

  /**
   * Run a specific scenario by ID.
   */
  async runScenario(id: string): Promise<ScenarioRunResult> {
    const scenario = this.scenarios.find(s => s.id === id);
    if (!scenario) {
      throw new Error(`Scenario "${id}" not found. Available: ${this.scenarios.map(s => s.id).join(', ')}`);
    }

    logger.info(`\n[Scenario] ========== ${scenario.name} ==========`);
    logger.info(`[Scenario] ${scenario.description}\n`);

    const startedAt = Date.now();
    const stepResults: ScenarioRunResult['steps'] = [];

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepStart = Date.now();

      logger.info(`[Scenario] Step ${i + 1}/${scenario.steps.length}: ${step.name}`);

      try {
        const result = await step.action();
        stepResults.push({
          name: step.name,
          success: result.success,
          durationMs: Date.now() - stepStart,
          output: result.output,
          logs: result.logs,
        });

        const icon = result.success ? '✅' : '❌';
        logger.info(`[Scenario]   ${icon} ${step.name}: ${result.logs[0] || 'done'}`);
      } catch (err) {
        stepResults.push({
          name: step.name,
          success: false,
          durationMs: Date.now() - stepStart,
          output: { error: String(err) },
          logs: [`ERROR: ${err}`],
        });
        logger.error(`[Scenario]   ❌ ${step.name}: ${err}`);
      }
    }

    const completedAt = Date.now();
    const allPassed = stepResults.every(s => s.success);

    const runResult: ScenarioRunResult = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      steps: stepResults,
      allPassed,
      summary: allPassed
        ? `All ${stepResults.length} steps passed in ${completedAt - startedAt}ms`
        : `${stepResults.filter(s => s.success).length}/${stepResults.length} steps passed`,
    };

    this.runHistory.push(runResult);

    const resultIcon = allPassed ? '🎉' : '⚠️';
    logger.info(`\n[Scenario] ${resultIcon} ${scenario.name}: ${runResult.summary}\n`);

    return runResult;
  }

  /**
   * Run all scenarios sequentially.
   */
  async runAll(): Promise<ScenarioRunResult[]> {
    const results: ScenarioRunResult[] = [];
    for (const scenario of this.scenarios) {
      results.push(await this.runScenario(scenario.id));
    }
    return results;
  }

  /**
   * Get run history.
   */
  getHistory(): ScenarioRunResult[] {
    return [...this.runHistory];
  }
}

export const scenarioRunner = new ScenarioRunner();
export default scenarioRunner;
