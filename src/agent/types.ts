// ============================================================
// src/agent/types.ts — Core agent type definitions
// ============================================================

export type ActionClass =
  | 'payment'
  | 'transfer'
  | 'token_launch'
  | 'ownership_renounce'
  | 'swap'
  | 'stake'
  | 'governance_vote'
  | 'skill_install'
  | 'api_call'
  | 'file_access'
  | 'moltbook_post'
  | 'generic';

export interface AgentAction {
  id: string;
  agentId: string;
  actionClass: ActionClass;
  description: string;
  params: Record<string, unknown>;
  timestamp: number;
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed' | 'held';
  policyResult?: PolicyDecision;
  receipt?: ActionReceipt;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  policyId: string;
  riskScore: number;
  evaluatedAt: number;
  conditions?: string[];
}

export interface ActionReceipt {
  actionId: string;
  agentId: string;
  actionClass: ActionClass;
  description: string;
  status: 'success' | 'failure';
  txHash?: string;
  explorerUrl?: string;
  gasUsed?: string;
  costUsd?: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface AgentConfig {
  id: string;
  name: string;
  walletAddress: string;
  policies: string[];
  skills: string[];
  createdAt: number;
}

export interface HeartbeatPayload {
  agentId: string;
  agentName: string;
  timestamp: number;
  status: 'running' | 'paused' | 'error';
  actionsExecuted: number;
  actionsBlocked: number;
  walletBalance?: string;
  summary: string;
}

export interface HookContext {
  action: AgentAction;
  agent: AgentConfig;
  metadata: Record<string, unknown>;
}

export type HookHandler = (ctx: HookContext) => Promise<HookResult>;

export interface HookResult {
  proceed: boolean;
  modified?: Partial<AgentAction>;
  reason?: string;
}
