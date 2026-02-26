// ============================================================
// src/governance/voting-system.ts — Governance Voting Simulation
// ============================================================
// Simulates on-chain governance voting for policy decisions.
// Supports proposals, voting, quorum checks, and execution.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../utils/logger';

// ---- Types ----

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: 'policy_change' | 'budget_adjustment' | 'agent_suspension' | 'trust_upgrade' | 'emergency';
  payload: Record<string, unknown>;
  status: 'draft' | 'active' | 'passed' | 'rejected' | 'executed' | 'expired';
  votes: Vote[];
  quorumRequired: number;              // Minimum votes needed
  approvalThreshold: number;            // % of yes votes needed (0-100)
  createdAt: number;
  expiresAt: number;
  executedAt?: number;
  executionTxHash?: string;
  onChainHash: string;
}

export interface Vote {
  voterId: string;
  voterName: string;
  vote: 'yes' | 'no' | 'abstain';
  weight: number;
  reason?: string;
  timestamp: number;
  signature: string;
}

export interface VotingResult {
  proposalId: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  yesWeight: number;
  noWeight: number;
  abstainWeight: number;
  quorumMet: boolean;
  thresholdMet: boolean;
  passed: boolean;
}

// ---- Voting System ----

export class VotingSystem {
  private proposals: Map<string, Proposal> = new Map();
  private voters: Map<string, { name: string; weight: number }> = new Map();

  constructor() {
    // Register default voters (simulated governance participants)
    this.registerVoter('governance-admin', 'Governance Admin', 3);
    this.registerVoter('risk-engine', 'Risk Engine', 2);
    this.registerVoter('treasury-guard', 'Treasury Guard', 2);
    this.registerVoter('compliance-officer', 'Compliance Officer', 2);
    this.registerVoter('community-rep', 'Community Rep', 1);
  }

  // ---- Voter Management ----

  registerVoter(voterId: string, name: string, weight: number = 1): void {
    this.voters.set(voterId, { name, weight });
  }

  // ---- Proposal Lifecycle ----

  createProposal(params: {
    title: string;
    description: string;
    proposer: string;
    type: Proposal['type'];
    payload: Record<string, unknown>;
    durationMs?: number;
    quorumRequired?: number;
    approvalThreshold?: number;
  }): Proposal {
    const id = uuidv4();
    const durationMs = params.durationMs || 86_400_000; // 24h default

    const proposal: Proposal = {
      id,
      title: params.title,
      description: params.description,
      proposer: params.proposer,
      type: params.type,
      payload: params.payload,
      status: 'active',
      votes: [],
      quorumRequired: params.quorumRequired || 3,
      approvalThreshold: params.approvalThreshold || 60,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      onChainHash: '0x' + crypto.createHash('sha256')
        .update(JSON.stringify({ id, ...params }) + Date.now())
        .digest('hex'),
    };

    this.proposals.set(id, proposal);
    logger.info(`[Voting] Proposal created: "${params.title}" (${id.slice(0, 8)}) by ${params.proposer}`);
    return proposal;
  }

