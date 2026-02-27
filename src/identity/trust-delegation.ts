// ============================================================
// src/identity/trust-delegation.ts — Trust Delegation System
// ============================================================
// "Permissions follow people, not software."
//
// Owner → grants capabilities to Agent
// Agent → can delegate SUBSETS of its permissions to other agents
// Every delegation is recorded and auditable
// Trust chains can be revoked instantly
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface TrustCapability {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  maxDelegationDepth: number; // how many levels this can be re-delegated
}

export interface TrustDelegation {
  id: string;
  delegator: string;      // who is granting
  delegatorType: 'owner' | 'agent';
  delegate: string;       // who is receiving
  delegateType: 'agent';
  capabilities: string[]; // capability IDs granted
  constraints: TrustConstraint;
  status: 'active' | 'revoked' | 'expired';
  depth: number;          // 0 = from owner, 1 = from primary agent, etc.
  parentDelegationId?: string;  // chain link
  createdAt: number;
  expiresAt?: number;
  revokedAt?: number;
  revokedBy?: string;
}

export interface TrustConstraint {
  maxAmount?: number;      // max transaction amount
  dailyLimit?: number;     // max daily spend
  allowedChains?: string[];
  allowedActions?: string[];
  requireApproval?: boolean;
  timeWindow?: { start: number; end: number };
}

export interface TrustChain {
  owner: string;
  delegations: TrustDelegation[];
  agents: string[];
  depth: number;
  totalCapabilities: number;
}

export interface PermissionCheck {
  agentId: string;
  capability: string;
  allowed: boolean;
  reason: string;
  delegationChain: string[];
  constraints: TrustConstraint;
}

// ---- Default Capabilities ----

const CAPABILITIES: TrustCapability[] = [
  { id: 'cap-transfer', name: 'Transfer Funds', description: 'Send tokens to external addresses', riskLevel: 'high', maxDelegationDepth: 1 },
  { id: 'cap-trade', name: 'Execute Trades', description: 'Place orders on DEXes', riskLevel: 'high', maxDelegationDepth: 1 },
  { id: 'cap-read-balance', name: 'Read Balance', description: 'View wallet balances', riskLevel: 'low', maxDelegationDepth: 3 },
  { id: 'cap-risk-scan', name: 'Risk Scanning', description: 'Run risk assessments on wallets/contracts', riskLevel: 'low', maxDelegationDepth: 3 },
  { id: 'cap-contract-deploy', name: 'Deploy Contracts', description: 'Deploy smart contracts', riskLevel: 'critical', maxDelegationDepth: 0 },
  { id: 'cap-governance-vote', name: 'Governance Vote', description: 'Vote on governance proposals', riskLevel: 'medium', maxDelegationDepth: 2 },
  { id: 'cap-compliance-audit', name: 'Compliance Audit', description: 'Generate audit reports', riskLevel: 'low', maxDelegationDepth: 3 },
  { id: 'cap-moltbook-post', name: 'Moltbook Post', description: 'Publish posts to Moltbook', riskLevel: 'low', maxDelegationDepth: 2 },
  { id: 'cap-agent-spawn', name: 'Spawn Sub-Agent', description: 'Create and manage sub-agents', riskLevel: 'critical', maxDelegationDepth: 0 },
  { id: 'cap-x402-pay', name: 'x402 Payment', description: 'Make x402 protocol payments for resources', riskLevel: 'medium', maxDelegationDepth: 1 },
];

// ---- Trust Delegation Manager ----

export class TrustDelegationManager {
  private capabilities: Map<string, TrustCapability> = new Map();
  private delegations: TrustDelegation[] = [];
  private agentCapabilities: Map<string, Set<string>> = new Map();

  constructor() {
    for (const cap of CAPABILITIES) {
      this.capabilities.set(cap.id, cap);
    }

    // Bootstrap: owner delegates to primary RIDHWAN agent
    this.bootstrapOwnerDelegation();
    logger.info(`[Trust] Delegation manager initialized — ${this.capabilities.size} capabilities, ${this.delegations.length} active delegations`);
  }

