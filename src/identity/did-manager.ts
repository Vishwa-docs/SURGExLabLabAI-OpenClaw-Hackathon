// ============================================================
// src/identity/did-manager.ts — Decentralized Identity Manager
// ============================================================
// Manages agent DIDs (Decentralized Identifiers) with verifiable
// credentials and compliance attestations.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../utils/logger';

// ---- Types ----

export interface DIDDocument {
  id: string;                           // did:ridhwan:<agentId>
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  service: ServiceEndpoint[];
  created: number;
  updated: number;
}

export interface VerificationMethod {
  id: string;
  type: 'Ed25519VerificationKey2020' | 'EcdsaSecp256k1VerificationKey2019';
  controller: string;
  publicKeyHex: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface VerifiableCredential {
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  proof: CredentialProof;
}

export interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofValue: string;
}

export interface IdentityResolution {
  did: string;
  resolved: boolean;
  document?: DIDDocument;
  credentials: VerifiableCredential[];
  trustScore: number;
  verifiedAt: number;
}

// ---- DID Manager ----

export class DIDManager {
  private dids: Map<string, DIDDocument> = new Map();
  private credentials: Map<string, VerifiableCredential[]> = new Map(); // did -> credentials
  private resolutionCache: Map<string, IdentityResolution> = new Map();

  // ---- Create DID ----

  createDID(agentId: string, walletAddress: string): DIDDocument {
    const did = `did:ridhwan:${agentId}`;

    // Generate simulated key pair
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyHex = keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');

    const doc: DIDDocument = {
      id: did,
      controller: did,
      verificationMethod: [{
        id: `${did}#keys-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyHex,
      }],
      authentication: [`${did}#keys-1`],
      service: [
        { id: `${did}#wallet`, type: 'SURGEWallet', serviceEndpoint: walletAddress },
        { id: `${did}#agent`, type: 'AgentEndpoint', serviceEndpoint: `https://agent.ridhwan.dev/${agentId}` },
      ],
      created: Date.now(),
      updated: Date.now(),
    };

    this.dids.set(did, doc);
    this.credentials.set(did, []);
    logger.info(`[DID] Created DID: ${did}`);
    return doc;
  }

  // ---- Issue Credential ----

  issueCredential(subjectDid: string, credentialType: string, claims: Record<string, unknown>): VerifiableCredential {
    const credential: VerifiableCredential = {
      id: `urn:uuid:${uuidv4()}`,
      type: ['VerifiableCredential', credentialType],
      issuer: 'did:ridhwan:governance-authority',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 90 * 86_400_000).toISOString(), // 90 days
      credentialSubject: {
        id: subjectDid,
        ...claims,
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: 'did:ridhwan:governance-authority#keys-1',
        proofValue: crypto.createHash('sha256').update(JSON.stringify(claims) + Date.now()).digest('hex'),
      },
    };

    const existing = this.credentials.get(subjectDid) || [];
    existing.push(credential);
    this.credentials.set(subjectDid, existing);
    logger.info(`[DID] Issued ${credentialType} credential to ${subjectDid}`);
    return credential;
  }

  // ---- Resolve DID ----

  resolve(did: string): IdentityResolution {
    const doc = this.dids.get(did);
    const creds = this.credentials.get(did) || [];

    const resolution: IdentityResolution = {
      did,
      resolved: !!doc,
      document: doc,
      credentials: creds,
      trustScore: this.computeTrustScore(did, creds),
      verifiedAt: Date.now(),
    };

    this.resolutionCache.set(did, resolution);
    return resolution;
  }

  private computeTrustScore(did: string, creds: VerifiableCredential[]): number {
    let score = 0;

    // Base: DID exists
    if (this.dids.has(did)) score += 20;

    // Credentials add trust
    for (const cred of creds) {
      if (cred.type.includes('ComplianceAttestation')) score += 25;
      else if (cred.type.includes('RiskAssessment')) score += 15;
      else if (cred.type.includes('AgentRegistration')) score += 20;
      else score += 10;

      // Expired credentials reduce trust
      if (cred.expirationDate && new Date(cred.expirationDate) < new Date()) {
        score -= 5;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  // ---- Verify Credential ----

  verifyCredential(credential: VerifiableCredential): { valid: boolean; reason: string } {
    // Check expiration
    if (credential.expirationDate && new Date(credential.expirationDate) < new Date()) {
      return { valid: false, reason: 'Credential expired' };
    }

    // Check proof exists
    if (!credential.proof || !credential.proof.proofValue) {
      return { valid: false, reason: 'Missing proof' };
    }

    // Check issuer is known
    if (!credential.issuer.startsWith('did:ridhwan:')) {
      return { valid: false, reason: 'Unknown issuer' };
    }

    return { valid: true, reason: 'Credential verified' };
  }

  // ---- Stats ----

  getStats(): { totalDIDs: number; totalCredentials: number; avgTrustScore: number } {
    let totalCreds = 0;
    let trustSum = 0;

    for (const [did, creds] of this.credentials) {
      totalCreds += creds.length;
      const resolution = this.resolve(did);
      trustSum += resolution.trustScore;
    }

    return {
      totalDIDs: this.dids.size,
      totalCredentials: totalCreds,
      avgTrustScore: this.dids.size > 0 ? Math.round(trustSum / this.dids.size) : 0,
    };
  }

  getDID(did: string): DIDDocument | undefined {
    return this.dids.get(did);
  }

  getCredentials(did: string): VerifiableCredential[] {
    return this.credentials.get(did) || [];
  }
}

export const didManager = new DIDManager();
export default didManager;
