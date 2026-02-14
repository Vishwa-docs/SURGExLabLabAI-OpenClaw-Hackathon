// ============================================================
// src/governance/policy-versioning.ts — Policy Version Hashing
// ============================================================
// Provides immutable policy version tracking with hash anchoring.
// Every policy change is recorded with cryptographic proof.
// ============================================================

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface PolicyVersion {
  versionId: string;
  policyId: string;
  version: number;
  contentHash: string;
  previousHash: string;
  content: Record<string, unknown>;
  changedFields: string[];
  author: string;
  reason: string;
  timestamp: number;
  anchorHash: string;          // Simulated on-chain anchor
  anchorTxHash?: string;
}

export interface PolicyChain {
  policyId: string;
  currentVersion: number;
  headHash: string;
  versions: PolicyVersion[];
  createdAt: number;
  lastModified: number;
}

export interface VersionDiff {
  policyId: string;
  fromVersion: number;
  toVersion: number;
  addedFields: string[];
  removedFields: string[];
  changedFields: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

export interface IntegrityReport {
  policyId: string;
  totalVersions: number;
  chainValid: boolean;
  brokenLinks: number;
  tamperedVersions: string[];
  verifiedAt: number;
}

// ---- Policy Versioning ----

export class PolicyVersioning {
  private chains: Map<string, PolicyChain> = new Map();

  // ---- Version Management ----

  recordVersion(params: {
    policyId: string;
    content: Record<string, unknown>;
    author: string;
    reason: string;
  }): PolicyVersion {
    let chain = this.chains.get(params.policyId);

    if (!chain) {
      // First version
      chain = {
        policyId: params.policyId,
        currentVersion: 0,
        headHash: '0'.repeat(64),
        versions: [],
        createdAt: Date.now(),
        lastModified: Date.now(),
      };
      this.chains.set(params.policyId, chain);
    }

    const previousVersion = chain.versions[chain.versions.length - 1];
    const previousHash = previousVersion ? previousVersion.contentHash : '0'.repeat(64);

    // Compute content hash
    const contentString = JSON.stringify(params.content, Object.keys(params.content).sort());
    const contentHash = crypto.createHash('sha256').update(contentString).digest('hex');

    // Detect changed fields
    const changedFields = previousVersion
      ? this.detectChanges(previousVersion.content, params.content)
      : Object.keys(params.content);

    // Anchor hash (includes previous hash for chain integrity)
    const anchorData = `${contentHash}:${previousHash}:${chain.currentVersion + 1}:${Date.now()}`;
    const anchorHash = crypto.createHash('sha256').update(anchorData).digest('hex');
    const anchorTxHash = '0x' + crypto.randomBytes(32).toString('hex');

    const version: PolicyVersion = {
      versionId: uuidv4(),
      policyId: params.policyId,
      version: chain.currentVersion + 1,
      contentHash,
      previousHash,
      content: { ...params.content },
      changedFields,
      author: params.author,
      reason: params.reason,
      timestamp: Date.now(),
      anchorHash,
      anchorTxHash,
    };

    chain.versions.push(version);
    chain.currentVersion = version.version;
    chain.headHash = contentHash;
    chain.lastModified = Date.now();

    logger.info(`[PolicyVersion] ${params.policyId} v${version.version} — ${changedFields.length} field(s) changed by ${params.author}`);
    return version;
  }

  private detectChanges(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

    for (const key of allKeys) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  // ---- Version Comparison ----

  diffVersions(policyId: string, fromVersion: number, toVersion: number): VersionDiff | null {
    const chain = this.chains.get(policyId);
    if (!chain) return null;

    const from = chain.versions.find(v => v.version === fromVersion);
    const to = chain.versions.find(v => v.version === toVersion);
    if (!from || !to) return null;

    const fromKeys = new Set(Object.keys(from.content));
    const toKeys = new Set(Object.keys(to.content));

    const addedFields = [...toKeys].filter(k => !fromKeys.has(k));
    const removedFields = [...fromKeys].filter(k => !toKeys.has(k));
    const changedFields: VersionDiff['changedFields'] = [];

    for (const key of fromKeys) {
      if (toKeys.has(key) && JSON.stringify(from.content[key]) !== JSON.stringify(to.content[key])) {
        changedFields.push({
          field: key,
          oldValue: from.content[key],
          newValue: to.content[key],
        });
      }
    }

    return { policyId, fromVersion, toVersion, addedFields, removedFields, changedFields };
  }

  // ---- Integrity Verification ----

  verifyIntegrity(policyId: string): IntegrityReport {
    const chain = this.chains.get(policyId);
    if (!chain) {
      return { policyId, totalVersions: 0, chainValid: true, brokenLinks: 0, tamperedVersions: [], verifiedAt: Date.now() };
    }

    let brokenLinks = 0;
    const tamperedVersions: string[] = [];

    for (let i = 0; i < chain.versions.length; i++) {
      const version = chain.versions[i];

      // Verify content hash
      const contentString = JSON.stringify(version.content, Object.keys(version.content).sort());
      const expectedHash = crypto.createHash('sha256').update(contentString).digest('hex');

      if (expectedHash !== version.contentHash) {
        tamperedVersions.push(version.versionId);
      }

      // Verify chain link
      if (i > 0) {
        const prevVersion = chain.versions[i - 1];
        if (version.previousHash !== prevVersion.contentHash) {
          brokenLinks++;
        }
      } else {
        if (version.previousHash !== '0'.repeat(64)) {
          brokenLinks++;
        }
      }
    }

    return {
      policyId,
      totalVersions: chain.versions.length,
      chainValid: brokenLinks === 0 && tamperedVersions.length === 0,
      brokenLinks,
      tamperedVersions,
      verifiedAt: Date.now(),
    };
  }

  // ---- Query ----

  getChain(policyId: string): PolicyChain | undefined {
    return this.chains.get(policyId);
  }

  getVersion(policyId: string, version: number): PolicyVersion | undefined {
    const chain = this.chains.get(policyId);
    if (!chain) return undefined;
    return chain.versions.find(v => v.version === version);
  }

  getLatestVersion(policyId: string): PolicyVersion | undefined {
    const chain = this.chains.get(policyId);
    if (!chain || chain.versions.length === 0) return undefined;
    return chain.versions[chain.versions.length - 1];
  }

  listChains(): PolicyChain[] {
    return Array.from(this.chains.values());
  }

  getStats(): {
    totalPolicies: number;
    totalVersions: number;
    avgVersionsPerPolicy: number;
    allChainsValid: boolean;
    lastModified: number;
  } {
    const chains = Array.from(this.chains.values());
    let totalVersions = 0;
    let allValid = true;
    let lastMod = 0;

    for (const chain of chains) {
      totalVersions += chain.versions.length;
      lastMod = Math.max(lastMod, chain.lastModified);
      const report = this.verifyIntegrity(chain.policyId);
      if (!report.chainValid) allValid = false;
    }

    return {
      totalPolicies: chains.length,
      totalVersions,
      avgVersionsPerPolicy: chains.length > 0 ? Math.round(totalVersions / chains.length) : 0,
      allChainsValid: allValid,
      lastModified: lastMod,
    };
  }
}

export const policyVersioning = new PolicyVersioning();
export default policyVersioning;