  private bootstrapOwnerDelegation(): void {
    const ownerDelegation: TrustDelegation = {
      id: uuidv4(),
      delegator: 'owner:daver',
      delegatorType: 'owner',
      delegate: 'ridhwan-agent-01',
      delegateType: 'agent',
      capabilities: [
        'cap-transfer', 'cap-trade', 'cap-read-balance', 'cap-risk-scan',
        'cap-governance-vote', 'cap-compliance-audit', 'cap-moltbook-post',
        'cap-x402-pay',
      ],
      constraints: {
        maxAmount: 10000,
        dailyLimit: 50000,
        allowedChains: ['base', 'ethereum', 'polygon'],
      },
      status: 'active',
      depth: 0,
      createdAt: Date.now() - 86400000 * 7, // 7 days ago
    };
    this.delegations.push(ownerDelegation);
    this.agentCapabilities.set('ridhwan-agent-01', new Set(ownerDelegation.capabilities));

    // Primary agent delegates subsets to sub-agents
    const subDelegations: Partial<TrustDelegation>[] = [
      {
        delegator: 'ridhwan-agent-01',
        delegate: 'risk-guard',
        capabilities: ['cap-risk-scan', 'cap-read-balance', 'cap-compliance-audit'],
        constraints: { allowedActions: ['scan', 'assess', 'report'] },
      },
      {
        delegator: 'ridhwan-agent-01',
        delegate: 'trade-runner',
        capabilities: ['cap-trade', 'cap-read-balance', 'cap-x402-pay'],
        constraints: { maxAmount: 5000, dailyLimit: 25000, allowedChains: ['base'] },
      },
      {
        delegator: 'ridhwan-agent-01',
        delegate: 'policy-bot',
        capabilities: ['cap-governance-vote', 'cap-compliance-audit', 'cap-moltbook-post'],
        constraints: { allowedActions: ['enforce', 'vote', 'report', 'post'] },
      },
      {
        delegator: 'ridhwan-agent-01',
        delegate: 'compliance-ai',
        capabilities: ['cap-compliance-audit', 'cap-read-balance', 'cap-moltbook-post'],
        constraints: { allowedActions: ['audit', 'report', 'post'] },
      },
      {
        delegator: 'ridhwan-agent-01',
        delegate: 'trust-broker',
        capabilities: ['cap-risk-scan', 'cap-read-balance', 'cap-x402-pay', 'cap-moltbook-post'],
        constraints: { maxAmount: 1000, allowedChains: ['base'] },
      },
    ];

    for (const sub of subDelegations) {
      const delegation: TrustDelegation = {
        id: uuidv4(),
        delegator: sub.delegator!,
        delegatorType: 'agent',
        delegate: sub.delegate!,
        delegateType: 'agent',
        capabilities: sub.capabilities!,
        constraints: sub.constraints || {},
        status: 'active',
        depth: 1,
        parentDelegationId: ownerDelegation.id,
        createdAt: Date.now() - 86400000 * 3, // 3 days ago
      };
      this.delegations.push(delegation);
      this.agentCapabilities.set(delegation.delegate, new Set(delegation.capabilities));
    }
  }

  // ── Delegation Operations ──

  delegate(
    delegatorId: string,
    delegateId: string,
    capabilityIds: string[],
    constraints: TrustConstraint = {}
  ): TrustDelegation {
    // Verify delegator has these capabilities
    const delegatorCaps = this.agentCapabilities.get(delegatorId);
    if (!delegatorCaps) throw new Error(`Agent ${delegatorId} has no capabilities to delegate`);

    const missing = capabilityIds.filter(c => !delegatorCaps.has(c));
    if (missing.length > 0) throw new Error(`Cannot delegate capabilities not owned: ${missing.join(', ')}`);

    // Check delegation depth
    const delegatorChain = this.getDelegationChain(delegatorId);
    const currentDepth = delegatorChain.length;

    for (const capId of capabilityIds) {
      const cap = this.capabilities.get(capId);
      if (cap && currentDepth >= cap.maxDelegationDepth) {
        throw new Error(`Capability ${cap.name} cannot be delegated further (max depth: ${cap.maxDelegationDepth})`);
      }
    }

    const parentDelegation = this.delegations.find(d => d.delegate === delegatorId && d.status === 'active');

    const delegation: TrustDelegation = {
      id: uuidv4(),
      delegator: delegatorId,
      delegatorType: 'agent',
      delegate: delegateId,
      delegateType: 'agent',
      capabilities: capabilityIds,
      constraints,
      status: 'active',
      depth: currentDepth + 1,
      parentDelegationId: parentDelegation?.id,
      createdAt: Date.now(),
    };

    this.delegations.push(delegation);
    
    const existing = this.agentCapabilities.get(delegateId) || new Set();
    for (const cap of capabilityIds) existing.add(cap);
    this.agentCapabilities.set(delegateId, existing);

    logger.info(`[Trust] Delegated ${capabilityIds.length} capabilities: ${delegatorId} → ${delegateId}`);
    return delegation;
  }

