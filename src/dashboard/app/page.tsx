'use client';

import { useState, useEffect } from 'react';

// ============================================================
// Dashboard Overview Page — Main landing page
// ============================================================

interface AgentStats {
  executed: number;
  blocked: number;
  total: number;
}

interface AuditEntry {
  actionId: string;
  actionClass: string;
  description: string;
  status: string;
  policyDecision?: { riskScore: number; reason: string };
  timestamp: number;
}

// Demo data for when API is not connected
const DEMO_STATS: AgentStats = { executed: 47, blocked: 12, total: 59 };
const DEMO_ENTRIES: AuditEntry[] = [
  { actionId: 'act-001', actionClass: 'transfer', description: 'Transfer 0.05 ETH to 0xAb3...F12', status: 'executed', policyDecision: { riskScore: 15, reason: 'All policies passed' }, timestamp: Date.now() - 120000 },
  { actionId: 'act-002', actionClass: 'token_launch', description: 'Launch token RDWN with 1M supply', status: 'rejected', policyDecision: { riskScore: 75, reason: 'Requires human approval' }, timestamp: Date.now() - 300000 },
  { actionId: 'act-003', actionClass: 'swap', description: 'Swap 0.1 ETH for USDC', status: 'executed', policyDecision: { riskScore: 22, reason: 'All policies passed' }, timestamp: Date.now() - 600000 },
  { actionId: 'act-004', actionClass: 'moltbook_post', description: 'Daily build update posted', status: 'executed', policyDecision: { riskScore: 5, reason: 'All policies passed' }, timestamp: Date.now() - 900000 },
  { actionId: 'act-005', actionClass: 'transfer', description: 'Transfer 500 USDC to 0x00...dead', status: 'rejected', policyDecision: { riskScore: 95, reason: 'Address on denylist' }, timestamp: Date.now() - 1200000 },
  { actionId: 'act-006', actionClass: 'payment', description: 'Pay 0.02 ETH for API access', status: 'executed', policyDecision: { riskScore: 10, reason: 'All policies passed' }, timestamp: Date.now() - 1800000 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<AgentStats>(DEMO_STATS);
  const [entries, setEntries] = useState<AuditEntry[]>(DEMO_ENTRIES);
  const [wallet, setWallet] = useState({ address: '0x742d...4c79', balance: '0.847', network: 'base-sepolia' });

  useEffect(() => {
    // Try to fetch from API, fall back to demo data
    fetch('http://localhost:3000/api/overview')
      .then(res => res.json())
      .then((data: any) => {
        if (data.stats) setStats(data.stats);
        if (data.recentActions) setEntries(data.recentActions);
        if (data.wallet) setWallet(data.wallet);
      })
      .catch(() => { /* use demo data */ });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent Overview</h1>
          <p className="page-subtitle">Ridhwan Governance Dashboard — Real-time agent monitoring</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-success">● RUNNING</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Actions Executed</div>
          <div className="stat-value success">{stats.executed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Actions Blocked</div>
          <div className="stat-value danger">{stats.blocked}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Actions</div>
          <div className="stat-value info">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Block Rate</div>
          <div className="stat-value warning">
            {stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100) : 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Wallet Balance</div>
          <div className="stat-value accent">{wallet.balance} ETH</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Network</div>
          <div className="stat-value" style={{ fontSize: '16px' }}>{wallet.network}</div>
        </div>
      </div>

      {/* Recent Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Agent Actions</h2>
          <a href="/audit" className="btn btn-secondary btn-sm">View All →</a>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Action ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.actionId}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{entry.actionId}</td>
                  <td>
                    <span className="badge badge-info">{entry.actionClass}</span>
                  </td>
                  <td>{entry.description}</td>
                  <td>
                    <span className={`badge ${entry.status === 'executed' ? 'badge-success' : 'badge-danger'}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td>
                    <RiskScore score={entry.policyDecision?.riskScore || 0} />
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatTime(entry.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RiskScore({ score }: { score: number }) {
  const level = score < 30 ? 'low' : score < 60 ? 'medium' : 'high';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="risk-bar" style={{ width: '60px' }}>
        <div className={`risk-bar-fill ${level}`} style={{ width: `${score}%` }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600 }}>{score}</span>
    </div>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
