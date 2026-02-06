'use client';

import { useState } from 'react';

// ============================================================
// Policy Editor Page
// ============================================================

interface Policy {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
  budget?: {
    maxPerTransaction: number;
    maxDaily: number;
    maxWeekly?: number;
    maxMonthly?: number;
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

const DEMO_POLICIES: Policy[] = [
  {
    id: 'default-policy',
    name: 'Ridhwan Default Policy',
    version: '1.0.0',
    enabled: true,
    description: 'Default safety policy for all agents',
    budget: { maxPerTransaction: 100, maxDaily: 500, maxWeekly: 2000, maxMonthly: 5000 },
    actionGating: {
      allowedActions: ['payment', 'transfer', 'swap', 'moltbook_post', 'api_call', 'generic'],
      blockedActions: ['ownership_renounce'],
      requireApproval: ['token_launch', 'stake'],
    },
    riskThreshold: { maxRiskScore: 70, warnThreshold: 50, autoEscalate: true },
    addresses: { allowlist: [], denylist: ['0x0000000000000000000000000000000000000000'], mode: 'denylist' },
  },
  {
    id: 'conservative-policy',
    name: 'Conservative Policy',
    version: '1.0.0',
    enabled: false,
    description: 'Strict limits for high-security environments',
    budget: { maxPerTransaction: 10, maxDaily: 50, maxWeekly: 200, maxMonthly: 500 },
    actionGating: {
      allowedActions: ['moltbook_post', 'api_call', 'generic'],
      blockedActions: ['ownership_renounce', 'token_launch', 'stake'],
      requireApproval: ['payment', 'transfer', 'swap'],
    },
    riskThreshold: { maxRiskScore: 40, warnThreshold: 25, autoEscalate: true },
    addresses: { allowlist: [], denylist: [], mode: 'denylist' },
  },
];

const ACTION_CLASSES = [
  'payment', 'transfer', 'token_launch', 'ownership_renounce',
  'swap', 'stake', 'governance_vote', 'skill_install',
  'api_call', 'file_access', 'moltbook_post', 'generic',
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>(DEMO_POLICIES);
  const [selected, setSelected] = useState<Policy | null>(DEMO_POLICIES[0]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Policy | null>(null);

  const handleSelect = (policy: Policy) => {
    setSelected(policy);
    setEditMode(false);
  };

  const handleToggle = (id: string) => {
    setPolicies(prev =>
      prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p)
    );
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, enabled: !prev.enabled } : null);
    }
  };

  const handleEdit = () => {
    if (selected) {
      setEditData(JSON.parse(JSON.stringify(selected)));
      setEditMode(true);
    }
  };

  const handleSave = () => {
    if (editData) {
      setPolicies(prev => prev.map(p => p.id === editData.id ? editData : p));
      setSelected(editData);
      setEditMode(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Policy Manager</h1>
          <p className="page-subtitle">Configure agent behavior policies and enforcement rules</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          const newPolicy: Policy = {
            id: `policy-${Date.now()}`,
            name: 'New Policy',
            version: '1.0.0',
            enabled: false,
            budget: { maxPerTransaction: 100, maxDaily: 500 },
            actionGating: { allowedActions: [], blockedActions: [], requireApproval: [] },
            riskThreshold: { maxRiskScore: 70, warnThreshold: 50, autoEscalate: true },
            addresses: { allowlist: [], denylist: [], mode: 'denylist' },
          };
          setPolicies(prev => [...prev, newPolicy]);
          setSelected(newPolicy);
          setEditData(newPolicy);
          setEditMode(true);
        }}>
          + New Policy
        </button>
      </div>

      <div className="policy-editor">
        {/* Policy List */}
        <div>
          <ul className="policy-list">
            {policies.map(p => (
              <li
                key={p.id}
                className={`policy-list-item ${selected?.id === p.id ? 'active' : ''}`}
                onClick={() => handleSelect(p)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="policy-name">{p.name}</span>
                  <label className="toggle" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={p.enabled} onChange={() => handleToggle(p.id)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="policy-meta">v{p.version} · {p.id}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Policy Detail / Editor */}
        <div>
          {selected && !editMode && (
            <div>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">{selected.name}</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className={`badge ${selected.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {selected.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                    <button className="btn btn-primary btn-sm" onClick={handleEdit}>Edit</button>
                  </div>
                </div>
                {selected.description && <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{selected.description}</p>}

                {/* Budget */}
                {selected.budget && (
                  <div className="card" style={{ marginBottom: '16px' }}>
                    <h3 className="card-title" style={{ marginBottom: '12px' }}>💰 Budget Caps</h3>
                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Per Transaction</span><br /><strong>${selected.budget.maxPerTransaction}</strong></div>
                      <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Daily Limit</span><br /><strong>${selected.budget.maxDaily}</strong></div>
                      <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Weekly Limit</span><br /><strong>${selected.budget.maxWeekly || '—'}</strong></div>
                      <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly Limit</span><br /><strong>${selected.budget.maxMonthly || '—'}</strong></div>
                    </div>
                  </div>
                )}

                {/* Action Gating */}
                {selected.actionGating && (
                  <div className="card" style={{ marginBottom: '16px' }}>
                    <h3 className="card-title" style={{ marginBottom: '12px' }}>🚦 Action Gating</h3>
                    <div>
                      <strong style={{ fontSize: '12px' }}>Allowed:</strong>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', marginBottom: '8px' }}>
                        {selected.actionGating.allowedActions.map(a => <span key={a} className="badge badge-success">{a}</span>)}
                      </div>
                      <strong style={{ fontSize: '12px' }}>Blocked:</strong>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', marginBottom: '8px' }}>
                        {selected.actionGating.blockedActions.map(a => <span key={a} className="badge badge-danger">{a}</span>)}
                      </div>
                      <strong style={{ fontSize: '12px' }}>Require Approval:</strong>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {selected.actionGating.requireApproval.map(a => <span key={a} className="badge badge-warning">{a}</span>)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Risk Threshold */}
                {selected.riskThreshold && (
                  <div className="card" style={{ marginBottom: '16px' }}>
                    <h3 className="card-title" style={{ marginBottom: '12px' }}>⚠️ Risk Thresholds</h3>
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Max Risk Score: </span>
                        <strong>{selected.riskThreshold.maxRiskScore}</strong>
                      </div>
                      <div className="risk-bar" style={{ marginBottom: '8px' }}>
                        <div className="risk-bar-fill high" style={{ width: `${selected.riskThreshold.maxRiskScore}%` }} />
                      </div>
                      <div style={{ display: 'flex', gap: '20px' }}>
                        <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Warn At: </span><strong>{selected.riskThreshold.warnThreshold}</strong></div>
                        <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Auto-Escalate: </span><strong>{selected.riskThreshold.autoEscalate ? 'Yes' : 'No'}</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw JSON */}
                <details>
                  <summary style={{ cursor: 'pointer', marginBottom: '8px', color: 'var(--text-secondary)' }}>View Raw JSON</summary>
                  <div className="json-viewer">{JSON.stringify(selected, null, 2)}</div>
                </details>
              </div>
            </div>
          )}

          {/* Edit Mode */}
          {editMode && editData && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Edit Policy</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Policy Name</label>
                <input className="form-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={editData.description || ''} onChange={e => setEditData({ ...editData, description: e.target.value })} />
              </div>

              <h3 style={{ marginTop: '20px', marginBottom: '12px' }}>Budget Caps (USD)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Per Transaction Max</label>
                  <input className="form-input" type="number" value={editData.budget?.maxPerTransaction || 0} onChange={e => setEditData({ ...editData, budget: { ...editData.budget!, maxPerTransaction: Number(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Max</label>
                  <input className="form-input" type="number" value={editData.budget?.maxDaily || 0} onChange={e => setEditData({ ...editData, budget: { ...editData.budget!, maxDaily: Number(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Weekly Max</label>
                  <input className="form-input" type="number" value={editData.budget?.maxWeekly || 0} onChange={e => setEditData({ ...editData, budget: { ...editData.budget!, maxWeekly: Number(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Max</label>
                  <input className="form-input" type="number" value={editData.budget?.maxMonthly || 0} onChange={e => setEditData({ ...editData, budget: { ...editData.budget!, maxMonthly: Number(e.target.value) } })} />
                </div>
              </div>

              <h3 style={{ marginTop: '20px', marginBottom: '12px' }}>Risk Thresholds</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Max Risk Score (0-100)</label>
                  <input className="form-input" type="number" min="0" max="100" value={editData.riskThreshold?.maxRiskScore || 70} onChange={e => setEditData({ ...editData, riskThreshold: { ...editData.riskThreshold!, maxRiskScore: Number(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Warn Threshold</label>
                  <input className="form-input" type="number" min="0" max="100" value={editData.riskThreshold?.warnThreshold || 50} onChange={e => setEditData({ ...editData, riskThreshold: { ...editData.riskThreshold!, warnThreshold: Number(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Auto-Escalate</label>
                  <label className="toggle" style={{ marginTop: '8px' }}>
                    <input type="checkbox" checked={editData.riskThreshold?.autoEscalate ?? true} onChange={e => setEditData({ ...editData, riskThreshold: { ...editData.riskThreshold!, autoEscalate: e.target.checked } })} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              <h3 style={{ marginTop: '20px', marginBottom: '12px' }}>Action Gating</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {ACTION_CLASSES.map(ac => {
                  const isAllowed = editData.actionGating?.allowedActions.includes(ac);
                  const isBlocked = editData.actionGating?.blockedActions.includes(ac);
                  const requiresApproval = editData.actionGating?.requireApproval.includes(ac);
                  return (
                    <div key={ac} style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>{ac}</div>
                      <select
                        className="form-select"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        value={isBlocked ? 'blocked' : requiresApproval ? 'approval' : isAllowed ? 'allowed' : 'none'}
                        onChange={e => {
                          const val = e.target.value;
                          const gating = { ...editData.actionGating! };
                          gating.allowedActions = gating.allowedActions.filter(a => a !== ac);
                          gating.blockedActions = gating.blockedActions.filter(a => a !== ac);
                          gating.requireApproval = gating.requireApproval.filter(a => a !== ac);
                          if (val === 'allowed') gating.allowedActions.push(ac);
                          if (val === 'blocked') gating.blockedActions.push(ac);
                          if (val === 'approval') gating.requireApproval.push(ac);
                          setEditData({ ...editData, actionGating: gating });
                        }}
                      >
                        <option value="none">—</option>
                        <option value="allowed">✅ Allowed</option>
                        <option value="blocked">🚫 Blocked</option>
                        <option value="approval">⏳ Needs Approval</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <h3 style={{ marginTop: '20px', marginBottom: '12px' }}>Address Denylist</h3>
              <div className="form-group">
                <label className="form-label">Denied Addresses (one per line)</label>
                <textarea
                  className="form-textarea"
                  value={(editData.addresses?.denylist || []).join('\n')}
                  onChange={e => setEditData({
                    ...editData,
                    addresses: { ...editData.addresses!, denylist: e.target.value.split('\n').filter(Boolean) }
                  })}
                  placeholder="0x000...&#10;0xabc..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