  revoke(delegationId: string, revokedBy: string): TrustDelegation {
    const delegation = this.delegations.find(d => d.id === delegationId);
    if (!delegation) throw new Error(`Delegation not found: ${delegationId}`);

    delegation.status = 'revoked';
    delegation.revokedAt = Date.now();
    delegation.revokedBy = revokedBy;

    // Cascade: revoke all child delegations
    const children = this.delegations.filter(d => d.parentDelegationId === delegationId && d.status === 'active');
    for (const child of children) {
      this.revoke(child.id, revokedBy);
    }

    // Rebuild agent capabilities
    this.rebuildCapabilities(delegation.delegate);

    logger.info(`[Trust] Revoked delegation ${delegationId.slice(0, 8)} (${children.length} cascaded)`);
    return delegation;
  }

  // ── Permission Checks ──

  checkPermission(agentId: string, capabilityId: string): PermissionCheck {
    const caps = this.agentCapabilities.get(agentId);
    const allowed = caps?.has(capabilityId) ?? false;

    const chain = this.getDelegationChain(agentId);
    const delegation = this.delegations.find(
      d => d.delegate === agentId && d.status === 'active' && d.capabilities.includes(capabilityId)
    );

    return {
      agentId,
      capability: capabilityId,
      allowed,
      reason: allowed
        ? `Granted via delegation chain (depth ${chain.length})`
        : `Agent does not have capability: ${capabilityId}`,
      delegationChain: chain.map(d => d.delegator),
      constraints: delegation?.constraints || {},
    };
  }

  // ── Chain Traversal ──

  getDelegationChain(agentId: string): TrustDelegation[] {
    const chain: TrustDelegation[] = [];
    let current = agentId;
    let depth = 0;

    while (depth < 10) {
      const delegation = this.delegations.find(d => d.delegate === current && d.status === 'active');
      if (!delegation) break;
      chain.push(delegation);
      current = delegation.delegator;
      depth++;
    }

    return chain;
  }

  getTrustChain(agentId: string): TrustChain {
    const chain = this.getDelegationChain(agentId);
    const allAgents = new Set<string>();
    for (const d of this.delegations.filter(d => d.status === 'active')) {
      allAgents.add(d.delegator);
      allAgents.add(d.delegate);
    }

    return {
      owner: 'owner:daver',
      delegations: chain,
      agents: Array.from(allAgents),
      depth: chain.length,
      totalCapabilities: this.agentCapabilities.get(agentId)?.size || 0,
    };
  }

  // ── Rebuild ──

  private rebuildCapabilities(agentId: string): void {
    const activeDelegations = this.delegations.filter(d => d.delegate === agentId && d.status === 'active');
    const caps = new Set<string>();
    for (const d of activeDelegations) {
      for (const c of d.capabilities) caps.add(c);
    }
    this.agentCapabilities.set(agentId, caps);
  }

  // ── Query ──

  getAllCapabilities(): TrustCapability[] {
    return Array.from(this.capabilities.values());
  }

  getAgentCapabilities(agentId: string): TrustCapability[] {
    const capIds = this.agentCapabilities.get(agentId);
    if (!capIds) return [];
    return Array.from(capIds).map(id => this.capabilities.get(id)!).filter(Boolean);
  }

  getDelegations(): TrustDelegation[] {
    return this.delegations;
  }

  getActiveDelegations(): TrustDelegation[] {
    return this.delegations.filter(d => d.status === 'active');
  }

  getStats() {
    return {
      totalCapabilities: this.capabilities.size,
      totalDelegations: this.delegations.length,
      activeDelegations: this.delegations.filter(d => d.status === 'active').length,
      revokedDelegations: this.delegations.filter(d => d.status === 'revoked').length,
      totalAgents: this.agentCapabilities.size,
      avgCapabilitiesPerAgent: this.agentCapabilities.size > 0
        ? Math.round(
            Array.from(this.agentCapabilities.values()).reduce((s, caps) => s + caps.size, 0) /
            this.agentCapabilities.size * 10
          ) / 10
        : 0,
    };
  }
}

export const trustDelegation = new TrustDelegationManager();
export default trustDelegation;
