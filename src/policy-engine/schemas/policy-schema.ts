// ============================================================
// src/policy-engine/schemas/policy-schema.ts — Policy Schema (Zod)
// ============================================================
// Defines the universal policy schema that governs all agent
// behavior: budget caps, allowlists, action gating, etc.
// ============================================================

import { z } from 'zod';

// ---- Action Classes ----
export const ActionClassEnum = z.enum([
  'payment',
  'transfer',
  'token_launch',
  'ownership_renounce',
  'swap',
  'stake',
  'governance_vote',
  'skill_install',
  'api_call',
  'file_access',
  'moltbook_post',
  'generic',
]);

// ---- Budget Policy ----
export const BudgetPolicySchema = z.object({
  maxPerTransaction: z.number().positive().describe('Max spend per single transaction in USD'),
  maxDaily: z.number().positive().describe('Max daily spend in USD'),
  maxWeekly: z.number().positive().optional().describe('Max weekly spend in USD'),
  maxMonthly: z.number().positive().optional().describe('Max monthly spend in USD'),
  currency: z.string().default('USD'),
});

// ---- Address Allowlist / Denylist ----
export const AddressPolicySchema = z.object({
  allowlist: z.array(z.string()).default([]).describe('Only these addresses are allowed'),
  denylist: z.array(z.string()).default([]).describe('These addresses are always blocked'),
  mode: z.enum(['allowlist', 'denylist', 'both']).default('denylist'),
});

// ---- Action Gating ----
export const ActionGatingSchema = z.object({
  allowedActions: z.array(ActionClassEnum).describe('Actions this agent can perform'),
  blockedActions: z.array(ActionClassEnum).default([]).describe('Actions explicitly blocked'),
  requireApproval: z.array(ActionClassEnum).default([]).describe('Actions requiring human approval'),
});

// ---- Risk Threshold ----
export const RiskThresholdSchema = z.object({
  maxRiskScore: z.number().min(0).max(100).default(70).describe('Actions above this risk score are blocked'),
  warnThreshold: z.number().min(0).max(100).default(50).describe('Actions above this score trigger warnings'),
  autoEscalate: z.boolean().default(true).describe('Auto-escalate high-risk actions to human'),
});

// ---- API Domain Restrictions ----
export const ApiDomainPolicySchema = z.object({
  allowedDomains: z.array(z.string()).default([]).describe('Only these API domains are callable'),
  blockedDomains: z.array(z.string()).default([]).describe('These domains are blocked'),
});

// ---- File Path Restrictions ----
export const FilePathPolicySchema = z.object({
  allowedPaths: z.array(z.string()).default([]).describe('Agent can only access these paths'),
  blockedPaths: z.array(z.string()).default([]).describe('These paths are always blocked'),
});

// ---- Skill Permission Manifest ----
export const SkillPermissionSchema = z.object({
  skillId: z.string(),
  allowed: z.boolean().default(true),
  maxCalls: z.number().positive().optional().describe('Max invocations per day'),
  permissions: z.array(z.string()).default([]).describe('Required permissions'),
});

// ---- Compliance / Jurisdiction ----
export const CompliancePolicySchema = z.object({
  jurisdictions: z.array(z.string()).default(['US']).describe('Active compliance jurisdictions'),
  kycRequired: z.boolean().default(false),
  amlEnabled: z.boolean().default(true),
  sanctionsCheckEnabled: z.boolean().default(true),
});

// ---- Full Policy Document ----
export const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  agentId: z.string().optional().describe('If set, policy applies only to this agent'),
  orgId: z.string().optional().describe('Organization-level policy'),

  budget: BudgetPolicySchema.optional(),
  addresses: AddressPolicySchema.optional(),
  actionGating: ActionGatingSchema.optional(),
  riskThreshold: RiskThresholdSchema.optional(),
  apiDomains: ApiDomainPolicySchema.optional(),
  filePaths: FilePathPolicySchema.optional(),
  skillPermissions: z.array(SkillPermissionSchema).optional(),
  compliance: CompliancePolicySchema.optional(),

  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
});

export type Policy = z.infer<typeof PolicySchema>;
export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;
export type AddressPolicy = z.infer<typeof AddressPolicySchema>;
export type ActionGating = z.infer<typeof ActionGatingSchema>;
export type RiskThreshold = z.infer<typeof RiskThresholdSchema>;

// ---- Default Policy (starter) ----
export const DEFAULT_POLICY: Policy = {
  id: 'default-policy',
  name: 'Ridhwan Default Policy',
  version: '1.0.0',
  description: 'Default safety policy for all agents',
  enabled: true,

  budget: {
    maxPerTransaction: 100,
    maxDaily: 500,
    maxWeekly: 2000,
    maxMonthly: 5000,
    currency: 'USD',
  },

  addresses: {
    allowlist: [],
    denylist: [],
    mode: 'denylist',
  },

  actionGating: {
    allowedActions: [
      'payment', 'transfer', 'swap', 'moltbook_post',
      'api_call', 'generic',
    ],
    blockedActions: ['ownership_renounce'],
    requireApproval: ['token_launch', 'stake'],
  },

  riskThreshold: {
    maxRiskScore: 70,
    warnThreshold: 50,
    autoEscalate: true,
  },

  apiDomains: {
    allowedDomains: [],
    blockedDomains: ['*.torrent.*', '*.onion'],
  },

  filePaths: {
    allowedPaths: [],
    blockedPaths: ['/etc', '/root', '/var'],
  },

  compliance: {
    jurisdictions: ['US'],
    kycRequired: false,
    amlEnabled: true,
    sanctionsCheckEnabled: true,
  },

  createdAt: Date.now(),
  updatedAt: Date.now(),
};
