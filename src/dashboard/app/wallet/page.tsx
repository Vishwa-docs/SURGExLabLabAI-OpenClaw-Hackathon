'use client';

import { useState, useEffect } from 'react';

// ============================================================
// Wallet Page — SURGE wallet overview
// ============================================================

interface WalletInfo {
  address: string;
  balance: string;
  network: string;
}

interface BudgetUsage {
  dailySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  allTimeSpend: number;
}

const DEMO_WALLET: WalletInfo = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4c79',
  balance: '0.847',
  network: 'base-sepolia',
};

const DEMO_BUDGET: BudgetUsage = {
  dailySpend: 42.50,
  weeklySpend: 187.30,
  monthlySpend: 623.00,
  allTimeSpend: 1847.50,
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletInfo>(DEMO_WALLET);
  const [budget, setBudget] = useState<BudgetUsage>(DEMO_BUDGET);

  useEffect(() => {
    fetch('http://localhost:3000/api/wallet')
      .then(res => res.json())
      .then((data: WalletInfo) => { if (data.address) setWallet(data); })
      .catch(() => {});
    fetch('http://localhost:3000/api/budget')
      .then(res => res.json())
      .then((data: BudgetUsage) => { if (typeof data.dailySpend === 'number') setBudget(data); })
      .catch(() => {});
  }, []);

  const budgetLimits = { daily: 500, weekly: 2000, monthly: 5000 };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallet & Treasury</h1>
          <p className="page-subtitle">SURGE wallet status and budget tracking</p>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 className="card-title" style={{ marginBottom: '16px' }}>💰 SURGE Wallet</h2>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div>
            <div className="stat-label">Address</div>
            <div style={{ fontFamily: 'monospace', fontSize: '14px', wordBreak: 'break-all' }}>{wallet.address}</div>
          </div>
          <div>
            <div className="stat-label">Balance</div>
            <div className="stat-value accent">{wallet.balance} ETH</div>
          </div>
          <div>
            <div className="stat-label">Network</div>
            <div className="stat-value" style={{ fontSize: '18px' }}>{wallet.network}</div>
          </div>
        </div>
      </div>

      {/* Budget Usage */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '16px' }}>📊 Budget Usage</h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          <BudgetBar label="Daily" spent={budget.dailySpend} limit={budgetLimits.daily} />
          <BudgetBar label="Weekly" spent={budget.weeklySpend} limit={budgetLimits.weekly} />
          <BudgetBar label="Monthly" spent={budget.monthlySpend} limit={budgetLimits.monthly} />
        </div>
        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
          <div className="stat-label">All-Time Spend</div>
          <div className="stat-value" style={{ fontSize: '24px' }}>${budget.allTimeSpend.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

function BudgetBar({ label, spent, limit }: { label: string; spent: number; limit: number }) {
  const pct = Math.min((spent / limit) * 100, 100);
  const level = pct > 80 ? 'high' : pct > 50 ? 'medium' : 'low';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          ${spent.toFixed(2)} / ${limit.toFixed(2)}
        </span>
      </div>
      <div className="risk-bar" style={{ height: '12px' }}>
        <div className={`risk-bar-fill ${level}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
