// ============================================================
// src/identity/agent-registry.ts — On-Chain Agent Registry
// ============================================================
// Simulates on-chain agent registration, discovery, and trust lookup.
// Provides agent identity management for multi-agent economies.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../utils/logger';

// ---- Types ----

export interface RegisteredAgent {
  registrationId: string;
  agentId: string;
  name: string;
  did: string;
  walletAddress: string;
  capabilities: string[];
  status: 'active' | 'suspended' | 'revoked';
  trustLevel: 'untrusted' | 'basic' | 'verified' | 'enterprise';
  onChainTxHash: string;      // simulated
  registeredAt: number;
  lastActiveAt: number;
  metadata: Record<string, unknown>;
}

export interface AgentDiscoveryQuery {
  capabilities?: string[];
  minTrustLevel?: RegisteredAgent['trustLevel'];
  status?: RegisteredAgent['status'];
  limit?: number;
}

export interface TrustLookupResult {
  agentId: string;
  trustLevel: RegisteredAgent['trustLevel'];
  registrationVerified: boolean;
  credentialCount: number;
  lastActive: number;
  trustScore: number;
}

// ---- Agent Registry ----

export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();
  private trustScores: Map<string, number> = new Map();

  private readonly TRUST_LEVELS: RegisteredAgent['trustLevel'][] = ['untrusted', 'basic', 'verified', 'enterprise'];

  // ---- Registration ----

  register(params: {
    agentId: string;
    name: string;
    did: string;
    walletAddress: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
  }): RegisteredAgent {
    const registrationId = uuidv4();
    const onChainTxHash = '0x' + crypto.randomBytes(32).toString('hex');

    const agent: RegisteredAgent = {
      registrationId,
      agentId: params.agentId,
      name: params.name,
      did: params.did,
      walletAddress: params.walletAddress,
      capabilities: params.capabilities,
      status: 'active',
      trustLevel: 'basic',
      onChainTxHash,
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata: params.metadata || {},
    };

    this.agents.set(params.agentId, agent);
    this.trustScores.set(params.agentId, 25);
    logger.info(`[Registry] Registered agent: ${params.name} (${params.agentId}) → tx: ${onChainTxHash.slice(0, 14)}...`);
    return agent;
  }

  // ---- Discovery ----

  discover(query: AgentDiscoveryQuery): RegisteredAgent[] {
    let results = Array.from(this.agents.values());

    if (query.status) {
      results = results.filter(a => a.status === query.status);
    }

    if (query.minTrustLevel) {
      const minIdx = this.TRUST_LEVELS.indexOf(query.minTrustLevel);
      results = results.filter(a => this.TRUST_LEVELS.indexOf(a.trustLevel) >= minIdx);
    }

    if (query.capabilities && query.capabilities.length > 0) {
      results = results.filter(a =>
        query.capabilities!.some(c => a.capabilities.includes(c))
      );
    }

    const limit = query.limit || 50;
    return results.slice(0, limit);
  }

  // ---- Trust Lookup ----

  lookupTrust(agentId: string): TrustLookupResult | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      agentId,
      trustLevel: agent.trustLevel,
      registrationVerified: agent.status === 'active',
      credentialCount: Object.keys(agent.metadata).length,
      lastActive: agent.lastActiveAt,
      trustScore: this.trustScores.get(agentId) || 0,
    };
  }

  // ---- Trust Management ----

  updateTrustLevel(agentId: string, level: RegisteredAgent['trustLevel']): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.trustLevel = level;
    agent.lastActiveAt = Date.now();

    const scoreMap = { untrusted: 0, basic: 25, verified: 60, enterprise: 90 };
    this.trustScores.set(agentId, scoreMap[level]);

    logger.info(`[Registry] Updated trust: ${agentId} → ${level}`);
    return true;
  }

  incrementTrust(agentId: string, amount: number): void {
    const current = this.trustScores.get(agentId) || 0;
    const newScore = Math.min(100, current + amount);
    this.trustScores.set(agentId, newScore);

    // Auto-upgrade trust level
    const agent = this.agents.get(agentId);
    if (agent) {
      if (newScore >= 80) agent.trustLevel = 'enterprise';
      else if (newScore >= 50) agent.trustLevel = 'verified';
      else if (newScore >= 20) agent.trustLevel = 'basic';
      agent.lastActiveAt = Date.now();
    }
  }

  suspendAgent(agentId: string, reason: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.status = 'suspended';
    agent.metadata.suspendReason = reason;
    agent.metadata.suspendedAt = Date.now();
    logger.warn(`[Registry] Suspended agent: ${agentId} — ${reason}`);
    return true;
  }

  // ---- Activity Tracking ----

  recordActivity(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastActiveAt = Date.now();
    }
  }

  // ---- Stats ----

  getStats(): {
    totalAgents: number;
    activeAgents: number;
    suspendedAgents: number;
    trustDistribution: Record<string, number>;
    avgTrustScore: number;
  } {
    const agents = Array.from(this.agents.values());
    const trustDist: Record<string, number> = { untrusted: 0, basic: 0, verified: 0, enterprise: 0 };
    let trustSum = 0;

    for (const a of agents) {
      trustDist[a.trustLevel] = (trustDist[a.trustLevel] || 0) + 1;
      trustSum += this.trustScores.get(a.agentId) || 0;
    }

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      suspendedAgents: agents.filter(a => a.status === 'suspended').length,
      trustDistribution: trustDist,
      avgTrustScore: agents.length > 0 ? Math.round(trustSum / agents.length) : 0,
    };
  }

  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }
}

export const agentRegistry = new AgentRegistry();
export default agentRegistry;
