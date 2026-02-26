'use client';

import { useState, useEffect } from 'react';

// ============================================================
// Receipts Page — JSON receipts with explorer links
// ============================================================

interface Receipt {
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

const DEMO_RECEIPTS: Receipt[] = [
  { actionId: 'act-001', agentId: 'ridhwan-agent-01', actionClass: 'transfer', description: 'Transfer 0.05 ETH to 0xAb3...F12', status: 'success', txHash: '0x1a2b3c4d5e6f...', explorerUrl: 'https://sepolia.basescan.org/tx/0x1a2b3c', gasUsed: '21000', costUsd: 0.12, timestamp: Date.now() - 120000 },
  { actionId: 'act-003', agentId: 'ridhwan-agent-01', actionClass: 'moltbook_post', description: '🔥 Ridhwan Daily Build Update', status: 'success', timestamp: Date.now() - 600000 },
  { actionId: 'act-007', agentId: 'ridhwan-agent-01', actionClass: 'payment', description: 'Pay 0.02 ETH for API access', status: 'success', txHash: '0x7f8e9d...', explorerUrl: 'https://sepolia.basescan.org/tx/0x7f8e9d', gasUsed: '21000', costUsd: 0.04, timestamp: Date.now() - 1800000 },
];

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>(DEMO_RECEIPTS);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/receipts?limit=50')
      .then(res => res.json())
      .then((data: Receipt[]) => { if (Array.isArray(data) && data.length > 0) setReceipts(data); })
      .catch(() => {});
  }, []);

  const formatReceiptJSON = (r: Receipt) => ({
    version: '1.0.0',
    actionId: r.actionId,
    agentId: r.agentId,
    actionClass: r.actionClass,
    description: r.description,
    status: r.status,
    transaction: r.txHash ? {
      hash: r.txHash,
      explorerUrl: r.explorerUrl,
      gasUsed: r.gasUsed,
      costUsd: r.costUsd,
    } : undefined,
    timestamp: r.timestamp,
    generatedAt: Date.now(),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">JSON receipts for all executed actions — includes tx hashes and explorer links</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Action ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Tx Hash</th>
                <th>Cost</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.actionId} onClick={() => setSelectedReceipt(r)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.actionId}</td>
                  <td><span className="badge badge-info">{r.actionClass}</span></td>
                  <td>{r.description}</td>
                  <td><span className={`badge ${r.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                  <td>
                    {r.txHash ? (
                      <a href={r.explorerUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {r.txHash.slice(0, 10)}...
                      </a>
                    ) : '—'}
                  </td>
                  <td>{r.costUsd ? `$${r.costUsd.toFixed(4)}` : '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedReceipt(r); }}>
                      View JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt JSON Modal */}
      {selectedReceipt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setSelectedReceipt(null)}>
          <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="card-title">🧾 Receipt: {selectedReceipt.actionId}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReceipt(null)}>✕</button>
            </div>

            <div className="json-viewer" style={{ maxHeight: '60vh' }}>
              {JSON.stringify(formatReceiptJSON(selectedReceipt), null, 2)}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(formatReceiptJSON(selectedReceipt), null, 2));
                }}
              >
                📋 Copy JSON
              </button>
              {selectedReceipt.explorerUrl && (
                <a href={selectedReceipt.explorerUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  🔗 View on Explorer
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
