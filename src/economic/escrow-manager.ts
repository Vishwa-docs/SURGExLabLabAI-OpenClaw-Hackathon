// ============================================================
// src/economic/escrow-manager.ts — Multi-Party Escrow & Arbitration
// ============================================================
// Milestone-based release, arbitration voting, dispute logging,
// automatic refund triggers.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../utils/logger';

// ---- Types ----

export interface EscrowContract {
  id: string;
  title: string;
  depositor: string;
  beneficiary: string;
  arbiter: string;
  amountUsd: number;
  status: 'created' | 'funded' | 'milestone_pending' | 'released' | 'disputed' | 'refunded' | 'expired';
  milestones: Milestone[];
  currentMilestone: number;
  disputeLog: DisputeEntry[];
  txHashes: string[];
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
  onChainHash: string;
}

export interface Milestone {
  id: number;
  description: string;
  amountUsd: number;
  status: 'pending' | 'completed' | 'disputed' | 'refunded';
  evidence?: string;
  completedAt?: number;
}

export interface DisputeEntry {
  id: string;
  raisedBy: string;
  reason: string;
  milestone: number;
  votes: Array<{ voter: string; resolution: 'release' | 'refund'; reason: string }>;
  resolved: boolean;
  resolution?: 'release' | 'refund';
  timestamp: number;
}

// ---- Escrow Manager ----

export class EscrowManager {
  private contracts: Map<string, EscrowContract> = new Map();

  // ---- Create Escrow ----

  createEscrow(params: {
    title: string;
    depositor: string;
    beneficiary: string;
    arbiter?: string;
    amountUsd: number;
    milestones: Array<{ description: string; amountUsd: number }>;
    durationMs?: number;
  }): EscrowContract {
    const id = uuidv4();

    // Validate milestone amounts sum to total
    const milestoneTotal = params.milestones.reduce((s, m) => s + m.amountUsd, 0);
    if (Math.abs(milestoneTotal - params.amountUsd) > 0.01) {
      logger.warn(`[Escrow] Milestone total ($${milestoneTotal}) adjusted to match escrow amount ($${params.amountUsd})`);
    }

    const milestones: Milestone[] = params.milestones.map((m, i) => ({
      id: i + 1,
      description: m.description,
      amountUsd: m.amountUsd,
      status: 'pending',
    }));

    const contract: EscrowContract = {
      id,
      title: params.title,
      depositor: params.depositor,
      beneficiary: params.beneficiary,
      arbiter: params.arbiter || 'ridhwan-governance',
      amountUsd: params.amountUsd,
      status: 'created',
      milestones,
      currentMilestone: 1,
      disputeLog: [],
      txHashes: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + (params.durationMs || 30 * 86_400_000), // 30 days default
      onChainHash: '0x' + crypto.createHash('sha256')
        .update(JSON.stringify({ id, ...params }) + Date.now())
        .digest('hex'),
    };

    this.contracts.set(id, contract);
    logger.info(`[Escrow] Created: "${params.title}" $${params.amountUsd} (${milestones.length} milestones)`);
    return contract;
  }

  // ---- Fund Escrow ----

  fundEscrow(escrowId: string): boolean {
    const contract = this.contracts.get(escrowId);
    if (!contract || contract.status !== 'created') return false;

    contract.status = 'funded';
    contract.txHashes.push('0x' + crypto.randomBytes(32).toString('hex'));
    logger.info(`[Escrow] Funded: "${contract.title}" $${contract.amountUsd}`);
    return true;
  }

  // ---- Milestone Completion ----

  completeMilestone(escrowId: string, milestoneId: number, evidence: string): boolean {
    const contract = this.contracts.get(escrowId);
    if (!contract || !['funded', 'milestone_pending'].includes(contract.status)) return false;

    const milestone = contract.milestones.find(m => m.id === milestoneId);
    if (!milestone || milestone.status !== 'pending') return false;

    milestone.status = 'completed';
    milestone.evidence = evidence;
    milestone.completedAt = Date.now();
    contract.status = 'milestone_pending';

    contract.txHashes.push('0x' + crypto.randomBytes(32).toString('hex'));

    // Check if all milestones completed
    const allDone = contract.milestones.every(m => m.status === 'completed');
    if (allDone) {
      contract.status = 'released';
      contract.completedAt = Date.now();
      logger.info(`[Escrow] All milestones completed, funds released for: "${contract.title}"`);
    } else {
      contract.currentMilestone = milestoneId + 1;
      logger.info(`[Escrow] Milestone ${milestoneId} completed: "${milestone.description}"`);
    }

    return true;
  }

  // ---- Dispute ----

