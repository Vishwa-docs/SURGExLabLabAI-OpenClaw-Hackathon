// ============================================================
// src/agent/orchestrator.ts — Multi-Agent Orchestrator
// ============================================================
// Coordinates specialized sub-agents that each handle a domain:
//   - RiskGuard    — Real-time risk assessment & fraud detection
//   - PolicyBot    — Policy evaluation & enforcement
//   - TradeRunner  — Trade execution & portfolio management
//   - ComplianceAI — Audit, SOC 2 checks, compliance verification
//   - TrustBroker  — Identity, DID, trust delegation, MCP comms
//
// The orchestrator routes incoming tasks to the appropriate
// sub-agent, manages concurrency, tracks execution pipelines,
// and provides a unified view of the agent swarm.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export type SubAgentRole = 'risk_guard' | 'policy_bot' | 'trade_runner' | 'compliance_ai' | 'trust_broker';

export interface SubAgent {
  id: string;
  name: string;
  role: SubAgentRole;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  tasksCompleted: number;
  tasksFailed: number;
  avgLatencyMs: number;
  lastActive: number;
  trustScore: number;
  description: string;
  permissions: string[];       // What this sub-agent is allowed to do
  deniedPermissions: string[]; // Explicitly denied permissions
}

export interface OrchestratorTask {
  id: string;
  type: string;
  description: string;
  assignedTo: SubAgentRole;
  status: 'queued' | 'routing' | 'executing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  input: Record<string, any>;
  output?: Record<string, any>;
  startedAt?: number;
  completedAt?: number;
  latencyMs?: number;
  pipelineSteps?: PipelineStep[];
}

export interface PipelineStep {
  agent: SubAgentRole;
  action: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  input?: any;
  output?: any;
  startedAt?: number;
  completedAt?: number;
}

export interface OrchestratorStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgLatencyMs: number;
  agentUtilization: Record<SubAgentRole, number>;
  pipelinesExecuted: number;
  uptime: number;
}

// ---- Sub-Agent Definitions ----

const SUB_AGENT_DEFS: Omit<SubAgent, 'id' | 'tasksCompleted' | 'tasksFailed' | 'avgLatencyMs' | 'lastActive' | 'status'>[] = [
  {
    name: 'RiskGuard',
    role: 'risk_guard',
    capabilities: ['risk_scoring', 'fraud_detection', 'gnn_analysis', 'threat_assessment', 'anomaly_detection'],
    trustScore: 95,
    description: 'Specialized in real-time risk assessment using 7-signal scoring and GNN fraud detection. Monitors transaction patterns, detects circular flows, and flags suspicious behavior.',
    permissions: ['read_transactions', 'read_wallets', 'assess_risk', 'flag_fraud', 'trigger_hold'],
    deniedPermissions: ['execute_transfer', 'modify_policy', 'access_payments'],
  },
  {
    name: 'PolicyBot',
    role: 'policy_bot',
    capabilities: ['policy_evaluation', 'budget_enforcement', 'address_validation', 'action_gating', 'domain_checks'],
    trustScore: 98,
    description: 'Enforces the 5-layer governance pipeline on every agent action. Evaluates policies, checks budgets, validates addresses, and gates dangerous operations.',
    permissions: ['read_policies', 'evaluate_actions', 'enforce_budgets', 'gate_actions', 'escalate_to_hold'],
    deniedPermissions: ['execute_transfer', 'trade', 'access_wallets'],
  },
  {
    name: 'TradeRunner',
    role: 'trade_runner',
    capabilities: ['order_execution', 'portfolio_management', 'defi_yield', 'market_analysis', 'prediction_markets'],
    trustScore: 88,
    description: 'Handles all trading operations — order placement, portfolio tracking, DeFi yield farming, and market analysis. Operates within policy-enforced limits.',
    permissions: ['place_orders', 'manage_portfolio', 'access_market_data', 'create_strategies', 'read_prices'],
    deniedPermissions: ['modify_policy', 'access_audit', 'manage_identity'],
  },
  {
    name: 'ComplianceAI',
    role: 'compliance_ai',
    capabilities: ['audit_generation', 'soc2_mapping', 'compliance_checks', 'carbon_tracking', 'receipt_generation'],
    trustScore: 97,
    description: 'Generates compliance reports, maps actions to SOC 2 Type II controls, tracks carbon footprint, and produces immutable audit receipts.',
    permissions: ['read_audit_log', 'generate_reports', 'export_compliance', 'track_carbon', 'verify_integrity'],
    deniedPermissions: ['execute_transfer', 'trade', 'modify_policy'],
  },
  {
    name: 'TrustBroker',
    role: 'trust_broker',
    capabilities: ['did_management', 'credential_issuance', 'trust_delegation', 'mcp_communication', 'agent_discovery'],
    trustScore: 93,
    description: 'Manages decentralized identity, issues verifiable credentials, handles trust delegation chains, and coordinates inter-agent communication via MCP.',
    permissions: ['create_did', 'issue_credentials', 'delegate_trust', 'discover_agents', 'manage_channels'],
    deniedPermissions: ['execute_transfer', 'trade', 'modify_audit'],
  },
];

