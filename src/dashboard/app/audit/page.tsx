'use client';

import { useState, useEffect } from 'react';

// ============================================================
// Audit Log Page — Timeline view of all agent actions
// ============================================================

interface AuditEntry {
  actionId: string;
  agentId: string;
  actionClass: string;
  description: string;
  status: string;
  policyDecision?: { allowed: boolean; reason: string; riskScore: number };
  receipt?: { txHash?: string; explorerUrl?: string };
  timestamp: number;
}

const DEMO_ENTRIES: AuditEntry[] = [
  { actionId: 'act-001', agentId: 'ridhwan-agent-01', actionClass: 'transfer', description: 'Transfer 0.05 ETH to 0xAb3...F12', status: 'executed', policyDecision: { allowed: true, reason: 'All policies passed', riskScore: 15 }, receipt: { txHash: '0x1a2b3c...', explorerUrl: 'https://sepolia.basescan.org/tx/0x1a2b3c' }, timestamp: Date.now() - 120000 },
  { actionId: 'act-002', agentId: 'ridhwan-agent-01', actionClass: 'token_launch', description: 'Launch token RDWN with 1M supply', status: 'rejected', policyDecision: { allowed: false, reason: 'Action class "token_launch" requires human approval', riskScore: 75 }, timestamp: Date.now() - 300000 },
  { actionId: 'act-003', agentId: 'ridhwan-agent-01', actionClass: 'moltbook_post', description: '🔥 Ridhwan Daily Build Update — 2026-02-26', status: 'executed', policyDecision: { allowed: true, reason: 'All policies passed', riskScore: 5 }, timestamp: Date.now() - 600000 },
  { actionId: 'act-004', agentId: 'ridhwan-agent-01', actionClass: 'swap', description: 'Swap 0.1 ETH for USDC on Uniswap', status: 'executed', policyDecision: { allowed: true, reason: 'All policies passed', riskScore: 22 }, timestamp: Date.now() - 900000 },
  { actionId: 'act-005', agentId: 'ridhwan-agent-01', actionClass: 'transfer', description: 'Transfer 500 USDC to 0x00...dead', status: 'rejected', policyDecision: { allowed: false, reason: 'Address 0x00...dead is on the denylist', riskScore: 100 }, timestamp: Date.now() - 1200000 },
  { actionId: 'act-006', agentId: 'ridhwan-agent-01', actionClass: 'moltbook_post', description: '🔥 Ridhwan Daily Build Update — 2026-02-25', status: 'executed', policyDecision: { allowed: true, reason: 'All policies passed', riskScore: 5 }, timestamp: Date.now() - 86400000 },
  { actionId: 'act-007', agentId: 'ridhwan-agent-01', actionClass: 'payment', description: 'Pay 0.02 ETH for API access', status: 'executed', policyDecision: { allowed: true, reason: 'All policies passed', riskScore: 10 }, receipt: { txHash: '0x7f8e9d...', explorerUrl: 'https://sepolia.basescan.org/tx/0x7f8e9d' }, timestamp: Date.now() - 1800000 },
  { actionId: 'act-008', agentId: 'ridhwan-agent-01', actionClass: 'ownership_renounce', description: 'Renounce ownership of contract 0xDe4...', status: 'rejected', policyDecision: { allowed: false, reason: 'Action class "ownership_renounce" is explicitly blocked', riskScore: 100 }, timestamp: Date.now() - 3600000 },
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>(DEMO_ENTRIES);
  const [filter, setFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/audit?limit=100')
      .then(res => res.json())
      .then((data: AuditEntry[]) => { if (Array.isArray(data) && data.length > 0) setEntries(data); })
      .catch(() => {});
  }, []);

  const filtered = filter === 'all'
    ? entries
    : filter === 'blocked'
      ? entries.filter(e => e.status === 'rejected')
      : entries.filter(e => e.actionClass === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of all agent actions, policy decisions, and receipts</p>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '8px' }}>{entries.length} entries</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['all', 'blocked', 'transfer', 'payment', 'swap', 'token_launch', 'moltbook_post'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '📋 All' : f === 'blocked' ? '🚫 Blocked' : f === 'moltbook_post' ? '📝 Moltbook' : f}
          </button>
        ))}
      </div>

      {/* Split view: Timeline + Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedEntry ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Timeline */}
        <div className="card">
          <div className="timeline">
            {filtered.map(entry => (
              <div
                key={entry.actionId}
                className="timeline-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedEntry(entry)}
              >
                <div className={`timeline-dot ${entry.status === 'executed' ? 'success' : 'danger'}`} />
                <div className="timeline-header">
                  <span className="timeline-title">
                    <span className={`badge ${entry.status === 'executed' ? 'badge-success' : 'badge-danger'}`} style={{ marginRight: '8px' }}>
                      {entry.status}
                    </span>
                    {entry.description}
                  </span>
                  <span className="timeline-time">{formatTime(entry.timestamp)}</span>
                </div>
                <div className="timeline-body">
                  <span className="badge badge-info" style={{ marginRight: '6px' }}>{entry.actionClass}</span>
                  {entry.policyDecision && (
                    <span style={{ fontSize: '12px' }}>
                      Risk: {entry.policyDecision.riskScore} · {entry.policyDecision.reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedEntry && (
          <div className="card" style={{ position: 'sticky', top: '32px', alignSelf: 'start' }}>
            <div className="card-header">
              <h2 className="card-title">Action Detail</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEntry(null)}>✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="stat-label">Action ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{selectedEntry.actionId}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="stat-label">Type</div>
              <span className="badge badge-info">{selectedEntry.actionClass}</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="stat-label">Description</div>
              <div>{selectedEntry.description}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="stat-label">Status</div>
              <span className={`badge ${selectedEntry.status === 'executed' ? 'badge-success' : 'badge-danger'}`}>
                {selectedEntry.status}
              </span>
            </div>

            {selectedEntry.policyDecision && (
              <div style={{ marginBottom: '16px' }}>
                <div className="stat-label">Policy Decision</div>
                <div style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '12px', marginTop: '4px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>{selectedEntry.policyDecision.allowed ? '✅ Allowed' : '🚫 Denied'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {selectedEntry.policyDecision.reason}
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Risk Score: </span>
                    <strong style={{ color: selectedEntry.policyDecision.riskScore > 60 ? 'var(--danger)' : selectedEntry.policyDecision.riskScore > 30 ? 'var(--warning)' : 'var(--success)' }}>
                      {selectedEntry.policyDecision.riskScore}
                    </strong>
                  </div>
                  <div className="risk-bar" style={{ marginTop: '6px' }}>
                    <div
                      className={`risk-bar-fill ${selectedEntry.policyDecision.riskScore > 60 ? 'high' : selectedEntry.policyDecision.riskScore > 30 ? 'medium' : 'low'}`}
                      style={{ width: `${selectedEntry.policyDecision.riskScore}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedEntry.receipt?.txHash && (
              <div style={{ marginBottom: '16px' }}>
                <div className="stat-label">Transaction</div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', marginBottom: '4px' }}>{selectedEntry.receipt.txHash}</div>
                {selectedEntry.receipt.explorerUrl && (
                  <a href={selectedEntry.receipt.explorerUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    View on Explorer →
                  </a>
                )}
              </div>
            )}

            <div>
              <div className="stat-label">Timestamp</div>
              <div style={{ fontSize: '13px' }}>{new Date(selectedEntry.timestamp).toLocaleString()}</div>
            </div>

            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>Raw JSON</summary>
              <div className="json-viewer" style={{ marginTop: '8px' }}>
                {JSON.stringify(selectedEntry, null, 2)}
              </div>
            </details>
          </div>
        )}
      </div>
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
