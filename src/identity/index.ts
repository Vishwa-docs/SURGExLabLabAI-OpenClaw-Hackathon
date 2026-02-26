// ============================================================
// src/identity/index.ts — Identity module re-exports
// ============================================================

export { didManager, DIDManager } from './did-manager';
export type { DIDDocument, VerifiableCredential, IdentityResolution } from './did-manager';

export { agentRegistry, AgentRegistry } from './agent-registry';
export type { RegisteredAgent, TrustLookupResult } from './agent-registry';

export { zkPrivacy, ZKPrivacy } from './zk-privacy';
export type { ZKProof, PrivateAuditEntry, PrivacyConfig } from './zk-privacy';