  castVote(proposalId: string, voterId: string, vote: Vote['vote'], reason?: string): Vote | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      logger.warn(`[Voting] Proposal ${proposalId} not found`);
      return null;
    }

    if (proposal.status !== 'active') {
      logger.warn(`[Voting] Proposal ${proposalId} is ${proposal.status}, cannot vote`);
      return null;
    }

    // Check expiry
    if (Date.now() > proposal.expiresAt) {
      proposal.status = 'expired';
      return null;
    }

    // Check duplicate vote
    if (proposal.votes.find(v => v.voterId === voterId)) {
      logger.warn(`[Voting] ${voterId} already voted on ${proposalId}`);
      return null;
    }

    const voter = this.voters.get(voterId);
    const weight = voter?.weight || 1;
    const name = voter?.name || voterId;

    const voteEntry: Vote = {
      voterId,
      voterName: name,
      vote,
      weight,
      reason,
      timestamp: Date.now(),
      signature: crypto.createHash('sha256')
        .update(`${voterId}:${proposalId}:${vote}:${Date.now()}`)
        .digest('hex'),
    };

    proposal.votes.push(voteEntry);
    logger.info(`[Voting] ${name} voted ${vote} on "${proposal.title}" (weight: ${weight})`);

    // Check if vote resolves the proposal
    this.checkResolution(proposal);
    return voteEntry;
  }

  private checkResolution(proposal: Proposal): void {
    const result = this.tallyVotes(proposal.id);
    if (!result) return;

    if (result.quorumMet) {
      if (result.thresholdMet) {
        proposal.status = 'passed';
        logger.info(`[Voting] Proposal PASSED: "${proposal.title}"`);
      } else {
        // Only reject if all registered voters have voted
        const totalVoters = this.voters.size;
        if (result.totalVotes >= totalVoters) {
          proposal.status = 'rejected';
          logger.info(`[Voting] Proposal REJECTED: "${proposal.title}"`);
        }
      }
    }
  }

  // ---- Vote Tallying ----

  tallyVotes(proposalId: string): VotingResult | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;

    let yesVotes = 0, noVotes = 0, abstainVotes = 0;
    let yesWeight = 0, noWeight = 0, abstainWeight = 0;

    for (const v of proposal.votes) {
      if (v.vote === 'yes') { yesVotes++; yesWeight += v.weight; }
      else if (v.vote === 'no') { noVotes++; noWeight += v.weight; }
      else { abstainVotes++; abstainWeight += v.weight; }
    }

    const totalVotes = proposal.votes.length;
    const totalWeight = yesWeight + noWeight + abstainWeight;
    const quorumMet = totalVotes >= proposal.quorumRequired;
    const effectiveWeight = yesWeight + noWeight; // abstain doesn't count
    const approvalPct = effectiveWeight > 0 ? (yesWeight / effectiveWeight) * 100 : 0;
    const thresholdMet = quorumMet && approvalPct >= proposal.approvalThreshold;

    return {
      proposalId,
      totalVotes,
      yesVotes,
      noVotes,
      abstainVotes,
      yesWeight,
      noWeight,
      abstainWeight,
      quorumMet,
      thresholdMet,
      passed: thresholdMet,
    };
  }

  // ---- Execution ----

  executeProposal(proposalId: string): { success: boolean; txHash?: string; reason: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, reason: 'Proposal not found' };

    if (proposal.status !== 'passed') {
      return { success: false, reason: `Proposal status is ${proposal.status}, must be 'passed'` };
    }

    const txHash = '0x' + crypto.createHash('sha256')
      .update(`execute:${proposalId}:${Date.now()}`)
      .digest('hex');

    proposal.status = 'executed';
    proposal.executedAt = Date.now();
    proposal.executionTxHash = txHash;

    logger.info(`[Voting] Proposal executed: "${proposal.title}" → ${txHash.slice(0, 14)}...`);
    return { success: true, txHash, reason: 'Proposal executed successfully' };
  }

  // ---- Query ----

  getProposal(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }

  listProposals(status?: Proposal['status']): Proposal[] {
    const all = Array.from(this.proposals.values());
    if (status) return all.filter(p => p.status === status);
    return all;
  }

  getStats(): {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    rejectedProposals: number;
    executedProposals: number;
    totalVotesCast: number;
    registeredVoters: number;
  } {
    const proposals = Array.from(this.proposals.values());
    let totalVotes = 0;

    for (const p of proposals) {
      totalVotes += p.votes.length;
    }

    return {
      totalProposals: proposals.length,
      activeProposals: proposals.filter(p => p.status === 'active').length,
      passedProposals: proposals.filter(p => p.status === 'passed').length,
      rejectedProposals: proposals.filter(p => p.status === 'rejected').length,
      executedProposals: proposals.filter(p => p.status === 'executed').length,
      totalVotesCast: totalVotes,
      registeredVoters: this.voters.size,
    };
  }

  // ---- Demo ----

  runDemoVote(): { proposal: Proposal; result: VotingResult; executed: boolean } {
    const proposal = this.createProposal({
      title: 'Increase daily budget cap to $500',
      description: 'Proposal to raise the agent daily spending limit from $100 to $500 to accommodate token launch activities.',
      proposer: 'governance-admin',
      type: 'budget_adjustment',
      payload: { currentCap: 100, proposedCap: 500, reason: 'token launch activities' },
      durationMs: 3_600_000,
      quorumRequired: 3,
      approvalThreshold: 60,
    });

    this.castVote(proposal.id, 'governance-admin', 'yes', 'Required for token launches');
    this.castVote(proposal.id, 'risk-engine', 'yes', 'Risk within acceptable bounds');
    this.castVote(proposal.id, 'treasury-guard', 'no', 'Prefer gradual increase');
    this.castVote(proposal.id, 'compliance-officer', 'yes', 'Compliant with policy');
    this.castVote(proposal.id, 'community-rep', 'abstain');

    const result = this.tallyVotes(proposal.id)!;
    const execution = this.executeProposal(proposal.id);

    return {
      proposal: this.proposals.get(proposal.id)!,
      result,
      executed: execution.success,
    };
  }
}

export const votingSystem = new VotingSystem();
export default votingSystem;