// ---- Task Routing Rules ----

const TASK_ROUTING: Record<string, SubAgentRole> = {
  'risk_assessment': 'risk_guard',
  'fraud_check': 'risk_guard',
  'anomaly_scan': 'risk_guard',
  'threat_eval': 'risk_guard',
  'policy_check': 'policy_bot',
  'budget_eval': 'policy_bot',
  'action_gate': 'policy_bot',
  'address_validate': 'policy_bot',
  'trade_execute': 'trade_runner',
  'order_place': 'trade_runner',
  'defi_allocate': 'trade_runner',
  'market_analyze': 'trade_runner',
  'yield_optimize': 'trade_runner',
  'audit_generate': 'compliance_ai',
  'compliance_check': 'compliance_ai',
  'soc2_map': 'compliance_ai',
  'receipt_generate': 'compliance_ai',
  'carbon_track': 'compliance_ai',
  'did_create': 'trust_broker',
  'credential_issue': 'trust_broker',
  'trust_delegate': 'trust_broker',
  'agent_discover': 'trust_broker',
  'mcp_communicate': 'trust_broker',
};

// ---- Multi-Step Pipeline Templates ----

const PIPELINE_TEMPLATES: Record<string, PipelineStep[]> = {
  'transfer': [
    { agent: 'policy_bot', action: 'Evaluate transfer against 5-layer policy stack', status: 'pending' },
    { agent: 'risk_guard', action: 'Score transaction risk (7-signal + GNN)', status: 'pending' },
    { agent: 'trust_broker', action: 'Verify recipient identity & trust level', status: 'pending' },
    { agent: 'compliance_ai', action: 'Generate audit receipt & compliance log', status: 'pending' },
  ],
  'trade': [
    { agent: 'policy_bot', action: 'Check trading policy limits & budget', status: 'pending' },
    { agent: 'risk_guard', action: 'Assess market risk & counterparty exposure', status: 'pending' },
    { agent: 'trade_runner', action: 'Route & execute trade order', status: 'pending' },
    { agent: 'compliance_ai', action: 'Log trade for regulatory reporting', status: 'pending' },
  ],
  'token_launch': [
    { agent: 'policy_bot', action: 'Gate action — verify token launch authorization', status: 'pending' },
    { agent: 'risk_guard', action: 'Deep risk assessment — irreversible action check', status: 'pending' },
    { agent: 'compliance_ai', action: 'MiCA/SEC compliance pre-check', status: 'pending' },
    { agent: 'trust_broker', action: 'Anchor to DID + broadcast via MCP', status: 'pending' },
    { agent: 'compliance_ai', action: 'Generate full compliance receipt packet', status: 'pending' },
  ],
  'x402_payment': [
    { agent: 'policy_bot', action: 'Evaluate x402 payment eligibility', status: 'pending' },
    { agent: 'risk_guard', action: 'Score payment risk + counterparty trust', status: 'pending' },
    { agent: 'trade_runner', action: 'Execute x402 USDC payment on Base', status: 'pending' },
    { agent: 'trust_broker', action: 'Exchange payment proof headers', status: 'pending' },
    { agent: 'compliance_ai', action: 'Audit x402 transaction flow', status: 'pending' },
  ],
};

// ---- Orchestrator Class ----

export class AgentOrchestrator {
  private subAgents: Map<SubAgentRole, SubAgent> = new Map();
  private tasks: OrchestratorTask[] = [];
  private pipelines: OrchestratorTask[] = [];
  private startedAt: number = Date.now();

  constructor() {
    this.initializeSubAgents();
  }

  private initializeSubAgents(): void {
    for (const def of SUB_AGENT_DEFS) {
      const agent: SubAgent = {
        ...def,
        id: `sub-${def.role}-${uuidv4().slice(0, 8)}`,
        status: 'idle',
        tasksCompleted: 0,
        tasksFailed: 0,
        avgLatencyMs: 0,
        lastActive: Date.now(),
      };
      this.subAgents.set(def.role, agent);
    }
    logger.info(`[Orchestrator] Initialized ${this.subAgents.size} sub-agents: ${SUB_AGENT_DEFS.map(d => d.name).join(', ')}`);
  }

  // ── Task Routing ──

