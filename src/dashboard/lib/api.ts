// ============================================================
// src/dashboard/lib/api.ts — API client for backend
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---- API Methods ----

export const api = {
  // Dashboard overview
  getOverview: () => fetchApi<DashboardOverview>('/overview'),

  // Policies
  getPolicies: () => fetchApi<PolicySummary[]>('/policies'),
  getPolicy: (id: string) => fetchApi<PolicyDetail>(`/policies/${id}`),
  updatePolicy: (id: string, data: Partial<PolicyDetail>) =>
    fetchApi<PolicyDetail>(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  togglePolicy: (id: string, enabled: boolean) =>
    fetchApi<void>(`/policies/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  // Audit log
  getAuditLog: (limit?: number) =>
    fetchApi<AuditEntry[]>(`/audit?limit=${limit || 50}`),

  // Wallet
  getWalletInfo: () => fetchApi<WalletInfo>('/wallet'),

  // Receipts
  getReceipts: (limit?: number) =>
    fetchApi<Receipt[]>(`/receipts?limit=${limit || 50}`),
  getReceipt: (actionId: string) => fetchApi<Receipt>(`/receipts/${actionId}`),

  // Budget
  getBudgetUsage: () => fetchApi<BudgetUsage>('/budget'),
};

// ---- Types ----

export interface DashboardOverview {
  agent: { id: string; name: string; status: string };
  wallet: { address: string; balance: string; network: string };
  stats: { executed: number; blocked: number; total: number };
  budget: BudgetUsage;
  recentActions: AuditEntry[];
}

export interface PolicySummary {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  hash: string;
  updatedAt: number;
}

export interface PolicyDetail {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  budget?: {
    maxPerTransaction: number;
    maxDaily: number;
    maxWeekly?: number;
    maxMonthly?: number;
    currency: string;
  };
  actionGating?: {
    allowedActions: string[];
    blockedActions: string[];
    requireApproval: string[];
  };
  riskThreshold?: {
    maxRiskScore: number;
    warnThreshold: number;
    autoEscalate: boolean;
  };
  addresses?: {
    allowlist: string[];
    denylist: string[];
    mode: string;
  };
}

export interface AuditEntry {
  actionId: string;
  agentId: string;
  actionClass: string;
  description: string;
  status: string;
  policyDecision?: {
    allowed: boolean;
    reason: string;
    riskScore: number;
  };
  receipt?: {
    txHash?: string;
    explorerUrl?: string;
  };
  timestamp: number;
}

export interface WalletInfo {
  address: string;
  balance: string;
  network: string;
}

export interface Receipt {
  actionId: string;
  agentId: string;
  actionClass: string;
  description: string;
  status: string;
  txHash?: string;
  explorerUrl?: string;
  gasUsed?: string;
  costUsd?: number;
  timestamp: number;
}

export interface BudgetUsage {
  dailySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  allTimeSpend: number;
}