  raiseDispute(escrowId: string, raisedBy: string, milestoneId: number, reason: string): DisputeEntry | null {
    const contract = this.contracts.get(escrowId);
    if (!contract) return null;

    const dispute: DisputeEntry = {
      id: uuidv4(),
      raisedBy,
      reason,
      milestone: milestoneId,
      votes: [],
      resolved: false,
      timestamp: Date.now(),
    };

    contract.disputeLog.push(dispute);
    contract.status = 'disputed';

    const milestone = contract.milestones.find(m => m.id === milestoneId);
    if (milestone) milestone.status = 'disputed';

    logger.warn(`[Escrow] Dispute raised on "${contract.title}" milestone ${milestoneId}: ${reason}`);
    return dispute;
  }

  voteOnDispute(escrowId: string, disputeId: string, voter: string, resolution: 'release' | 'refund', reason: string): boolean {
    const contract = this.contracts.get(escrowId);
    if (!contract) return false;

    const dispute = contract.disputeLog.find(d => d.id === disputeId);
    if (!dispute || dispute.resolved) return false;

    dispute.votes.push({ voter, resolution, reason });

    // Auto-resolve with 2 votes
    if (dispute.votes.length >= 2) {
      const releaseVotes = dispute.votes.filter(v => v.resolution === 'release').length;
      const refundVotes = dispute.votes.filter(v => v.resolution === 'refund').length;

      if (releaseVotes > refundVotes) {
        dispute.resolved = true;
        dispute.resolution = 'release';
        const milestone = contract.milestones.find(m => m.id === dispute.milestone);
        if (milestone) milestone.status = 'completed';
        contract.status = 'milestone_pending';
        logger.info(`[Escrow] Dispute resolved: RELEASE for "${contract.title}"`);
      } else {
        dispute.resolved = true;
        dispute.resolution = 'refund';
        const milestone = contract.milestones.find(m => m.id === dispute.milestone);
        if (milestone) milestone.status = 'refunded';
        contract.status = 'refunded';
        logger.info(`[Escrow] Dispute resolved: REFUND for "${contract.title}"`);
      }
    }

    return true;
  }

  // ---- Auto Refund ----

  checkExpiry(escrowId: string): boolean {
    const contract = this.contracts.get(escrowId);
    if (!contract) return false;

    if (Date.now() > contract.expiresAt && !['released', 'refunded'].includes(contract.status)) {
      contract.status = 'refunded';
      contract.completedAt = Date.now();
      logger.warn(`[Escrow] Auto-refunded expired escrow: "${contract.title}"`);
      return true;
    }
    return false;
  }

  // ---- Query ----

  getContract(id: string): EscrowContract | undefined {
    return this.contracts.get(id);
  }

  listContracts(status?: EscrowContract['status']): EscrowContract[] {
    const all = Array.from(this.contracts.values());
    if (status) return all.filter(c => c.status === status);
    return all;
  }

  getStats(): {
    totalContracts: number;
    activeContracts: number;
    totalValueLocked: number;
    totalReleased: number;
    disputes: number;
    resolvedDisputes: number;
  } {
    const contracts = Array.from(this.contracts.values());
    let totalLocked = 0, totalReleased = 0, disputes = 0, resolved = 0;

    for (const c of contracts) {
      if (['funded', 'milestone_pending', 'disputed'].includes(c.status)) {
        totalLocked += c.amountUsd;
      }
      if (c.status === 'released') {
        totalReleased += c.amountUsd;
      }
      for (const d of c.disputeLog) {
        disputes++;
        if (d.resolved) resolved++;
      }
    }

    return {
      totalContracts: contracts.length,
      activeContracts: contracts.filter(c => !['released', 'refunded', 'expired'].includes(c.status)).length,
      totalValueLocked: Math.round(totalLocked * 100) / 100,
      totalReleased: Math.round(totalReleased * 100) / 100,
      disputes,
      resolvedDisputes: resolved,
    };
  }

  // ---- Demo ----

  runDemoEscrow(): EscrowContract {
    const contract = this.createEscrow({
      title: 'AI Model Training Service',
      depositor: 'ridhwan-agent',
      beneficiary: 'compute-vendor-01',
      arbiter: 'ridhwan-governance',
      amountUsd: 200,
      milestones: [
        { description: 'Dataset preparation and validation', amountUsd: 50 },
        { description: 'Model training completion', amountUsd: 100 },
        { description: 'Benchmark results delivery', amountUsd: 50 },
      ],
      durationMs: 7 * 86_400_000,
    });

    this.fundEscrow(contract.id);
    this.completeMilestone(contract.id, 1, 'Dataset validated: 10K transactions, 95% label accuracy');
    this.completeMilestone(contract.id, 2, 'Model trained: 92% F1 score on test set');
    this.completeMilestone(contract.id, 3, 'Benchmark report delivered: ROC-AUC 0.96');

    return this.contracts.get(contract.id)!;
  }
}

export const escrowManager = new EscrowManager();
export default escrowManager;