  routeTask(type: string, description: string, input: Record<string, any>, priority: OrchestratorTask['priority'] = 'normal'): OrchestratorTask {
    const assignedTo = TASK_ROUTING[type] || 'policy_bot';
    const task: OrchestratorTask = {
      id: uuidv4(),
      type,
      description,
      assignedTo,
      status: 'routing',
      priority,
      input,
      startedAt: Date.now(),
    };

    const agent = this.subAgents.get(assignedTo);
    if (agent) {
      agent.status = 'busy';
      agent.lastActive = Date.now();
    }

    // Simulate execution
    task.status = 'executing';
    const latency = 50 + Math.floor(Math.random() * 200);
    
    task.output = {
      result: 'success',
      agent: assignedTo,
      latencyMs: latency,
      decision: this.generateDecision(type, input),
    };
    task.status = 'completed';
    task.completedAt = Date.now();
    task.latencyMs = latency;

    if (agent) {
      agent.status = 'idle';
      agent.tasksCompleted++;
      agent.avgLatencyMs = Math.round((agent.avgLatencyMs * (agent.tasksCompleted - 1) + latency) / agent.tasksCompleted);
    }

    this.tasks.push(task);
    logger.info(`[Orchestrator] Task ${task.id.slice(0, 8)} routed to ${assignedTo} — ${type} (${latency}ms)`);
    return task;
  }

  // ── Pipeline Execution ──

  executePipeline(pipelineType: string, description: string, input: Record<string, any>): OrchestratorTask {
    const template = PIPELINE_TEMPLATES[pipelineType];
    if (!template) {
      return this.routeTask(pipelineType, description, input);
    }

    const task: OrchestratorTask = {
      id: uuidv4(),
      type: `pipeline:${pipelineType}`,
      description,
      assignedTo: template[0].agent,
      status: 'executing',
      priority: 'high',
      input,
      startedAt: Date.now(),
      pipelineSteps: template.map(s => ({ ...s })),
    };

    // Execute each step sequentially (simulated)
    let totalLatency = 0;
    for (const step of task.pipelineSteps!) {
      const agent = this.subAgents.get(step.agent);
      step.status = 'running';
      step.startedAt = Date.now();

      const stepLatency = 30 + Math.floor(Math.random() * 150);
      totalLatency += stepLatency;

      step.output = { result: 'pass', latencyMs: stepLatency };
      step.status = 'done';
      step.completedAt = Date.now();

      if (agent) {
        agent.tasksCompleted++;
        agent.lastActive = Date.now();
        agent.avgLatencyMs = Math.round((agent.avgLatencyMs * (agent.tasksCompleted - 1) + stepLatency) / agent.tasksCompleted);
      }
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    task.latencyMs = totalLatency;
    task.output = {
      result: 'pipeline_complete',
      steps: task.pipelineSteps!.length,
      totalLatencyMs: totalLatency,
      allPassed: task.pipelineSteps!.every(s => s.status === 'done'),
    };

    this.pipelines.push(task);
    this.tasks.push(task);
    logger.info(`[Orchestrator] Pipeline ${pipelineType} completed in ${totalLatency}ms (${template.length} steps)`);
    return task;
  }

  // ── Decision Generator ──

  private generateDecision(type: string, input: Record<string, any>): any {
    switch (type) {
      case 'risk_assessment':
        return { score: Math.floor(Math.random() * 60) + 10, level: 'moderate', recommendation: 'allow' };
      case 'policy_check':
        return { allowed: true, layers_passed: 5, reason: 'All policy layers satisfied' };
      case 'trade_execute':
        return { orderId: uuidv4().slice(0, 8), status: 'filled', price: input.price || 2647.50 };
      case 'compliance_check':
        return { compliant: true, controls_checked: 30, soc2_score: 94.2 };
      case 'trust_delegate':
        return { delegated: true, chain: [input.from, input.to], permissions: input.permissions };
      default:
        return { status: 'completed', type };
    }
  }

  // ── Getters ──

  getSubAgents(): SubAgent[] {
    return Array.from(this.subAgents.values());
  }

  getSubAgent(role: SubAgentRole): SubAgent | undefined {
    return this.subAgents.get(role);
  }

  getRecentTasks(limit: number = 20): OrchestratorTask[] {
    return this.tasks.slice(-limit).reverse();
  }

  getRecentPipelines(limit: number = 10): OrchestratorTask[] {
    return this.pipelines.slice(-limit).reverse();
  }

  getPipelineTemplates(): Record<string, PipelineStep[]> {
    return { ...PIPELINE_TEMPLATES };
  }

  getStats(): OrchestratorStats {
    const utilization: Record<SubAgentRole, number> = {} as any;
    for (const [role, agent] of this.subAgents) {
      utilization[role] = agent.tasksCompleted;
    }

    const completed = this.tasks.filter(t => t.status === 'completed');
    const avgLatency = completed.length > 0
      ? Math.round(completed.reduce((s, t) => s + (t.latencyMs || 0), 0) / completed.length)
      : 0;

    return {
      totalTasks: this.tasks.length,
      activeTasks: this.tasks.filter(t => t.status === 'executing').length,
      completedTasks: completed.length,
      failedTasks: this.tasks.filter(t => t.status === 'failed').length,
      avgLatencyMs: avgLatency,
      agentUtilization: utilization,
      pipelinesExecuted: this.pipelines.length,
      uptime: Date.now() - this.startedAt,
    };
  }
}

export const orchestrator = new AgentOrchestrator();
export default orchestrator;
