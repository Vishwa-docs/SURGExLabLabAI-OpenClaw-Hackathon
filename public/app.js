// ============================================================
// RIDHWAN — Enterprise Trust & Commerce Mesh Dashboard
// app.js — Full Dashboard Controller
// ============================================================
// Connects the 1,800-line CSS shell to 100+ backend API endpoints.
// DEMO MODE: Toggle between realistic dummy data and live backend.
// ============================================================

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  let DEMO_MODE = true; // Start in demo mode for presentations
  let currentSection = 'overview';
  let eventSource = null;
  let charts = {};
  let refreshTimers = {};
  const _lastLoad = {};
  const CACHE_TTL = 30000; // 30s cache for API calls
  const API_BASE = '';

  // ── Utility Helpers ─────────────────────────────────────────
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }
  function fmt(n, d = 0) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function fmtUsd(n) { return '$' + fmt(n, 2); }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%'; }
  function fmtShort(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + fmt(n, 2);
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function timestamp(ts) {
    return new Date(ts || Date.now()).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  function fullTimestamp(ts) {
    return new Date(ts || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function riskColor(score) {
    if (score <= 25) return 'var(--green)';
    if (score <= 50) return 'var(--blue)';
    if (score <= 75) return 'var(--amber)';
    return 'var(--red)';
  }
  function riskLabel(score) {
    if (score <= 25) return 'LOW';
    if (score <= 50) return 'MODERATE';
    if (score <= 75) return 'HIGH';
    return 'CRITICAL';
  }
  function badgeHtml(text, color) {
    const bg = `var(--${color}-ghost)`;
    const fg = `var(--${color}-light)`;
    return `<span class="badge" style="background:${bg};color:${fg}">${text}</span>`;
  }
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }

  // ── API Fetch Wrapper ───────────────────────────────────────
  async function api(endpoint, opts = {}) {
    try {
      const res = await fetch(API_BASE + endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.warn(`API call failed: ${endpoint}`, err.message);
      return null;
    }
  }

  // ── Toast Notifications ─────────────────────────────────────
  function toast(msg, type = 'info') {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    const colors = { info: 'var(--blue)', success: 'var(--green)', warning: 'var(--amber)', error: 'var(--red)' };
    el.style.background = colors[type] || colors.info;
    el.textContent = msg;
    container.appendChild(el);
    el.addEventListener('click', () => el.remove());
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
  }

  // ============================================================
  //  DEMO DATA — Rich, Realistic Dummy Data for Presentations
  // ============================================================
  const DEMO = {
    overview: {
      agent: { id: 'ridhwan-prime-001', name: 'RIDHWAN Prime', status: 'running' },
      wallet: { address: '0x7a3B...f92E', balance: '2.4731', network: 'base-sepolia' },
      stats: {
        totalActions: 1847,
        allowed: 1623,
        blocked: 189,
        held: 35,
        executionRate: 87.9,
        avgRiskScore: 22.4,
        totalValueProcessed: 847293.50,
      },
      budget: {
        dailyUsed: 142.50,
        dailyLimit: 500,
        weeklyUsed: 823.40,
        weeklyLimit: 2000,
        monthlyUsed: 3247.80,
        monthlyLimit: 10000,
      },
      recentActions: [
        { actionId: 'act-001', agentId: 'ridhwan-prime-001', actionClass: 'transfer', description: 'ETH transfer to vendor-alpha', status: 'executed', riskScore: 12, timestamp: Date.now() - 120000 },
        { actionId: 'act-002', agentId: 'ridhwan-prime-001', actionClass: 'token_launch', description: 'Token $MESH deployment on Base', status: 'executed', riskScore: 34, timestamp: Date.now() - 360000 },
        { actionId: 'act-003', agentId: 'ridhwan-prime-001', actionClass: 'swap', description: 'DEX swap USDC→ETH via Uniswap', status: 'executed', riskScore: 18, timestamp: Date.now() - 600000 },
        { actionId: 'act-004', agentId: 'ridhwan-prime-001', actionClass: 'transfer', description: 'Large transfer to unverified address', status: 'held', riskScore: 72, timestamp: Date.now() - 900000 },
        { actionId: 'act-005', agentId: 'ridhwan-prime-001', actionClass: 'api_call', description: 'External API call to sanctioned domain', status: 'blocked', riskScore: 95, timestamp: Date.now() - 1200000 },
        { actionId: 'act-006', agentId: 'ridhwan-prime-001', actionClass: 'stake', description: 'ETH restaking via EigenLayer', status: 'executed', riskScore: 28, timestamp: Date.now() - 1500000 },
        { actionId: 'act-007', agentId: 'ridhwan-prime-001', actionClass: 'governance', description: 'Voted on Policy Proposal #12', status: 'executed', riskScore: 5, timestamp: Date.now() - 1800000 },
        { actionId: 'act-008', agentId: 'ridhwan-prime-001', actionClass: 'transfer', description: 'Revenue share payout to creator-beta', status: 'executed', riskScore: 15, timestamp: Date.now() - 2200000 },
      ],
      moltbook: { postCount: 47, postedToday: true, history: [
        { title: 'Daily Trust Report — Feb 27', timestamp: Date.now() - 86400000 },
        { title: 'Governance Digest — Policy Updates', timestamp: Date.now() - 172800000 },
        { title: 'Market Intelligence Brief', timestamp: Date.now() - 259200000 },
      ]},
    },

    policies: [
      { id: 'pol-action-gate', name: 'Action Gating', description: 'Controls which action classes (transfer, swap, stake, token_launch) are permitted. Unauthorized action classes are immediately rejected.', enabled: true, layer: 1, actionType: 'gate', rules: { allowedClasses: ['transfer', 'swap', 'stake', 'token_launch', 'governance', 'api_call'], deniedClasses: ['self_destruct', 'arbitrary_call'] }, updatedAt: Date.now() - 86400000 },
      { id: 'pol-budget-cap', name: 'Budget Caps', description: 'Enforces per-transaction, daily, weekly, and monthly spending limits. Prevents runaway agent spending through hard financial guardrails.', enabled: true, layer: 2, actionType: 'budget', rules: { maxPerTx: 500, dailyLimit: 2000, weeklyLimit: 5000, monthlyLimit: 15000, currency: 'USD' }, updatedAt: Date.now() - 172800000 },
      { id: 'pol-address-acl', name: 'Address Allow/Deny Lists', description: 'Maintains curated allowlists and blocklists for destination addresses. Blocks known malicious, sanctioned, or high-risk addresses.', enabled: true, layer: 3, actionType: 'acl', rules: { allowlist: ['0x7a3B...f92E', '0x4c2D...a81F'], denylist: ['0xDEAD...0000'], mode: 'allowlist_preferred' }, updatedAt: Date.now() - 259200000 },
      { id: 'pol-risk-thresh', name: 'Risk Threshold', description: 'GNN-powered risk scoring with configurable thresholds. Actions above holdThreshold enter HOLD queue for human review; above blockThreshold are auto-rejected.', enabled: true, layer: 4, actionType: 'risk', rules: { holdThreshold: 65, blockThreshold: 85, gnnConfidenceMin: 0.7, fraudCheckEnabled: true }, updatedAt: Date.now() - 345600000 },
      { id: 'pol-api-domain', name: 'API Domain Validation', description: 'Validates external API calls against approved domain registry. Prevents data exfiltration and unauthorized external communications.', enabled: true, layer: 5, actionType: 'domain', rules: { allowedDomains: ['api.surge.dev', 'api.coingecko.com', 'yields.llama.fi', 'base-sepolia.g.alchemy.com'], blockPrivateIPs: true }, updatedAt: Date.now() - 432000000 },
    ],

    risk: {
      dashboard: {
        overallRisk: 22,
        riskTrend: 'stable',
        assessmentsToday: 342,
        threatsBlocked: 12,
        fraudAlerts: 3,
        complianceScore: 94.2,
      },
      signals: [
        { name: 'Transaction Velocity', value: 18, max: 100, color: 'green' },
        { name: 'Value Concentration', value: 34, max: 100, color: 'blue' },
        { name: 'Address Entropy', value: 12, max: 100, color: 'green' },
        { name: 'Time Pattern Anomaly', value: 45, max: 100, color: 'amber' },
        { name: 'Cross-chain Activity', value: 28, max: 100, color: 'blue' },
        { name: 'Smart Contract Risk', value: 15, max: 100, color: 'green' },
      ],
      fraudNodes: [
        { address: '0x7a3B...f92E', label: 'RIDHWAN Prime', status: 'clean', score: 8 },
        { address: '0x4c2D...a81F', label: 'Vendor Alpha', status: 'clean', score: 12 },
        { address: '0x9f1E...b33C', label: 'DEX Router', status: 'clean', score: 5 },
        { address: '0xB82A...d71F', label: 'Unknown Wallet', status: 'flagged', score: 78 },
        { address: '0x0C3F...e22A', label: 'Mixer Contract', status: 'flagged', score: 92 },
        { address: '0x6D4E...c55B', label: 'Creator Beta', status: 'clean', score: 15 },
      ],
      recentAssessments: [
        { actionId: 'act-001', actionClass: 'transfer', riskScore: 12, verdict: 'ALLOW', timestamp: Date.now() - 60000 },
        { actionId: 'act-004', actionClass: 'transfer', riskScore: 72, verdict: 'HOLD', timestamp: Date.now() - 300000 },
        { actionId: 'act-005', actionClass: 'api_call', riskScore: 95, verdict: 'BLOCK', timestamp: Date.now() - 600000 },
        { actionId: 'act-009', actionClass: 'swap', riskScore: 18, verdict: 'ALLOW', timestamp: Date.now() - 900000 },
        { actionId: 'act-010', actionClass: 'stake', riskScore: 28, verdict: 'ALLOW', timestamp: Date.now() - 1200000 },
      ],
    },

    trading: {
      summary: {
        totalOrders: 234,
        filledOrders: 198,
        openOrders: 12,
        cancelledOrders: 24,
        totalVolume: 1247893.50,
        pnl: 34521.80,
        winRate: 67.3,
        sharpeRatio: 1.84,
        sortinoRatio: 2.31,
        maxDrawdown: -8.4,
      },
      orderbook: {
        symbol: 'ETH/USDC',
        bids: [
          { price: 2647.30, size: 12.5 }, { price: 2646.80, size: 8.3 }, { price: 2646.20, size: 15.7 },
          { price: 2645.50, size: 22.1 }, { price: 2644.90, size: 6.8 }, { price: 2644.10, size: 31.2 },
          { price: 2643.50, size: 18.4 }, { price: 2642.80, size: 9.6 },
        ],
        asks: [
          { price: 2648.10, size: 10.2 }, { price: 2648.70, size: 14.6 }, { price: 2649.30, size: 7.9 },
          { price: 2650.00, size: 25.3 }, { price: 2650.80, size: 11.1 }, { price: 2651.50, size: 19.8 },
          { price: 2652.20, size: 8.5 }, { price: 2653.00, size: 33.7 },
        ],
        spread: 0.80,
        midPrice: 2647.70,
      },
      recentTrades: [
        { id: 't-001', symbol: 'ETH/USDC', side: 'buy', price: 2647.50, quantity: 2.5, total: 6618.75, timestamp: Date.now() - 30000 },
        { id: 't-002', symbol: 'SOL/USDC', side: 'sell', price: 148.20, quantity: 50, total: 7410.00, timestamp: Date.now() - 120000 },
        { id: 't-003', symbol: 'BTC/USDC', side: 'buy', price: 62480.00, quantity: 0.15, total: 9372.00, timestamp: Date.now() - 300000 },
        { id: 't-004', symbol: 'ETH/USDC', side: 'sell', price: 2655.30, quantity: 5.0, total: 13276.50, timestamp: Date.now() - 600000 },
        { id: 't-005', symbol: 'BASE/USDC', side: 'buy', price: 0.0342, quantity: 100000, total: 3420.00, timestamp: Date.now() - 900000 },
      ],
      positions: [
        { symbol: 'ETH/USDC', side: 'long', quantity: 12.5, avgEntry: 2580.40, currentPrice: 2647.70, pnl: 840.75, pnlPct: 2.61 },
        { symbol: 'SOL/USDC', side: 'long', quantity: 200, avgEntry: 138.50, currentPrice: 148.20, pnl: 1940.00, pnlPct: 7.00 },
        { symbol: 'BTC/USDC', side: 'long', quantity: 0.5, avgEntry: 60200.00, currentPrice: 62480.00, pnl: 1140.00, pnlPct: 3.79 },
      ],
      markets: ['ETH/USDC', 'BTC/USDC', 'SOL/USDC', 'BASE/USDC'],
    },

    defi: {
      snapshot: {
        totalTvlMonitored: 2847000000,
        poolsTracked: 847,
        strategiesActive: 3,
        totalAllocated: 45000,
        avgApy: 12.4,
        bestApy: 34.2,
      },
      pools: [
        { protocol: 'Aave V3', chain: 'base', pool: 'USDC Lending', apy: 8.42, tvl: 234000000, risk: 15, category: 'lending' },
        { protocol: 'Uniswap V3', chain: 'base', pool: 'ETH/USDC 0.3%', apy: 24.8, tvl: 89000000, risk: 35, category: 'dex' },
        { protocol: 'Compound V3', chain: 'ethereum', pool: 'USDC Market', apy: 6.12, tvl: 567000000, risk: 12, category: 'lending' },
        { protocol: 'Curve Finance', chain: 'ethereum', pool: '3pool', apy: 4.85, tvl: 1200000000, risk: 10, category: 'stable_swap' },
        { protocol: 'Aerodrome', chain: 'base', pool: 'ETH/USDC Concentrated', apy: 34.2, tvl: 45000000, risk: 42, category: 'dex' },
        { protocol: 'Morpho', chain: 'base', pool: 'WETH Optimizer', apy: 11.3, tvl: 78000000, risk: 22, category: 'optimizer' },
      ],
      strategies: [
        { id: 'str-001', name: 'Conservative Yield', type: 'stable_yield', allocated: 25000, apy: 7.2, risk: 15, allocations: [{ pool: 'USDC Lending (Aave)', pct: 40 }, { pool: 'USDC Market (Compound)', pct: 35 }, { pool: '3pool (Curve)', pct: 25 }] },
        { id: 'str-002', name: 'Balanced Growth', type: 'balanced', allocated: 15000, apy: 16.8, risk: 32, allocations: [{ pool: 'ETH/USDC (Uniswap)', pct: 45 }, { pool: 'WETH Optimizer (Morpho)', pct: 30 }, { pool: 'USDC Lending (Aave)', pct: 25 }] },
        { id: 'str-003', name: 'Aggressive Alpha', type: 'aggressive', allocated: 5000, apy: 28.5, risk: 55, allocations: [{ pool: 'ETH/USDC Concentrated (Aerodrome)', pct: 60 }, { pool: 'ETH/USDC (Uniswap)', pct: 40 }] },
      ],
    },

    governance: {
      proposals: [
        { id: 'prop-001', title: 'Increase Daily Budget Cap to $3,000', description: 'Current $2,000 daily limit restricts high-frequency trading operations. Proposal to raise to $3,000 with enhanced monitoring.', status: 'active', proposer: 'ridhwan-prime-001', type: 'policy_change', votes: { yes: 8, no: 2, abstain: 1 }, quorum: 10, createdAt: Date.now() - 172800000 },
        { id: 'prop-002', title: 'Add Arbitrum to Approved Chain List', description: 'Expand multi-chain support to include Arbitrum One for lower gas fees and access to GMX/Radiant ecosystems.', status: 'active', proposer: 'agent-alpha-003', type: 'infrastructure', votes: { yes: 12, no: 1, abstain: 0 }, quorum: 10, createdAt: Date.now() - 345600000 },
        { id: 'prop-003', title: 'Deploy Insurance Pool with 5% Reserve', description: 'Establish mutual insurance pool funded by 5% of transaction fees to cover smart contract exploit losses.', status: 'passed', proposer: 'ridhwan-prime-001', type: 'economic', votes: { yes: 15, no: 3, abstain: 2 }, quorum: 10, createdAt: Date.now() - 604800000 },
        { id: 'prop-004', title: 'Ban Interaction with Tornado Cash Contracts', description: 'OFAC compliance — block all interactions with sanctioned mixer contracts.', status: 'passed', proposer: 'compliance-agent-001', type: 'compliance', votes: { yes: 18, no: 0, abstain: 1 }, quorum: 10, createdAt: Date.now() - 864000000 },
      ],
      holdQueue: [
        { actionId: 'act-004', description: 'Large transfer ($12,500) to unverified address 0xB82A...d71F', riskScore: 72, heldSince: Date.now() - 900000, requiredApprovals: 2, currentApprovals: 1 },
        { actionId: 'act-011', description: 'Token launch with unusual parameters — high initial buy allocation', riskScore: 68, heldSince: Date.now() - 1800000, requiredApprovals: 2, currentApprovals: 0 },
      ],
      policyVersions: 23,
      activeVoters: 19,
    },

    identity: {
      did: { id: 'did:ridhwan:prime-001', method: 'ridhwan', created: Date.now() - 2592000000, controller: '0x7a3B...f92E', verificationMethods: ['Ed25519VerificationKey2020'], services: ['AgentMCP', 'TrustAttestation', 'ComplianceProof'] },
      credentials: [
        { type: 'AgentTrustCredential', issuer: 'did:ridhwan:registry', level: 'verified', score: 920, issuedAt: Date.now() - 604800000 },
        { type: 'ComplianceCredential', issuer: 'did:ridhwan:compliance', level: 'soc2_compliant', checks: 47, issuedAt: Date.now() - 259200000 },
        { type: 'KYCCredential', issuer: 'did:ridhwan:kyc-provider', level: 'enhanced', issuedAt: Date.now() - 1209600000 },
      ],
      mcpAgents: [
        { id: 'ridhwan-prime-001', name: 'RIDHWAN Prime', status: 'online', capabilities: ['transfer', 'swap', 'trade', 'governance', 'analysis'], trustScore: 92, lastSeen: Date.now() - 5000 },
        { id: 'agent-alpha-003', name: 'Alpha Trader', status: 'online', capabilities: ['trade', 'analysis', 'prediction'], trustScore: 85, lastSeen: Date.now() - 15000 },
        { id: 'vendor-oracle-007', name: 'Price Oracle', status: 'online', capabilities: ['price_feed', 'analysis'], trustScore: 88, lastSeen: Date.now() - 30000 },
        { id: 'compliance-agent-001', name: 'Compliance Bot', status: 'online', capabilities: ['audit', 'compliance', 'kyc'], trustScore: 95, lastSeen: Date.now() - 10000 },
        { id: 'defi-optimizer-002', name: 'Yield Optimizer', status: 'idle', capabilities: ['defi', 'yield', 'rebalance'], trustScore: 78, lastSeen: Date.now() - 120000 },
      ],
      mcpStats: { totalAgents: 5, onlineAgents: 4, totalRequests: 2847, avgLatency: 42 },
    },

    audit: {
      summary: { totalEntries: 1847, complianceScore: 94.2, exportReady: true, lastExport: Date.now() - 604800000, soc2Controls: 47, controlsPassing: 44, controlsWarning: 2, controlsFailing: 1 },
      soc2Checklist: [
        { control: 'CC1.1 — COSO Principle 1', description: 'Integrity and ethical values', status: 'pass', evidence: 'Policy engine enforces ethical constraints on all agent actions' },
        { control: 'CC2.1 — Information Flow', description: 'Relevant quality information communicated', status: 'pass', evidence: 'Full audit ledger with cryptographic hash chain' },
        { control: 'CC3.1 — Risk Assessment', description: 'Risk identification and analysis', status: 'pass', evidence: 'GNN-based fraud engine + multi-signal risk scorer' },
        { control: 'CC5.1 — Control Activities', description: 'Control activities defined and developed', status: 'pass', evidence: '5-layer policy enforcement pipeline' },
        { control: 'CC6.1 — Logical Access', description: 'Logical access security controls', status: 'pass', evidence: 'DID-based identity + ZK privacy proofs' },
        { control: 'CC7.1 — System Operations', description: 'Detection of anomalies', status: 'pass', evidence: 'Real-time SSE event stream + anomaly detection' },
        { control: 'CC8.1 — Change Management', description: 'Changes to infrastructure managed', status: 'warn', evidence: 'Policy versioning with hash chain — rollback not fully automated' },
        { control: 'CC9.1 — Risk Mitigation', description: 'Risk mitigation through controls', status: 'pass', evidence: 'HOLD mechanism + budget caps + address ACLs' },
      ],
      recentEntries: [
        { actionId: 'act-001', actionClass: 'transfer', status: 'executed', riskScore: 12, policyResult: 'ALLOW', hashChain: '0x3f2a...8c1d', timestamp: Date.now() - 120000 },
        { actionId: 'act-002', actionClass: 'token_launch', status: 'executed', riskScore: 34, policyResult: 'ALLOW', hashChain: '0x7b4e...2f9a', timestamp: Date.now() - 360000 },
        { actionId: 'act-004', actionClass: 'transfer', status: 'held', riskScore: 72, policyResult: 'HOLD', hashChain: '0xa1c8...5d3e', timestamp: Date.now() - 900000 },
        { actionId: 'act-005', actionClass: 'api_call', status: 'blocked', riskScore: 95, policyResult: 'BLOCK', hashChain: '0xe5f2...1a7b', timestamp: Date.now() - 1200000 },
      ],
    },

    web3: {
      chains: [
        { name: 'Base', chainId: 8453, status: 'connected', blockHeight: 24847293, gasPrice: '0.012 gwei', color: '#0052FF' },
        { name: 'Ethereum', chainId: 1, status: 'connected', blockHeight: 19847102, gasPrice: '24.3 gwei', color: '#627EEA' },
        { name: 'Arbitrum', chainId: 42161, status: 'monitoring', blockHeight: 187493821, gasPrice: '0.1 gwei', color: '#28A0F0' },
        { name: 'Optimism', chainId: 10, status: 'monitoring', blockHeight: 117293847, gasPrice: '0.003 gwei', color: '#FF0420' },
        { name: 'Polygon', chainId: 137, status: 'monitoring', blockHeight: 54738291, gasPrice: '32 gwei', color: '#8247E5' },
      ],
      contractVerifications: [
        { address: '0x4200...0006', chain: 'base', name: 'WETH', riskScore: 5, vulnerabilities: 0, verified: true, timestamp: Date.now() - 3600000 },
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base', name: 'USDC', riskScore: 3, vulnerabilities: 0, verified: true, timestamp: Date.now() - 7200000 },
        { address: '0xDEAD...beef', chain: 'ethereum', name: 'Suspicious Token', riskScore: 82, vulnerabilities: 4, verified: false, timestamp: Date.now() - 14400000 },
      ],
      stats: { contractsVerified: 127, vulnerabilitiesFound: 23, avgRiskScore: 18, chainsMonitored: 5 },
    },

    trends: {
      overview: {
        btcPrice: 62480.00, btcChange24h: 2.34,
        ethPrice: 2647.70, ethChange24h: 1.87,
        solPrice: 148.20, solChange24h: 5.42,
        totalMarketCap: 2.34e12, marketCapChange: 1.92,
        btcDominance: 52.1,
        fearGreedIndex: 62, fearGreedLabel: 'Greed',
      },
      sectors: [
        { name: 'DeFi', change24h: 3.42, marketCap: 89e9, topToken: 'UNI' },
        { name: 'Layer 2', change24h: 5.18, marketCap: 34e9, topToken: 'ARB' },
        { name: 'AI & Big Data', change24h: 7.23, marketCap: 28e9, topToken: 'FET' },
        { name: 'Meme Coins', change24h: -2.14, marketCap: 56e9, topToken: 'DOGE' },
        { name: 'RWA', change24h: 4.67, marketCap: 12e9, topToken: 'ONDO' },
        { name: 'Infrastructure', change24h: 1.89, marketCap: 67e9, topToken: 'DOT' },
      ],
      anomalies: [
        { type: 'volume_spike', asset: 'SOL', severity: 'medium', description: 'Trading volume 340% above 7-day average', timestamp: Date.now() - 1800000 },
        { type: 'whale_alert', asset: 'ETH', severity: 'high', description: '15,000 ETH moved from exchange to cold wallet', timestamp: Date.now() - 3600000 },
        { type: 'correlation_break', asset: 'BTC/ETH', severity: 'low', description: 'BTC-ETH correlation dropped below 0.5 (unusual)', timestamp: Date.now() - 7200000 },
      ],
    },

    events: [
      { id: 'evt-001', category: 'policy', severity: 'info', message: 'Policy engine evaluated action act-001 → ALLOW (risk: 12)', timestamp: Date.now() - 10000 },
      { id: 'evt-002', category: 'trade', severity: 'info', message: 'Order filled: BUY 2.5 ETH/USDC @ $2,647.50', timestamp: Date.now() - 30000 },
      { id: 'evt-003', category: 'risk', severity: 'warning', message: 'Risk score elevated for address 0xB82A...d71F (score: 78)', timestamp: Date.now() - 60000 },
      { id: 'evt-004', category: 'governance', severity: 'info', message: 'New vote cast on Proposal #1 — yes (8/10 quorum)', timestamp: Date.now() - 120000 },
      { id: 'evt-005', category: 'compliance', severity: 'critical', message: 'Action BLOCKED: API call to sanctioned domain detected', timestamp: Date.now() - 300000 },
      { id: 'evt-006', category: 'system', severity: 'info', message: 'MCP heartbeat — 4 agents online, avg latency 42ms', timestamp: Date.now() - 600000 },
      { id: 'evt-007', category: 'defi', severity: 'info', message: 'DeFi strategy rebalance check — no action needed', timestamp: Date.now() - 900000 },
      { id: 'evt-008', category: 'moltbook', severity: 'info', message: 'Daily trust report posted to Moltbook — 47 total posts', timestamp: Date.now() - 1200000 },
      { id: 'evt-009', category: 'trade', severity: 'info', message: 'Order filled: SELL 50 SOL/USDC @ $148.20', timestamp: Date.now() - 1500000 },
      { id: 'evt-010', category: 'identity', severity: 'info', message: 'DID credential refreshed: AgentTrustCredential (score: 920)', timestamp: Date.now() - 1800000 },
    ],

    actions: {
      summary: {
        totalExecuted: 1623,
        totalBlocked: 189,
        totalHeld: 35,
        pendingHolds: 2,
        avgExecutionTime: 234,
        transferVolume: 423847.50,
        swapVolume: 287493.20,
        lastAction: Date.now() - 120000,
      },
      recentActions: [
        { id: 'act-001', type: 'transfer', description: 'ETH transfer to vendor-alpha', amount: 0.5, currency: 'ETH', usdValue: 1323.85, status: 'executed', riskScore: 12, executionTime: 180, timestamp: Date.now() - 120000 },
        { id: 'act-002', type: 'token_launch', description: 'Token $MESH deployment on Base', amount: 0.1, currency: 'ETH', usdValue: 264.77, status: 'executed', riskScore: 34, executionTime: 450, timestamp: Date.now() - 360000 },
        { id: 'act-003', type: 'swap', description: 'DEX swap USDC→ETH (Uniswap)', amount: 5000, currency: 'USDC', usdValue: 5000, status: 'executed', riskScore: 18, executionTime: 120, timestamp: Date.now() - 600000 },
        { id: 'act-004', type: 'transfer', description: 'Large transfer to 0xB82A...d71F', amount: 12500, currency: 'USDC', usdValue: 12500, status: 'held', riskScore: 72, executionTime: null, timestamp: Date.now() - 900000 },
        { id: 'act-005', type: 'api_call', description: 'POST to sanctioned.domain/api', amount: 0, currency: '-', usdValue: 0, status: 'blocked', riskScore: 95, executionTime: null, timestamp: Date.now() - 1200000 },
      ],
    },

    orchestrator: {
      agents: [
        { id: 'risk-guard', role: 'Risk Assessment', capabilities: ['risk_scan', 'fraud_check', 'address_check'], trustScore: 94, status: 'active', tasksCompleted: 312, avgResponseTime: 45, permissions: ['cap-risk-scan', 'cap-read-balance', 'cap-compliance-audit'], icon: '🛡️' },
        { id: 'policy-bot', role: 'Policy Enforcement', capabilities: ['policy_check', 'governance_vote', 'compliance_verify'], trustScore: 97, status: 'active', tasksCompleted: 547, avgResponseTime: 32, permissions: ['cap-governance-vote', 'cap-compliance-audit', 'cap-moltbook-post'], icon: '📋' },
        { id: 'trade-runner', role: 'Trade Execution', capabilities: ['trade_execute', 'swap', 'liquidity_provision'], trustScore: 89, status: 'active', tasksCompleted: 198, avgResponseTime: 78, permissions: ['cap-trade', 'cap-read-balance', 'cap-x402-pay'], icon: '📈' },
        { id: 'compliance-ai', role: 'Compliance Auditing', capabilities: ['audit_generate', 'soc2_check', 'export_report'], trustScore: 96, status: 'active', tasksCompleted: 423, avgResponseTime: 120, permissions: ['cap-compliance-audit', 'cap-read-balance', 'cap-moltbook-post'], icon: '📑' },
        { id: 'trust-broker', role: 'Trust & Identity', capabilities: ['did_resolve', 'credential_verify', 'trust_score'], trustScore: 91, status: 'active', tasksCompleted: 267, avgResponseTime: 55, permissions: ['cap-risk-scan', 'cap-read-balance', 'cap-x402-pay', 'cap-moltbook-post'], icon: '🔑' },
      ],
      stats: {
        totalTasks: 1747, completedTasks: 1698, failedTasks: 22, avgResponseTime: 66,
        tasksByAgent: { 'risk-guard': 312, 'policy-bot': 547, 'trade-runner': 198, 'compliance-ai': 423, 'trust-broker': 267 },
      },
      recentTasks: [
        { id: 'task-001', type: 'risk_scan', assignedTo: 'risk-guard', status: 'completed', result: 'Score: 12/100 — ALLOW', duration: 42, timestamp: Date.now() - 30000 },
        { id: 'task-002', type: 'policy_check', assignedTo: 'policy-bot', status: 'completed', result: 'All 5 layers passed', duration: 28, timestamp: Date.now() - 60000 },
        { id: 'task-003', type: 'trade_execute', assignedTo: 'trade-runner', status: 'completed', result: 'BUY 2.5 ETH @ $2,647.50', duration: 95, timestamp: Date.now() - 120000 },
        { id: 'task-004', type: 'audit_generate', assignedTo: 'compliance-ai', status: 'completed', result: 'SOC 2 packet generated (47 controls)', duration: 180, timestamp: Date.now() - 240000 },
        { id: 'task-005', type: 'fraud_check', assignedTo: 'risk-guard', status: 'completed', result: 'GNN scan clean — 0 circular flows', duration: 67, timestamp: Date.now() - 360000 },
        { id: 'task-006', type: 'did_resolve', assignedTo: 'trust-broker', status: 'completed', result: 'DID verified: did:ridhwan:prime-001', duration: 38, timestamp: Date.now() - 480000 },
      ],
      pipelines: [
        { name: 'transfer', steps: ['risk-guard → scan', 'policy-bot → check', 'trade-runner → execute', 'compliance-ai → log'], status: 'completed', duration: 345 },
        { name: 'x402_payment', steps: ['trust-broker → verify', 'risk-guard → scan', 'policy-bot → approve', 'trade-runner → pay', 'compliance-ai → receipt'], status: 'completed', duration: 420 },
      ],
    },

    x402: {
      stats: {
        totalRequests: 89, totalPaid: 72, totalRevenue: 247.50, totalSpent: 34.00,
        avgPaymentTime: 1800, resourcesAccessed: 72, rejectedPayments: 8, activeResources: 6,
      },
      resources: [
        { id: 'res-fraud-scan', endpoint: '/api/x402/fraud-scan', description: 'GNN-powered fraud detection scan', price: 2.00, currency: 'USDC', chain: 'base', category: 'security' },
        { id: 'res-risk-report', endpoint: '/api/x402/risk-report', description: 'Full 7-signal risk assessment', price: 1.50, currency: 'USDC', chain: 'base', category: 'risk' },
        { id: 'res-compliance-packet', endpoint: '/api/x402/compliance-packet', description: 'SOC 2 compliance packet', price: 5.00, currency: 'USDC', chain: 'base', category: 'compliance' },
        { id: 'res-contract-verify', endpoint: '/api/x402/contract-verify', description: 'Smart contract security audit', price: 3.00, currency: 'USDC', chain: 'base', category: 'security' },
        { id: 'res-market-intel', endpoint: '/api/x402/market-intel', description: 'Premium market intelligence', price: 0.50, currency: 'USDC', chain: 'base', category: 'analytics' },
        { id: 'res-credit-score', endpoint: '/api/x402/credit-score', description: 'Agent credit score computation', price: 1.00, currency: 'USDC', chain: 'base', category: 'risk' },
      ],
      recentPayments: [
        { id: 'pay-001', resourceId: 'res-fraud-scan', requestingAgent: 'agent-alpha-003', amount: 2.00, status: 'verified', costBenefitScore: 82, txHash: '0x3f2a...8c1d', requestedAt: Date.now() - 120000, resource: { riskScore: 23, flags: 0, analysis: 'No suspicious patterns' } },
        { id: 'pay-002', resourceId: 'res-market-intel', requestingAgent: 'defi-optimizer-002', amount: 0.50, status: 'verified', costBenefitScore: 91, txHash: '0x7b4e...2f9a', requestedAt: Date.now() - 300000, resource: { rsi: 54.2, trend: 'bullish', anomalies: 0 } },
        { id: 'pay-003', resourceId: 'res-compliance-packet', requestingAgent: 'compliance-agent-001', amount: 5.00, status: 'verified', costBenefitScore: 75, txHash: '0xa1c8...5d3e', requestedAt: Date.now() - 600000, resource: { sections: 7, controls: 30, soc2Ready: true } },
        { id: 'pay-004', resourceId: 'res-credit-score', requestingAgent: 'vendor-oracle-007', amount: 1.00, status: 'rejected', costBenefitScore: 35, requestedAt: Date.now() - 900000 },
      ],
    },

    trust: {
      stats: {
        totalCapabilities: 10, totalDelegations: 6, activeDelegations: 6,
        revokedDelegations: 0, totalAgents: 6, avgCapabilitiesPerAgent: 3.5,
      },
      capabilities: [
        { id: 'cap-transfer', name: 'Transfer Funds', riskLevel: 'high', maxDelegationDepth: 1 },
        { id: 'cap-trade', name: 'Execute Trades', riskLevel: 'high', maxDelegationDepth: 1 },
        { id: 'cap-read-balance', name: 'Read Balance', riskLevel: 'low', maxDelegationDepth: 3 },
        { id: 'cap-risk-scan', name: 'Risk Scanning', riskLevel: 'low', maxDelegationDepth: 3 },
        { id: 'cap-contract-deploy', name: 'Deploy Contracts', riskLevel: 'critical', maxDelegationDepth: 0 },
        { id: 'cap-governance-vote', name: 'Governance Vote', riskLevel: 'medium', maxDelegationDepth: 2 },
        { id: 'cap-compliance-audit', name: 'Compliance Audit', riskLevel: 'low', maxDelegationDepth: 3 },
        { id: 'cap-moltbook-post', name: 'Moltbook Post', riskLevel: 'low', maxDelegationDepth: 2 },
        { id: 'cap-agent-spawn', name: 'Spawn Sub-Agent', riskLevel: 'critical', maxDelegationDepth: 0 },
        { id: 'cap-x402-pay', name: 'x402 Payment', riskLevel: 'medium', maxDelegationDepth: 1 },
      ],
      delegations: [
        { id: 'del-001', delegator: 'owner:daver', delegate: 'ridhwan-agent-01', capabilities: ['cap-transfer', 'cap-trade', 'cap-read-balance', 'cap-risk-scan', 'cap-governance-vote', 'cap-compliance-audit', 'cap-moltbook-post', 'cap-x402-pay'], depth: 0, status: 'active', constraints: { maxAmount: 10000, dailyLimit: 50000 } },
        { id: 'del-002', delegator: 'ridhwan-agent-01', delegate: 'risk-guard', capabilities: ['cap-risk-scan', 'cap-read-balance', 'cap-compliance-audit'], depth: 1, status: 'active', constraints: { allowedActions: ['scan', 'assess', 'report'] } },
        { id: 'del-003', delegator: 'ridhwan-agent-01', delegate: 'trade-runner', capabilities: ['cap-trade', 'cap-read-balance', 'cap-x402-pay'], depth: 1, status: 'active', constraints: { maxAmount: 5000, dailyLimit: 25000 } },
        { id: 'del-004', delegator: 'ridhwan-agent-01', delegate: 'policy-bot', capabilities: ['cap-governance-vote', 'cap-compliance-audit', 'cap-moltbook-post'], depth: 1, status: 'active', constraints: {} },
        { id: 'del-005', delegator: 'ridhwan-agent-01', delegate: 'compliance-ai', capabilities: ['cap-compliance-audit', 'cap-read-balance', 'cap-moltbook-post'], depth: 1, status: 'active', constraints: {} },
        { id: 'del-006', delegator: 'ridhwan-agent-01', delegate: 'trust-broker', capabilities: ['cap-risk-scan', 'cap-read-balance', 'cap-x402-pay', 'cap-moltbook-post'], depth: 1, status: 'active', constraints: { maxAmount: 1000 } },
      ],
    },
  };

  // ============================================================
  //  SECTION RENDERERS
  // ============================================================

  // ── Overview ────────────────────────────────────────────────
  async function loadOverview() {
    const data = DEMO_MODE ? DEMO.overview : await api('/api/overview');
    if (!data) return;
    const s = data.stats || {};
    const w = data.wallet || {};
    const b = data.budget || {};
    const container = $('#overview-content');

    container.innerHTML = `
      <!-- Status Bar -->
      <div class="status-bar">
        <span class="status-dot ${data.agent?.status === 'running' ? 'online' : ''}"></span>
        <strong>${data.agent?.name || 'RIDHWAN'}</strong> &mdash;
        Agent <code style="color:var(--accent-light);font-family:var(--font-mono)">${data.agent?.id || '-'}</code> is
        <strong style="color:var(--green-light)">${data.agent?.status || 'unknown'}</strong>
        on <code style="color:var(--cyan);font-family:var(--font-mono)">${w.network || 'base-sepolia'}</code>
      </div>

      <!-- KPI Stat Cards -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${fmt(s.totalActions)}</div>
          <div class="stat-label">Total Actions Processed</div>
          <div class="stat-trend up">↑ ${fmtPct(s.executionRate)} execution rate</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${fmt(s.allowed)}</div>
          <div class="stat-label">Actions Allowed</div>
          <div class="stat-trend up">↑ Policy-compliant</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">🛡️</div>
          <div class="stat-value">${fmt(s.blocked)}</div>
          <div class="stat-label">Actions Blocked</div>
          <div class="stat-trend down">Threats neutralized</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--amber);--stat-glow:var(--amber-ghost)">
          <div class="stat-icon">⏸️</div>
          <div class="stat-value">${fmt(s.held)}</div>
          <div class="stat-label">Actions Held for Review</div>
          <div class="stat-trend up">HOLD gate active</div>
        </div>
      </div>

      <!-- Module Grid -->
      <h3 class="sub-heading">🔧 Active Modules</h3>
      <div class="module-grid">
        <div class="module-tile animate-in"><div class="module-icon">🛡️</div><div class="module-name">Policy Engine</div><div class="module-stat">5 layers</div></div>
        <div class="module-tile animate-in"><div class="module-icon">📊</div><div class="module-name">Risk Scorer</div><div class="module-stat">${s.avgRiskScore?.toFixed(1) || '22.4'}</div></div>
        <div class="module-tile animate-in"><div class="module-icon">🧠</div><div class="module-name">GNN Fraud</div><div class="module-stat">Active</div></div>
        <div class="module-tile animate-in"><div class="module-icon">📈</div><div class="module-name">Trading</div><div class="module-stat">${DEMO_MODE ? '234' : '-'} orders</div></div>
        <div class="module-tile animate-in"><div class="module-icon">🌐</div><div class="module-name">DeFi Agg.</div><div class="module-stat">${DEMO_MODE ? '847' : '-'} pools</div></div>
        <div class="module-tile animate-in"><div class="module-icon">🗳️</div><div class="module-name">Governance</div><div class="module-stat">Active</div></div>
        <div class="module-tile animate-in"><div class="module-icon">🪪</div><div class="module-name">DID/ZK</div><div class="module-stat">Verified</div></div>
        <div class="module-tile animate-in"><div class="module-icon">🔗</div><div class="module-name">MCP Server</div><div class="module-stat">${DEMO_MODE ? '5' : '-'} agents</div></div>
        <div class="module-tile animate-in"><div class="module-icon">💰</div><div class="module-name">Revenue</div><div class="module-stat">70/20/10</div></div>
        <div class="module-tile animate-in"><div class="module-icon">🔒</div><div class="module-name">Escrow</div><div class="module-stat">Active</div></div>
        <div class="module-tile animate-in"><div class="module-icon">📜</div><div class="module-name">Audit</div><div class="module-stat">SOC 2</div></div>
        <div class="module-tile animate-in"><div class="module-icon">⛓️</div><div class="module-name">Multi-Chain</div><div class="module-stat">${DEMO_MODE ? '5' : '-'} chains</div></div>
      </div>

      <!-- Wallet + Budget Row -->
      <div class="chart-row">
        <div class="card animate-in">
          <h3>💳 Wallet</h3>
          <ul class="rule-list">
            <li><strong>Address</strong> <code style="font-family:var(--font-mono);color:var(--accent-light)">${w.address || '-'}</code></li>
            <li><strong>Balance</strong> <span style="color:var(--green-light);font-weight:700">${w.balance || '0'} ETH</span></li>
            <li><strong>Network</strong> ${w.network || 'base-sepolia'}</li>
            <li><strong>Value Processed</strong> ${fmtUsd(s.totalValueProcessed || 0)}</li>
          </ul>
        </div>
        <div class="card animate-in">
          <h3>📊 Budget Utilization</h3>
          ${renderBudgetBars(b)}
        </div>
      </div>

      <!-- Recent Actions Table -->
      <h3 class="sub-heading">⚡ Recent Actions</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Action</th><th>Type</th><th>Description</th><th>Risk</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>
            ${(data.recentActions || []).map(a => `
              <tr>
                <td><code style="font-family:var(--font-mono);font-size:0.75rem">${a.actionId}</code></td>
                <td>${badgeHtml(a.actionClass, 'blue')}</td>
                <td>${a.description}</td>
                <td><span style="color:${riskColor(a.riskScore)};font-weight:700">${a.riskScore}</span></td>
                <td>${statusBadge(a.status)}</td>
                <td class="text-muted" style="font-size:0.78rem">${timeAgo(a.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Moltbook -->
      <h3 class="sub-heading">📘 Moltbook Distribution</h3>
      <div class="metric-row">
        <div class="metric-mini"><div class="metric-label">Total Posts</div><div class="metric-val">${data.moltbook?.postCount || 0}</div></div>
        <div class="metric-mini"><div class="metric-label">Posted Today</div><div class="metric-val" style="color:${data.moltbook?.postedToday ? 'var(--green)' : 'var(--amber)'}">${data.moltbook?.postedToday ? 'Yes ✓' : 'Pending'}</div></div>
      </div>
    `;
    $('#overview-updated').textContent = 'Updated ' + timestamp();
  }

  function renderBudgetBars(b) {
    const bars = [
      { label: 'Daily', used: b.dailyUsed || 0, limit: b.dailyLimit || 500 },
      { label: 'Weekly', used: b.weeklyUsed || 0, limit: b.weeklyLimit || 2000 },
      { label: 'Monthly', used: b.monthlyUsed || 0, limit: b.monthlyLimit || 10000 },
    ];
    return bars.map(bar => {
      const pct = Math.min((bar.used / bar.limit) * 100, 100);
      const color = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--amber)' : 'var(--green)';
      return `
        <div class="signal-bar-container" style="margin-bottom:12px">
          <div class="signal-bar-header">
            <span class="signal-bar-name">${bar.label}</span>
            <span class="signal-bar-value">${fmtUsd(bar.used)} / ${fmtUsd(bar.limit)}</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function statusBadge(status) {
    const map = { executed: 'green', allowed: 'green', blocked: 'red', held: 'amber', pending: 'amber' };
    return badgeHtml(status, map[status] || 'blue');
  }

  // ── Policies ────────────────────────────────────────────────
  async function loadPolicies() {
    const data = DEMO_MODE ? DEMO.policies : await api('/api/policies');
    if (!data) return;
    const container = $('#policies-content');
    container.innerHTML = `
      <div class="cards-grid">
        ${(Array.isArray(data) ? data : []).map(p => `
          <div class="policy-card animate-in">
            <div class="policy-header">
              <div>
                <span style="color:var(--text-tertiary);font-size:0.72rem;font-weight:600">LAYER ${p.layer || '-'}</span>
                <div class="policy-name">${p.name}</div>
              </div>
              <span class="policy-toggle ${p.enabled ? 'enabled' : 'disabled'}">${p.enabled ? '● ENABLED' : '○ DISABLED'}</span>
            </div>
            <p class="policy-desc">${p.description || ''}</p>
            ${p.rules ? `<pre>${syntaxHighlight(p.rules)}</pre>` : ''}
            <div class="policy-meta">
              <span>🔄 Updated ${timeAgo(p.updatedAt)}</span>
              <span>🏷️ ${p.actionType || 'general'}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Actions ─────────────────────────────────────────────────
  async function loadActions() {
    const data = DEMO_MODE ? DEMO.actions : await api('/api/actions/summary');
    if (!data) return;
    const s = data.summary || data;
    const container = $('#actions-content');
    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${fmt(s.totalExecuted)}</div>
          <div class="stat-label">Executed</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">🚫</div>
          <div class="stat-value">${fmt(s.totalBlocked)}</div>
          <div class="stat-label">Blocked</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--amber);--stat-glow:var(--amber-ghost)">
          <div class="stat-icon">⏸️</div>
          <div class="stat-value">${fmt(s.totalHeld)}</div>
          <div class="stat-label">Held</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">${s.avgExecutionTime || '-'}ms</div>
          <div class="stat-label">Avg. Execution Time</div>
        </div>
      </div>

      <h3 class="sub-heading">📋 Recent Agent Actions</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Description</th><th>Value</th><th>Risk</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>
            ${(data.recentActions || DEMO.overview.recentActions).map(a => `
              <tr>
                <td><code style="font-family:var(--font-mono);font-size:0.72rem">${a.id || a.actionId}</code></td>
                <td>${badgeHtml(a.type || a.actionClass, 'blue')}</td>
                <td>${a.description}</td>
                <td style="font-family:var(--font-mono);font-weight:600">${a.usdValue ? fmtUsd(a.usdValue) : '-'}</td>
                <td><span style="color:${riskColor(a.riskScore)};font-weight:700">${a.riskScore}</span></td>
                <td>${statusBadge(a.status)}</td>
                <td class="text-muted" style="font-size:0.75rem">${timeAgo(a.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Action Form -->
      <h3 class="sub-heading">🚀 Execute Transfer</h3>
      <div class="card">
        <div class="form-grid">
          <div class="form-row">
            <label>Recipient Address <input type="text" id="transfer-to" placeholder="0x..." value="0x4c2D...a81F"></label>
            <label>Amount (USD) <input type="number" id="transfer-amount" placeholder="100" value="100"></label>
            <label>Currency
              <select id="transfer-currency">
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </select>
            </label>
          </div>
          <button class="btn btn-primary" onclick="executeTransfer()">⚡ Execute via Policy Engine</button>
        </div>
      </div>
    `;
  }

  // ── Risk & Fraud ────────────────────────────────────────────
  async function loadRisk() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.risk;
    } else {
      const [dashboard, fraudDemo, riskStats] = await Promise.all([
        api('/api/dashboard/snapshot'),
        api('/api/fraud/demo'),
        api('/api/risk/stats'),
      ]);
      data = { dashboard: dashboard || {}, fraudNodes: [], signals: [], recentAssessments: [] };
    }
    const d = data.dashboard || {};
    const container = $('#risk-content');

    container.innerHTML = `
      <!-- Overall Risk Gauge -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:${riskColor(d.overallRisk)};--stat-glow:rgba(0,0,0,0.2)">
          <div class="stat-icon">🎯</div>
          <div class="stat-value" style="color:${riskColor(d.overallRisk)}">${d.overallRisk || 0}</div>
          <div class="stat-label">Overall Risk Score</div>
          <div class="stat-trend ${d.riskTrend === 'stable' ? 'up' : 'down'}">${d.riskTrend || 'stable'}</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">🔍</div>
          <div class="stat-value">${fmt(d.assessmentsToday)}</div>
          <div class="stat-label">Assessments Today</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">${fmt(d.threatsBlocked)}</div>
          <div class="stat-label">Threats Blocked</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${d.complianceScore || '-'}%</div>
          <div class="stat-label">Compliance Score</div>
        </div>
      </div>

      <!-- Threat Level Strip -->
      <h3 class="sub-heading">🔴 Threat Level</h3>
      <div class="card">
        <div class="threat-strip">
          <div class="threat-needle" style="left:${d.overallRisk || 22}%"></div>
        </div>
        <div class="threat-labels">
          <span>LOW</span><span>MODERATE</span><span>HIGH</span><span>CRITICAL</span>
        </div>
      </div>

      <!-- Risk Signals -->
      <h3 class="sub-heading">📡 Risk Signal Decomposition</h3>
      <div class="card">
        ${(data.signals || []).map(s => `
          <div class="signal-bar-container" style="margin-bottom:14px">
            <div class="signal-bar-header">
              <span class="signal-bar-name">${s.name}</span>
              <span class="signal-bar-value" style="color:var(--${s.color})">${s.value}/100</span>
            </div>
            <div class="signal-bar-track">
              <div class="signal-bar-fill" style="width:${s.value}%;background:var(--${s.color})"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- GNN Fraud Network Graph -->
      <h3 class="sub-heading">🧠 GNN Fraud Detection — Agent Network Graph</h3>
      <div class="card">
        <p style="margin-bottom:12px;color:var(--text-secondary)">Graph Neural Network analyzes transaction patterns across the agent network. Nodes represent addresses; flagged nodes show anomalous behavior patterns.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
          ${(data.fraudNodes || []).map(n => `
            <div class="fraud-node ${n.status}">
              <span>${n.status === 'flagged' ? '🔴' : '🟢'}</span>
              <span>${n.label}</span>
              <span style="opacity:0.7;font-size:0.7rem">(${n.score})</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Recent Risk Assessments -->
      <h3 class="sub-heading">📋 Recent Risk Assessments</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Action</th><th>Class</th><th>Risk Score</th><th>Verdict</th><th>Time</th></tr></thead>
          <tbody>
            ${(data.recentAssessments || []).map(a => `
              <tr>
                <td><code style="font-family:var(--font-mono);font-size:0.72rem">${a.actionId}</code></td>
                <td>${badgeHtml(a.actionClass, 'blue')}</td>
                <td><span style="color:${riskColor(a.riskScore)};font-weight:700;font-size:1.1rem">${a.riskScore}</span></td>
                <td>${statusBadge(a.verdict.toLowerCase())}</td>
                <td class="text-muted" style="font-size:0.75rem">${timeAgo(a.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Trading ─────────────────────────────────────────────────
  async function loadTrading() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.trading;
    } else {
      const [summary, orderbook, history, positions] = await Promise.all([
        api('/api/trading/summary'),
        api('/api/trading/orderbook/ETH%2FUSDC'),
        api('/api/trading/history'),
        api('/api/trading/positions'),
      ]);
      data = { summary: summary || {}, orderbook: orderbook || {}, recentTrades: history || [], positions: positions || [] };
    }
    const s = data.summary || {};
    const ob = data.orderbook || {};
    const container = $('#trading-content');

    container.innerHTML = `
      <!-- Trading KPIs -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${fmt(s.totalOrders)}</div>
          <div class="stat-label">Total Orders</div>
          <div class="stat-trend up">${fmtPct(s.winRate)} win rate</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${fmtUsd(s.pnl)}</div>
          <div class="stat-label">Realized P&L</div>
          <div class="stat-trend up">Sharpe: ${s.sharpeRatio || '-'}</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">📈</div>
          <div class="stat-value">${fmtShort(s.totalVolume)}</div>
          <div class="stat-label">Total Volume</div>
          <div class="stat-trend up">Sortino: ${s.sortinoRatio || '-'}</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">📉</div>
          <div class="stat-value">${fmtPct(s.maxDrawdown)}</div>
          <div class="stat-label">Max Drawdown</div>
        </div>
      </div>

      <!-- Order Book -->
      <h3 class="sub-heading">📖 Order Book — ${ob.symbol || 'ETH/USDC'}</h3>
      <div class="card">
        <div style="display:flex;justify-content:center;gap:24px;margin-bottom:12px;font-size:0.82rem">
          <span>Mid: <strong style="color:var(--text-primary);font-family:var(--font-mono)">${fmtUsd(ob.midPrice)}</strong></span>
          <span>Spread: <strong style="color:var(--amber);font-family:var(--font-mono)">${fmtUsd(ob.spread)}</strong></span>
        </div>
        <div class="orderbook-grid">
          <div class="orderbook-side">
            <h4 class="bids">BIDS (Buy)</h4>
            ${(ob.bids || []).map(b => {
              const maxSize = Math.max(...(ob.bids || []).map(x => x.size));
              const pct = (b.size / maxSize) * 100;
              return `<div class="ob-row bid"><div class="ob-bar" style="width:${pct}%"></div><span class="ob-price">${fmtUsd(b.price)}</span><span class="ob-size">${b.size.toFixed(2)}</span></div>`;
            }).join('')}
          </div>
          <div class="orderbook-side">
            <h4 class="asks">ASKS (Sell)</h4>
            ${(ob.asks || []).map(a => {
              const maxSize = Math.max(...(ob.asks || []).map(x => x.size));
              const pct = (a.size / maxSize) * 100;
              return `<div class="ob-row ask"><div class="ob-bar" style="width:${pct}%"></div><span class="ob-price">${fmtUsd(a.price)}</span><span class="ob-size">${a.size.toFixed(2)}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Open Positions -->
      <h3 class="sub-heading">💼 Open Positions</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Avg Entry</th><th>Current</th><th>P&L</th><th>P&L %</th></tr></thead>
          <tbody>
            ${(data.positions || []).map(p => `
              <tr>
                <td><strong>${p.symbol}</strong></td>
                <td>${badgeHtml(p.side, p.side === 'long' ? 'green' : 'red')}</td>
                <td style="font-family:var(--font-mono)">${p.quantity}</td>
                <td style="font-family:var(--font-mono)">${fmtUsd(p.avgEntry)}</td>
                <td style="font-family:var(--font-mono)">${fmtUsd(p.currentPrice)}</td>
                <td style="color:${p.pnl >= 0 ? 'var(--green-light)' : 'var(--red-light)'};font-weight:700;font-family:var(--font-mono)">${p.pnl >= 0 ? '+' : ''}${fmtUsd(p.pnl)}</td>
                <td style="color:${p.pnlPct >= 0 ? 'var(--green-light)' : 'var(--red-light)'};font-weight:700">${fmtPct(p.pnlPct)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Recent Trades -->
      <h3 class="sub-heading">📜 Trade History</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Side</th><th>Price</th><th>Quantity</th><th>Total</th><th>Time</th></tr></thead>
          <tbody>
            ${(data.recentTrades || []).map(t => `
              <tr>
                <td><strong>${t.symbol}</strong></td>
                <td>${badgeHtml(t.side, t.side === 'buy' ? 'green' : 'red')}</td>
                <td style="font-family:var(--font-mono)">${fmtUsd(t.price)}</td>
                <td style="font-family:var(--font-mono)">${t.quantity}</td>
                <td style="font-family:var(--font-mono);font-weight:600">${fmtUsd(t.total)}</td>
                <td class="text-muted" style="font-size:0.75rem">${timeAgo(t.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Place Order Form -->
      <h3 class="sub-heading">📝 Place Order</h3>
      <div class="card">
        <div class="form-grid">
          <div class="form-row">
            <label>Symbol
              <select id="order-symbol">
                ${(data.markets || ['ETH/USDC','BTC/USDC','SOL/USDC','BASE/USDC']).map(m => `<option>${m}</option>`).join('')}
              </select>
            </label>
            <label>Side
              <select id="order-side"><option value="buy">Buy</option><option value="sell">Sell</option></select>
            </label>
            <label>Type
              <select id="order-type"><option value="market">Market</option><option value="limit">Limit</option></select>
            </label>
            <label>Quantity <input type="number" id="order-qty" placeholder="1.0" value="1"></label>
          </div>
          <button class="btn btn-success" onclick="placeOrder()">⚡ Submit Order</button>
        </div>
      </div>
    `;
  }

  // ── DeFi ────────────────────────────────────────────────────
  async function loadDefi() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.defi;
    } else {
      const [snapshot, pools, strategies] = await Promise.all([
        api('/api/defi/snapshot'),
        api('/api/defi/pools'),
        api('/api/defi/strategies'),
      ]);
      data = { snapshot: snapshot || {}, pools: pools || [], strategies: strategies || [] };
    }
    const snap = data.snapshot || {};
    const container = $('#defi-content');

    container.innerHTML = `
      <!-- DeFi KPIs -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--cyan);--stat-glow:var(--cyan-ghost)">
          <div class="stat-icon">🌐</div>
          <div class="stat-value">${fmtShort(snap.totalTvlMonitored)}</div>
          <div class="stat-label">Total TVL Monitored</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">📈</div>
          <div class="stat-value">${snap.bestApy?.toFixed(1) || '-'}%</div>
          <div class="stat-label">Best APY Found</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">🎯</div>
          <div class="stat-value">${snap.strategiesActive || 0}</div>
          <div class="stat-label">Active Strategies</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${fmtShort(snap.totalAllocated)}</div>
          <div class="stat-label">Total Allocated</div>
        </div>
      </div>

      <!-- Top Yield Pools -->
      <h3 class="sub-heading">🏊 Top Yield Pools</h3>
      <div class="cards-grid">
        ${(data.pools || []).map(p => `
          <div class="pool-card animate-in">
            <div class="pool-header">
              <div>
                <div class="pool-name">${p.pool}</div>
                <span style="font-size:0.75rem;color:var(--text-tertiary)">${p.protocol} · ${p.chain}</span>
              </div>
              <div class="pool-apy">${p.apy.toFixed(1)}%</div>
            </div>
            <div class="pool-details">
              <div><div class="pool-detail-label">TVL</div><div class="pool-detail-value">${fmtShort(p.tvl)}</div></div>
              <div><div class="pool-detail-label">Risk</div><div class="pool-detail-value" style="color:${riskColor(p.risk)}">${riskLabel(p.risk)}</div></div>
              <div><div class="pool-detail-label">Category</div><div class="pool-detail-value">${p.category}</div></div>
              <div><div class="pool-detail-label">Chain</div><div class="pool-detail-value" style="text-transform:capitalize">${p.chain}</div></div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Active Strategies -->
      <h3 class="sub-heading">🎯 Active Yield Strategies</h3>
      ${(data.strategies || []).map(s => `
        <div class="card animate-in" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
              <strong style="font-size:1rem">${s.name}</strong>
              <span style="margin-left:8px">${badgeHtml(s.type, 'purple')}</span>
            </div>
            <div style="text-align:right">
              <div style="color:var(--green-light);font-size:1.2rem;font-weight:800">${s.apy.toFixed(1)}% APY</div>
              <div style="font-size:0.75rem;color:var(--text-tertiary)">Allocated: ${fmtUsd(s.allocated)}</div>
            </div>
          </div>
          ${s.allocations.map(a => `
            <div class="waterfall-row">
              <div class="waterfall-label">${a.pool}</div>
              <div class="waterfall-bar-wrap"><div class="waterfall-bar" style="width:${a.pct}%;background:var(--accent)"></div></div>
              <div class="waterfall-val">${a.pct}%</div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  // ── Governance ──────────────────────────────────────────────
  async function loadGovernance() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.governance;
    } else {
      const [govDemo, holdActive, proposals] = await Promise.all([
        api('/api/governance/demo'),
        api('/api/hold/active'),
        api('/api/hold/stats'),
      ]);
      data = { proposals: [], holdQueue: holdActive || [], policyVersions: 0, activeVoters: 0 };
    }
    const container = $('#governance-content');

    container.innerHTML = `
      <div class="metric-row">
        <div class="metric-mini"><div class="metric-label">Active Proposals</div><div class="metric-val">${(data.proposals || []).filter(p => p.status === 'active').length}</div></div>
        <div class="metric-mini"><div class="metric-label">Active Voters</div><div class="metric-val">${data.activeVoters}</div></div>
        <div class="metric-mini"><div class="metric-label">Policy Versions</div><div class="metric-val">${data.policyVersions}</div></div>
        <div class="metric-mini"><div class="metric-label">HOLD Queue</div><div class="metric-val" style="color:var(--amber)">${(data.holdQueue || []).length}</div></div>
      </div>

      <!-- Proposals -->
      <h3 class="sub-heading">🗳️ Governance Proposals</h3>
      ${(data.proposals || []).map(p => `
        <div class="card animate-in" style="margin-bottom:16px;border-left:4px solid ${p.status === 'active' ? 'var(--accent)' : 'var(--green)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <strong style="font-size:1.05rem">${p.title}</strong>
              <div style="margin-top:4px">${badgeHtml(p.status, p.status === 'active' ? 'blue' : 'green')} ${badgeHtml(p.type, 'purple')}</div>
            </div>
            <div style="text-align:right;font-size:0.78rem;color:var(--text-tertiary)">
              <div>Proposer: ${p.proposer}</div>
              <div>${fullTimestamp(p.createdAt)}</div>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:16px">${p.description}</p>
          <div style="display:flex;gap:16px;align-items:center">
            <span style="color:var(--green-light);font-weight:700">👍 ${p.votes.yes} YES</span>
            <span style="color:var(--red-light);font-weight:700">👎 ${p.votes.no} NO</span>
            <span style="color:var(--text-tertiary)">⏭️ ${p.votes.abstain} ABSTAIN</span>
            <span style="margin-left:auto;font-size:0.78rem;color:var(--text-tertiary)">Quorum: ${p.votes.yes + p.votes.no + p.votes.abstain}/${p.quorum}</span>
          </div>
          <div class="signal-bar-container" style="margin-top:12px">
            <div class="signal-bar-track">
              <div class="signal-bar-fill" style="width:${(p.votes.yes / (p.votes.yes + p.votes.no + p.votes.abstain)) * 100}%;background:var(--green)"></div>
            </div>
          </div>
        </div>
      `).join('')}

      <!-- HOLD Queue -->
      <h3 class="sub-heading">⏸️ HOLD Queue — Pending Human Review</h3>
      ${(data.holdQueue || []).length === 0 ? '<p class="text-muted">No actions currently held.</p>' : ''}
      ${(data.holdQueue || []).map(h => `
        <div class="alert-item" style="border-left-color:var(--amber)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${h.description}</strong>
            <span style="color:${riskColor(h.riskScore)};font-weight:700;font-size:1.1rem">${h.riskScore}</span>
          </div>
          <p>${h.actionId} — Held ${timeAgo(h.heldSince)} — Approvals: ${h.currentApprovals}/${h.requiredApprovals}</p>
          <div style="margin-top:8px;display:flex;gap:8px">
            <button class="btn btn-success btn-sm" onclick="toast('Action approved (demo)','success')">✅ Approve</button>
            <button class="btn btn-danger btn-sm" onclick="toast('Action rejected (demo)','error')">❌ Reject</button>
          </div>
        </div>
      `).join('')}
    `;
  }

  // ── Identity & MCP ──────────────────────────────────────────
  async function loadIdentity() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.identity;
    } else {
      const [mcpStats, discover] = await Promise.all([
        api('/api/mcp/stats'),
        api('/api/mcp/discover'),
      ]);
      data = { did: {}, credentials: [], mcpAgents: discover || [], mcpStats: mcpStats || {} };
    }
    const container = $('#identity-content');

    container.innerHTML = `
      <!-- DID Section -->
      <h3 class="sub-heading">🪪 Decentralized Identity (DID)</h3>
      <div class="card animate-in">
        <ul class="rule-list">
          <li><strong>DID</strong> <code style="font-family:var(--font-mono);color:var(--accent-light)">${data.did?.id || '-'}</code></li>
          <li><strong>Method</strong> ${data.did?.method || '-'}</li>
          <li><strong>Controller</strong> <code style="font-family:var(--font-mono)">${data.did?.controller || '-'}</code></li>
          <li><strong>Verification</strong> ${(data.did?.verificationMethods || []).join(', ')}</li>
          <li><strong>Services</strong> ${(data.did?.services || []).map(s => badgeHtml(s, 'blue')).join(' ')}</li>
        </ul>
      </div>

      <!-- Verifiable Credentials -->
      <h3 class="sub-heading">📜 Verifiable Credentials</h3>
      <div class="cards-grid">
        ${(data.credentials || []).map(c => `
          <div class="card animate-in">
            <h3>${c.type}</h3>
            <ul class="rule-list">
              <li><strong>Issuer</strong> <code style="font-family:var(--font-mono);font-size:0.72rem">${c.issuer}</code></li>
              <li><strong>Level</strong> ${badgeHtml(c.level, 'green')}</li>
              ${c.score ? `<li><strong>Trust Score</strong> <span style="color:var(--green-light);font-weight:700">${c.score}/1000</span></li>` : ''}
              ${c.checks ? `<li><strong>Checks Passed</strong> ${c.checks}</li>` : ''}
              <li><strong>Issued</strong> ${timeAgo(c.issuedAt)}</li>
            </ul>
          </div>
        `).join('')}
      </div>

      <!-- MCP Agent Registry -->
      <h3 class="sub-heading">🌐 MCP Agent Discovery Network</h3>
      <div class="metric-row">
        <div class="metric-mini"><div class="metric-label">Total Agents</div><div class="metric-val">${data.mcpStats?.totalAgents || 0}</div></div>
        <div class="metric-mini"><div class="metric-label">Online</div><div class="metric-val" style="color:var(--green)">${data.mcpStats?.onlineAgents || 0}</div></div>
        <div class="metric-mini"><div class="metric-label">Total Requests</div><div class="metric-val">${fmt(data.mcpStats?.totalRequests)}</div></div>
        <div class="metric-mini"><div class="metric-label">Avg Latency</div><div class="metric-val">${data.mcpStats?.avgLatency || '-'}ms</div></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Agent</th><th>Name</th><th>Status</th><th>Capabilities</th><th>Trust</th><th>Last Seen</th></tr></thead>
          <tbody>
            ${(data.mcpAgents || []).map(a => `
              <tr>
                <td><code style="font-family:var(--font-mono);font-size:0.72rem">${a.id}</code></td>
                <td><strong>${a.name}</strong></td>
                <td>${badgeHtml(a.status, a.status === 'online' ? 'green' : 'amber')}</td>
                <td>${(a.capabilities || []).map(c => badgeHtml(c, 'blue')).join(' ')}</td>
                <td><span style="color:${a.trustScore >= 80 ? 'var(--green-light)' : 'var(--amber-light)'};font-weight:700">${a.trustScore}/100</span></td>
                <td class="text-muted" style="font-size:0.75rem">${timeAgo(a.lastSeen)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Audit & Compliance ──────────────────────────────────────
  async function loadAudit() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.audit;
    } else {
      const [auditEntries, exportPacket] = await Promise.all([
        api('/api/audit?limit=20'),
        api('/api/audit/export'),
      ]);
      data = { summary: {}, soc2Checklist: [], recentEntries: auditEntries || [] };
    }
    const s = data.summary || {};
    const container = $('#audit-content');

    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${fmt(s.totalEntries)}</div>
          <div class="stat-label">Audit Entries</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${s.complianceScore || '-'}%</div>
          <div class="stat-label">Compliance Score</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">🛡️</div>
          <div class="stat-value">${s.controlsPassing || '-'}/${s.soc2Controls || '-'}</div>
          <div class="stat-label">SOC 2 Controls Passing</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--amber);--stat-glow:var(--amber-ghost)">
          <div class="stat-icon">📤</div>
          <div class="stat-value">${s.exportReady ? '✔' : '✗'}</div>
          <div class="stat-label">Export Ready</div>
        </div>
      </div>

      <!-- SOC 2 Compliance Checklist -->
      <h3 class="sub-heading">🛡️ SOC 2 Type II Control Mapping</h3>
      <div class="card animate-in">
        <ul class="checklist">
          ${(data.soc2Checklist || []).map(c => `
            <li>
              <span class="check-icon ${c.status}">${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}</span>
              <div>
                <strong style="color:var(--text-primary)">${c.control}</strong>
                <div style="color:var(--text-secondary);font-size:0.82rem">${c.description}</div>
                <div style="color:var(--text-tertiary);font-size:0.75rem;margin-top:2px">Evidence: ${c.evidence}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- Audit Log -->
      <h3 class="sub-heading">📜 Audit Ledger — Cryptographic Hash Chain</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Action</th><th>Class</th><th>Risk</th><th>Policy Result</th><th>Status</th><th>Hash</th><th>Time</th></tr></thead>
          <tbody>
            ${(data.recentEntries || []).map(e => `
              <tr>
                <td><code style="font-family:var(--font-mono);font-size:0.72rem">${e.actionId}</code></td>
                <td>${badgeHtml(e.actionClass, 'blue')}</td>
                <td><span style="color:${riskColor(e.riskScore)};font-weight:700">${e.riskScore}</span></td>
                <td>${statusBadge((e.policyResult || e.status || '').toLowerCase())}</td>
                <td>${statusBadge(e.status)}</td>
                <td><code style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-tertiary)">${e.hashChain || '-'}</code></td>
                <td class="text-muted" style="font-size:0.75rem">${timeAgo(e.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:16px;display:flex;gap:12px">
        <button class="btn btn-primary" onclick="exportAudit()">📤 Export Compliance Packet</button>
        <button class="btn btn-secondary" onclick="toast('SOC 2 report generated','success')">📊 Generate SOC 2 Report</button>
      </div>
    `;
  }

  // ── Web3 & Contracts ────────────────────────────────────────
  async function loadWeb3() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.web3;
    } else {
      const [stats, reports] = await Promise.all([
        api('/api/web3/stats'),
        api('/api/web3/reports'),
      ]);
      data = { chains: [], contractVerifications: reports || [], stats: stats || {} };
    }
    const st = data.stats || {};
    const container = $('#web3-content');

    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">📝</div>
          <div class="stat-value">${fmt(st.contractsVerified)}</div>
          <div class="stat-label">Contracts Verified</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">🐛</div>
          <div class="stat-value">${fmt(st.vulnerabilitiesFound)}</div>
          <div class="stat-label">Vulnerabilities Found</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${st.avgRiskScore || '-'}</div>
          <div class="stat-label">Avg Risk Score</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">⛓️</div>
          <div class="stat-value">${st.chainsMonitored || '-'}</div>
          <div class="stat-label">Chains Monitored</div>
        </div>
      </div>

      <!-- Multi-Chain Status -->
      <h3 class="sub-heading">⛓️ Multi-Chain Infrastructure</h3>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        ${(data.chains || []).map(c => `
          <div class="chain-pill">
            <span class="chain-dot" style="background:${c.color}"></span>
            <span>${c.name}</span>
            <span style="font-size:0.68rem;color:var(--text-tertiary)">${c.status}</span>
            <span style="font-size:0.68rem;color:var(--text-tertiary);font-family:var(--font-mono)">${c.gasPrice}</span>
          </div>
        `).join('')}
      </div>

      <!-- Contract Verifications -->
      <h3 class="sub-heading">🔍 Smart Contract Verifications</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Address</th><th>Chain</th><th>Name</th><th>Risk</th><th>Vulns</th><th>Verified</th><th>Time</th></tr></thead>
          <tbody>
            ${(data.contractVerifications || []).map(c => `
              <tr>
                <td><code style="font-family:var(--font-mono);font-size:0.72rem">${c.address}</code></td>
                <td>${c.chain}</td>
                <td><strong>${c.name}</strong></td>
                <td><span style="color:${riskColor(c.riskScore)};font-weight:700">${c.riskScore}</span></td>
                <td>${c.vulnerabilities > 0 ? `<span style="color:var(--red-light);font-weight:700">${c.vulnerabilities}</span>` : '<span style="color:var(--green)">0</span>'}</td>
                <td>${c.verified ? badgeHtml('VERIFIED', 'green') : badgeHtml('UNVERIFIED', 'red')}</td>
                <td class="text-muted" style="font-size:0.75rem">${timeAgo(c.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Verify Contract Form -->
      <h3 class="sub-heading">🔍 Verify Smart Contract</h3>
      <div class="card">
        <div class="form-grid">
          <div class="form-row">
            <label>Contract Address <input type="text" id="verify-address" placeholder="0x..." value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"></label>
            <label>Chain
              <select id="verify-chain"><option>base</option><option>ethereum</option><option>arbitrum</option></select>
            </label>
          </div>
          <button class="btn btn-primary" onclick="verifyContract()">🔍 Run Verification Analysis</button>
        </div>
      </div>
    `;
  }

  // ── Live Events ─────────────────────────────────────────────
  async function loadEvents() {
    let events;
    if (DEMO_MODE) {
      events = DEMO.events;
    } else {
      events = await api('/api/events?limit=50') || [];
    }
    const container = $('#events-content');

    container.innerHTML = `
      <div class="event-feed" id="event-feed">
        ${(events || []).map(e => renderEvent(e)).join('')}
      </div>
      <div style="margin-top:12px;display:flex;gap:12px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="loadEvents()">🔄 Refresh</button>
        <span class="text-muted" style="font-size:0.75rem">Events auto-update via Server-Sent Events (SSE) when connected to backend</span>
      </div>
    `;

    // Connect SSE if not in demo mode
    if (!DEMO_MODE && !eventSource) {
      connectSSE();
    }
  }

  function renderEvent(e) {
    const severityColors = { info: 'var(--blue)', warning: 'var(--amber)', critical: 'var(--red)', error: 'var(--red)' };
    const categoryIcons = { policy: '🛡️', trade: '📈', risk: '⚠️', governance: '🗳️', compliance: '🔒', system: '⚙️', defi: '🌐', moltbook: '📘', identity: '🪪' };
    return `
      <div class="event-item">
        <span style="font-size:1.1rem">${categoryIcons[e.category] || '📌'}</span>
        <span class="event-time">${timestamp(e.timestamp)}</span>
        <span style="width:4px;height:4px;border-radius:50%;background:${severityColors[e.severity] || 'var(--blue)'};flex-shrink:0"></span>
        <span class="event-msg">${e.message}</span>
        ${badgeHtml(e.severity, e.severity === 'critical' ? 'red' : e.severity === 'warning' ? 'amber' : 'blue')}
      </div>
    `;
  }

  // ── Market Trends ───────────────────────────────────────────
  async function loadTrends() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.trends;
    } else {
      const [overview, sectors, anomalies] = await Promise.all([
        api('/api/trends/overview'),
        api('/api/trends/sectors'),
        api('/api/trends/anomalies'),
      ]);
      data = { overview: overview || {}, sectors: sectors || [], anomalies: anomalies || [] };
    }
    const ov = data.overview || {};
    const container = $('#trends-content');

    container.innerHTML = `
      <!-- Market Ticker -->
      <div class="ticker-tape">
        <span class="ticker-label">📊 MARKET</span>
        <div class="ticker-scroll">
          <div class="ticker-inner">
            <span class="ticker-item"><span class="ticker-sym">BTC</span> ${fmtUsd(ov.btcPrice)} <span class="${ov.btcChange24h >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.btcChange24h)}</span></span>
            <span class="ticker-item"><span class="ticker-sym">ETH</span> ${fmtUsd(ov.ethPrice)} <span class="${ov.ethChange24h >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.ethChange24h)}</span></span>
            <span class="ticker-item"><span class="ticker-sym">SOL</span> ${fmtUsd(ov.solPrice)} <span class="${ov.solChange24h >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.solChange24h)}</span></span>
            <span class="ticker-item"><span class="ticker-sym">MCAP</span> ${fmtShort(ov.totalMarketCap)} <span class="${ov.marketCapChange >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.marketCapChange)}</span></span>
            <span class="ticker-item"><span class="ticker-sym">BTC.D</span> ${ov.btcDominance}%</span>
            <!-- Duplicate for seamless scroll -->
            <span class="ticker-item"><span class="ticker-sym">BTC</span> ${fmtUsd(ov.btcPrice)} <span class="${ov.btcChange24h >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.btcChange24h)}</span></span>
            <span class="ticker-item"><span class="ticker-sym">ETH</span> ${fmtUsd(ov.ethPrice)} <span class="${ov.ethChange24h >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.ethChange24h)}</span></span>
            <span class="ticker-item"><span class="ticker-sym">SOL</span> ${fmtUsd(ov.solPrice)} <span class="${ov.solChange24h >= 0 ? 'ticker-up' : 'ticker-down'}">${fmtPct(ov.solChange24h)}</span></span>
          </div>
        </div>
      </div>

      <!-- Market KPIs -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--amber);--stat-glow:var(--amber-ghost)">
          <div class="stat-icon">😀</div>
          <div class="stat-value">${ov.fearGreedIndex || '-'}</div>
          <div class="stat-label">Fear & Greed Index</div>
          <div class="stat-trend up">${ov.fearGreedLabel || '-'}</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${fmtShort(ov.totalMarketCap)}</div>
          <div class="stat-label">Total Market Cap</div>
          <div class="stat-trend ${ov.marketCapChange >= 0 ? 'up' : 'down'}">${fmtPct(ov.marketCapChange)}</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">👑</div>
          <div class="stat-value">${ov.btcDominance || '-'}%</div>
          <div class="stat-label">BTC Dominance</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">🔥</div>
          <div class="stat-value">${(data.anomalies || []).length}</div>
          <div class="stat-label">Market Anomalies</div>
        </div>
      </div>

      <!-- Sector Performance -->
      <h3 class="sub-heading">📊 Sector Performance (24h)</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Sector</th><th>24h Change</th><th>Market Cap</th><th>Top Token</th></tr></thead>
          <tbody>
            ${(data.sectors || []).map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td style="color:${s.change24h >= 0 ? 'var(--green-light)' : 'var(--red-light)'};font-weight:700">${fmtPct(s.change24h)}</td>
                <td style="font-family:var(--font-mono)">${fmtShort(s.marketCap)}</td>
                <td>${badgeHtml(s.topToken, 'purple')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Market Anomalies -->
      <h3 class="sub-heading">⚠️ Market Anomalies & Alerts</h3>
      ${(data.anomalies || []).map(a => `
        <div class="alert-item" style="border-left-color:${a.severity === 'high' ? 'var(--red)' : a.severity === 'medium' ? 'var(--amber)' : 'var(--blue)'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${a.asset} — ${a.type.replace(/_/g, ' ').toUpperCase()}</strong>
            ${badgeHtml(a.severity, a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'blue')}
          </div>
          <p>${a.description}</p>
          <span class="meta">${timeAgo(a.timestamp)}</span>
        </div>
      `).join('')}
    `;
  }

  // ============================================================
  //  SSE (Server-Sent Events) Connection
  // ============================================================
  function connectSSE() {
    if (eventSource) { eventSource.close(); }
    try {
      eventSource = new EventSource('/api/events/stream');
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (currentSection === 'events') {
            const feed = $('#event-feed');
            if (feed) {
              feed.insertAdjacentHTML('afterbegin', renderEvent(data));
              // Limit displayed events
              while (feed.children.length > 100) feed.lastElementChild.remove();
            }
          }
          // Update event count badge
          const badge = $('#event-count-badge');
          if (badge && currentSection !== 'events') {
            const count = parseInt(badge.textContent) + 1;
            badge.textContent = count;
            badge.style.display = 'inline';
          }
        } catch {}
      };
      eventSource.onerror = () => {
        console.warn('SSE connection lost, will retry...');
      };
    } catch (err) {
      console.warn('SSE not available:', err.message);
    }
  }

  // ============================================================
  //  NAVIGATION
  // ============================================================
  function navigateTo(section) {
    currentSection = section;
    // Update nav
    $$('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = $(`.nav-item[data-section="${section}"]`);
    if (activeNav) activeNav.classList.add('active');
    // Show/hide sections
    $$('.section').forEach(el => el.style.display = 'none');
    const sectionEl = $(`#section-${section}`);
    if (sectionEl) sectionEl.style.display = 'block';
    // Reset event badge
    if (section === 'events') {
      const badge = $('#event-count-badge');
      if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
    }
    // Load data
    loadSection(section);
  }

  // ── Orchestrator (Agent Swarm) ──────────────────────────────
  async function loadOrchestrator() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.orchestrator;
    } else {
      const [agents, stats, tasks, pipelines] = await Promise.all([
        api('/api/orchestrator/agents'),
        api('/api/orchestrator/stats'),
        api('/api/orchestrator/tasks'),
        api('/api/orchestrator/pipelines'),
      ]);
      data = { agents: agents || [], stats: stats || {}, recentTasks: tasks || [], pipelines: pipelines || [] };
    }
    const st = data.stats || {};
    const container = $('#orchestrator-content');

    container.innerHTML = `
      <!-- Orchestrator KPIs -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">🤖</div>
          <div class="stat-value">${(data.agents || []).length}</div>
          <div class="stat-label">Active Sub-Agents</div>
          <div class="stat-trend up">Coordinated by Orchestrator</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${fmt(st.totalTasks)}</div>
          <div class="stat-label">Tasks Routed</div>
          <div class="stat-trend up">${fmt(st.completedTasks)} completed</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">${st.avgResponseTime || 0}ms</div>
          <div class="stat-label">Avg Response Time</div>
          <div class="stat-trend up">Sub-50ms target</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">❌</div>
          <div class="stat-value">${st.failedTasks || 0}</div>
          <div class="stat-label">Failed Tasks</div>
          <div class="stat-trend down">${st.totalTasks > 0 ? ((st.failedTasks / st.totalTasks) * 100).toFixed(1) : 0}% fail rate</div>
        </div>
      </div>

      <!-- Agent Grid -->
      <h3 class="sub-heading">🤖 Sub-Agent Registry</h3>
      <div class="agent-swarm-grid">
        ${(data.agents || []).map(a => `
          <div class="agent-card" style="border-left: 3px solid var(--accent)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:24px">${a.icon || '🤖'}</span>
                <div>
                  <strong style="color:var(--text-primary);font-size:14px">${a.id}</strong>
                  <div style="color:var(--text-tertiary);font-size:11px;text-transform:uppercase;letter-spacing:.5px">${a.role}</div>
                </div>
              </div>
              ${badgeHtml(a.status, a.status === 'active' ? 'green' : 'amber')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div style="font-size:11px;color:var(--text-tertiary)">Trust Score</div>
              <div style="font-size:11px;font-weight:600;color:${a.trustScore >= 90 ? 'var(--green-light)' : 'var(--amber-light)'}">${a.trustScore}/100</div>
              <div style="font-size:11px;color:var(--text-tertiary)">Tasks Done</div>
              <div style="font-size:11px;font-weight:600;color:var(--text-primary)">${fmt(a.tasksCompleted)}</div>
              <div style="font-size:11px;color:var(--text-tertiary)">Avg Response</div>
              <div style="font-size:11px;font-weight:600;color:var(--text-primary)">${a.avgResponseTime}ms</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
              ${(a.capabilities || []).map(c => `<span class="tag">${c}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Recent Tasks -->
      <h3 class="sub-heading">📋 Recent Tasks</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Task</th><th>Type</th><th>Agent</th><th>Result</th><th>Time</th><th>When</th></tr></thead>
          <tbody>
            ${(data.recentTasks || []).map(t => `
              <tr>
                <td><code>${(t.id || '').slice(0, 12)}</code></td>
                <td>${badgeHtml(t.type, 'blue')}</td>
                <td><strong>${t.assignedTo}</strong></td>
                <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${t.result || '-'}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${t.duration}ms</td>
                <td class="meta">${timeAgo(t.timestamp)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pipelines -->
      <h3 class="sub-heading">🔗 Execution Pipelines</h3>
      ${(data.pipelines || []).map(p => `
        <div class="pipeline-card" style="background:var(--surface-secondary);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="color:var(--text-primary);text-transform:uppercase;font-size:13px;letter-spacing:.5px">${p.name} Pipeline</strong>
            <div style="display:flex;align-items:center;gap:8px">
              ${badgeHtml(p.status, p.status === 'completed' ? 'green' : 'amber')}
              <span class="meta">${p.duration}ms</span>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
            ${(p.steps || []).map((s, i) => `
              <span style="font-size:12px;padding:4px 10px;background:var(--surface-tertiary);border-radius:6px;color:var(--text-secondary);font-family:var(--font-mono)">${s}</span>
              ${i < p.steps.length - 1 ? '<span style="color:var(--accent-light)">→</span>' : ''}
            `).join('')}
          </div>
        </div>
      `).join('')}

      <!-- Dispatch Task -->
      <h3 class="sub-heading">🚀 Dispatch Task</h3>
      <div class="form-card" style="background:var(--surface-secondary);border-radius:12px;padding:20px;border:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Task Type</label>
            <select class="form-input" id="dispatch-task-type">
              <option value="risk_scan">Risk Scan</option>
              <option value="fraud_check">Fraud Check</option>
              <option value="policy_check">Policy Check</option>
              <option value="trade_execute">Trade Execute</option>
              <option value="audit_generate">Audit Generate</option>
              <option value="did_resolve">DID Resolve</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-input" id="dispatch-priority">
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" onclick="dispatchTask()" style="margin-top:12px">🤖 Dispatch to Agent Swarm</button>
      </div>
    `;
  }

  // ── x402 Commerce ──────────────────────────────────────────
  async function loadX402() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.x402;
    } else {
      const [stats, resources, payments] = await Promise.all([
        api('/api/x402/stats'),
        api('/api/x402/resources'),
        api('/api/x402/payments'),
      ]);
      data = { stats: stats || {}, resources: resources || [], recentPayments: payments || [] };
    }
    const st = data.stats || {};
    const container = $('#x402-content');

    container.innerHTML = `
      <!-- x402 KPIs -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">💰</div>
          <div class="stat-value">$${(st.totalRevenue || 0).toFixed(2)}</div>
          <div class="stat-label">Total Revenue (USDC)</div>
          <div class="stat-trend up">From ${st.totalPaid || 0} paid requests</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${st.totalRequests || 0}</div>
          <div class="stat-label">Total Requests</div>
          <div class="stat-trend up">${st.totalPaid || 0} successful payments</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">🏪</div>
          <div class="stat-value">${st.activeResources || 0}</div>
          <div class="stat-label">Priced Resources</div>
          <div class="stat-trend up">Agent service marketplace</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--red);--stat-glow:var(--red-ghost)">
          <div class="stat-icon">🚫</div>
          <div class="stat-value">${st.rejectedPayments || 0}</div>
          <div class="stat-label">Rejected Payments</div>
          <div class="stat-trend down">Cost-benefit too low</div>
        </div>
      </div>

      <!-- x402 Flow Diagram -->
      <div class="x402-flow" style="background:var(--surface-secondary);border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid var(--border)">
        <h4 style="color:var(--text-primary);margin-bottom:12px">⚡ x402 Payment Flow</h4>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px">
          <span style="padding:8px 14px;background:var(--surface-tertiary);border-radius:8px;color:var(--blue-light);border:1px solid var(--blue-ghost)">1. Agent requests resource</span>
          <span style="color:var(--accent-light);font-size:18px">→</span>
          <span style="padding:8px 14px;background:var(--surface-tertiary);border-radius:8px;color:var(--amber-light);border:1px solid var(--amber-ghost)">2. Server returns 402 + price</span>
          <span style="color:var(--accent-light);font-size:18px">→</span>
          <span style="padding:8px 14px;background:var(--surface-tertiary);border-radius:8px;color:var(--purple-light);border:1px solid var(--purple-ghost)">3. Agent evaluates cost-benefit</span>
          <span style="color:var(--accent-light);font-size:18px">→</span>
          <span style="padding:8px 14px;background:var(--surface-tertiary);border-radius:8px;color:var(--green-light);border:1px solid var(--green-ghost)">4. Pay USDC on Base</span>
          <span style="color:var(--accent-light);font-size:18px">→</span>
          <span style="padding:8px 14px;background:var(--surface-tertiary);border-radius:8px;color:var(--cyan);border:1px solid rgba(34,211,238,.15)">5. Resource delivered</span>
        </div>
      </div>

      <!-- Resource Catalog -->
      <h3 class="sub-heading">🏪 Priced Resource Catalog</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Resource</th><th>Price</th><th>Chain</th><th>Category</th><th>Action</th></tr></thead>
          <tbody>
            ${(data.resources || []).map(r => `
              <tr>
                <td><strong>${r.description}</strong><br><code style="font-size:10px;color:var(--text-tertiary)">${r.endpoint}</code></td>
                <td style="font-weight:700;color:var(--green-light);font-family:var(--font-mono)">$${r.price.toFixed(2)} ${r.currency}</td>
                <td>${badgeHtml(r.chain, 'blue')}</td>
                <td>${badgeHtml(r.category, r.category === 'security' ? 'red' : r.category === 'risk' ? 'amber' : 'purple')}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="purchaseResource('${r.id}')">Purchase</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Recent Payments -->
      <h3 class="sub-heading">💳 Recent x402 Payments</h3>
      ${(data.recentPayments || []).map(p => `
        <div class="payment-item" style="background:var(--surface-secondary);border-radius:10px;padding:14px 16px;margin-bottom:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="color:var(--text-primary)">${p.resourceId}</strong>
            <span style="color:var(--text-tertiary);font-size:12px;margin-left:8px">from ${p.requestingAgent}</span>
            ${p.txHash ? `<div style="font-size:11px;color:var(--text-tertiary);font-family:var(--font-mono);margin-top:4px">tx: ${p.txHash}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-weight:700;color:var(--green-light);font-family:var(--font-mono)">$${p.amount.toFixed(2)}</span>
            ${badgeHtml(p.status, p.status === 'verified' ? 'green' : p.status === 'rejected' ? 'red' : 'amber')}
          </div>
        </div>
      `).join('')}
    `;
  }

  // ── Trust Delegation ────────────────────────────────────────
  async function loadTrust() {
    let data;
    if (DEMO_MODE) {
      data = DEMO.trust;
    } else {
      const [stats, capabilities, delegations] = await Promise.all([
        api('/api/trust/stats'),
        api('/api/trust/capabilities'),
        api('/api/trust/delegations'),
      ]);
      data = { stats: stats || {}, capabilities: capabilities || [], delegations: delegations || [] };
    }
    const st = data.stats || {};
    const container = $('#trust-content');
    const riskColors = { low: 'green', medium: 'amber', high: 'red', critical: 'purple' };

    container.innerHTML = `
      <!-- Trust KPIs -->
      <div class="stat-grid">
        <div class="stat-card animate-in" style="--stat-accent:var(--purple);--stat-glow:var(--purple-ghost)">
          <div class="stat-icon">🔑</div>
          <div class="stat-value">${st.totalCapabilities || 0}</div>
          <div class="stat-label">Trust Capabilities</div>
          <div class="stat-trend up">Defined in trust registry</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--green);--stat-glow:var(--green-ghost)">
          <div class="stat-icon">🔗</div>
          <div class="stat-value">${st.activeDelegations || 0}</div>
          <div class="stat-label">Active Delegations</div>
          <div class="stat-trend up">${st.revokedDelegations || 0} revoked</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--blue);--stat-glow:var(--blue-ghost)">
          <div class="stat-icon">🤖</div>
          <div class="stat-value">${st.totalAgents || 0}</div>
          <div class="stat-label">Agents with Permissions</div>
          <div class="stat-trend up">Avg ${st.avgCapabilitiesPerAgent || 0} caps/agent</div>
        </div>
        <div class="stat-card animate-in" style="--stat-accent:var(--amber);--stat-glow:var(--amber-ghost)">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${st.avgCapabilitiesPerAgent || 0}</div>
          <div class="stat-label">Avg Capabilities/Agent</div>
          <div class="stat-trend up">Least-privilege model</div>
        </div>
      </div>

      <!-- Trust Chain Visualization -->
      <h3 class="sub-heading">🔗 Trust Delegation Chain</h3>
      <div class="trust-chain" style="background:var(--surface-secondary);border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid var(--border)">
        ${(data.delegations || []).map(d => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:var(--surface-tertiary);border-radius:8px">
            <span style="font-size:12px;font-weight:600;color:${d.depth === 0 ? 'var(--cyan)' : 'var(--accent-light)'}">L${d.depth}</span>
            <span style="font-weight:600;color:var(--text-primary)">${d.delegator}</span>
            <span style="color:var(--accent-light);font-size:18px">→</span>
            <span style="font-weight:600;color:var(--text-primary)">${d.delegate}</span>
            <div style="flex:1;display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end">
              ${(d.capabilities || []).map(c => `<span class="tag" style="font-size:10px">${c.replace('cap-', '')}</span>`).join('')}
            </div>
            ${badgeHtml(d.status, d.status === 'active' ? 'green' : 'red')}
          </div>
        `).join('')}
      </div>

      <!-- Capabilities Registry -->
      <h3 class="sub-heading">🛡️ Capability Registry</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Capability</th><th>Risk Level</th><th>Max Delegation Depth</th></tr></thead>
          <tbody>
            ${(data.capabilities || []).map(c => `
              <tr>
                <td><strong>${c.name}</strong> <code style="font-size:10px;color:var(--text-tertiary)">${c.id}</code></td>
                <td>${badgeHtml(c.riskLevel, riskColors[c.riskLevel] || 'blue')}</td>
                <td style="font-family:var(--font-mono)">${c.maxDelegationDepth}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Delegation Constraints -->
      <h3 class="sub-heading">📋 Delegation Constraints</h3>
      ${(data.delegations || []).filter(d => d.constraints && Object.keys(d.constraints).length > 0).map(d => `
        <div style="background:var(--surface-secondary);border-radius:10px;padding:14px 16px;margin-bottom:8px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <strong style="color:var(--text-primary)">${d.delegator} → ${d.delegate}</strong>
            ${badgeHtml('depth ' + d.depth, 'blue')}
          </div>
          <pre style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);margin:0;white-space:pre-wrap">${JSON.stringify(d.constraints, null, 2)}</pre>
        </div>
      `).join('')}
    `;
  }

  function loadSection(section) {
    const loaders = {
      overview: loadOverview,
      policies: loadPolicies,
      actions: loadActions,
      risk: loadRisk,
      trading: loadTrading,
      defi: loadDefi,
      governance: loadGovernance,
      identity: loadIdentity,
      audit: loadAudit,
      web3: loadWeb3,
      events: loadEvents,
      trends: loadTrends,
      orchestrator: loadOrchestrator,
      x402: loadX402,
      trust: loadTrust,
    };
    if (loaders[section]) loaders[section]();
  }

  // ============================================================
  //  GLOBAL ACTIONS (called from onclick handlers)
  // ============================================================
  window.executeTransfer = async function () {
    const to = $('#transfer-to')?.value || '0x0';
    const amount = parseFloat($('#transfer-amount')?.value) || 100;
    const currency = $('#transfer-currency')?.value || 'ETH';
    if (DEMO_MODE) {
      toast(`Transfer of ${amount} ${currency} → ${to} submitted to Policy Engine`, 'success');
      toast('Policy Engine: ALLOW (risk: 14) → Executing via SURGE wallet...', 'info');
      setTimeout(() => toast('Transfer executed successfully! Tx hash: 0x3f2a...8c1d', 'success'), 1500);
      return;
    }
    const result = await api('/api/actions/transfer', { method: 'POST', body: { to, amount, currency } });
    if (result) toast(`Transfer ${result.status}: ${JSON.stringify(result)}`, result.status === 'executed' ? 'success' : 'warning');
    else toast('Transfer failed', 'error');
  };

  window.placeOrder = async function () {
    const symbol = $('#order-symbol')?.value || 'ETH/USDC';
    const side = $('#order-side')?.value || 'buy';
    const type = $('#order-type')?.value || 'market';
    const quantity = parseFloat($('#order-qty')?.value) || 1;
    if (DEMO_MODE) {
      toast(`Order submitted: ${side.toUpperCase()} ${quantity} ${symbol} (${type})`, 'success');
      setTimeout(() => toast(`Order filled: ${side.toUpperCase()} ${quantity} ${symbol} @ market price`, 'success'), 800);
      return;
    }
    const result = await api('/api/trading/order', { method: 'POST', body: { symbol, side, type, quantity } });
    if (result) toast(`Order ${result.status}: ${result.id}`, 'success');
    else toast('Order failed', 'error');
  };

  window.verifyContract = async function () {
    const address = $('#verify-address')?.value || '0x0';
    const chain = $('#verify-chain')?.value || 'base';
    if (DEMO_MODE) {
      toast(`Analyzing contract ${address} on ${chain}...`, 'info');
      setTimeout(() => toast('Verification complete: Risk Score 5/100, 0 vulnerabilities, SAFE ✓', 'success'), 1200);
      return;
    }
    const result = await api('/api/web3/verify', { method: 'POST', body: { contractAddress: address, chain } });
    if (result) toast(`Contract risk: ${result.riskScore}/100, ${result.vulnerabilities?.length || 0} vulns`, result.riskScore < 50 ? 'success' : 'warning');
    else toast('Verification failed', 'error');
  };

  window.exportAudit = async function () {
    if (DEMO_MODE) {
      toast('Generating SOC 2 Type II Compliance Export Packet...', 'info');
      setTimeout(() => toast('Compliance packet ready: 1,847 entries, SHA-256 verified, JSON+CSV', 'success'), 1500);
      return;
    }
    const result = await api('/api/audit/export');
    if (result) toast(`Export ready: ${result.entries?.length || 0} entries`, 'success');
    else toast('Export failed', 'error');
  };

  window.toggleDemoMode = function () {
    DEMO_MODE = !DEMO_MODE;
    const btn = $('#demo-toggle-btn');
    const indicator = $('#demo-indicator');
    if (btn) btn.textContent = DEMO_MODE ? '🎭 Demo Data' : '🔌 Live API';
    if (indicator) {
      indicator.textContent = DEMO_MODE ? 'DEMO MODE' : 'LIVE';
      indicator.style.background = DEMO_MODE ? 'var(--amber-ghost)' : 'var(--green-ghost)';
      indicator.style.color = DEMO_MODE ? 'var(--amber-light)' : 'var(--green-light)';
    }
    toast(DEMO_MODE ? 'Switched to Demo Mode — showing curated sample data' : 'Switched to Live Mode — fetching from backend APIs', 'info');
    loadSection(currentSection);
  };

  window.dispatchTask = async function () {
    const taskType = $('#dispatch-task-type')?.value || 'risk_scan';
    const priority = $('#dispatch-priority')?.value || 'medium';
    if (DEMO_MODE) {
      toast(`Dispatching ${taskType} (${priority} priority) to Agent Swarm...`, 'info');
      setTimeout(() => toast(`Task routed to best agent. Result: completed in 47ms`, 'success'), 800);
      return;
    }
    const result = await api('/api/orchestrator/task', { method: 'POST', body: { taskType, priority } });
    if (result) toast(`Task ${result.taskId}: ${result.status}`, result.status === 'completed' ? 'success' : 'warning');
    else toast('Task dispatch failed', 'error');
  };

  window.purchaseResource = async function (resourceId) {
    if (DEMO_MODE) {
      toast(`Initiating x402 purchase: ${resourceId}...`, 'info');
      setTimeout(() => toast(`402 Payment Required → Evaluating cost-benefit...`, 'info'), 500);
      setTimeout(() => toast(`Cost-benefit score: 82/100 → Approved. Paying USDC on Base...`, 'info'), 1200);
      setTimeout(() => toast(`✅ Payment confirmed! Resource delivered. tx: 0x3f2a...8c1d`, 'success'), 2000);
      return;
    }
    const result = await api('/api/x402/purchase', { method: 'POST', body: { resourceId, agentId: 'ridhwan-agent-01', walletBalance: 1000 } });
    if (result) toast(`x402 ${result.status}: $${result.amount} USDC${result.txHash ? ' tx: ' + result.txHash.slice(0, 10) + '...' : ''}`, result.status === 'verified' ? 'success' : 'warning');
    else toast('Purchase failed', 'error');
  };

  window.generateNarrative = async function () {
    if (DEMO_MODE) {
      toast('Generating narrative Moltbook post...', 'info');
      setTimeout(() => toast('📝 Narrative post generated! Story-driven, first-person agent voice with x402, risk, and orchestrator events.', 'success'), 1500);
      return;
    }
    const result = await api('/api/moltbook/narrative', { method: 'POST' });
    if (result) toast(`Narrative post: "${result.title}"`, 'success');
    else toast('Narrative generation failed', 'error');
  };

  // Expose to global for HTML onclick
  window._lastLoad = _lastLoad;
  window.loadOverview = loadOverview;
  window.toast = toast;

  // ============================================================
  //  JSON Syntax Highlighter
  // ============================================================
  function syntaxHighlight(obj) {
    const json = JSON.stringify(obj, null, 2);
    return json
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"([^"]+)"(?=\s*:)/g, '<span class="json-key">"$1"</span>')
      .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
  }

  // ============================================================
  //  INITIALIZATION
  // ============================================================
  function init() {
    // Nav click handlers
    $$('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const section = el.dataset.section;
        if (section) navigateTo(section);
      });
    });

    // Mobile sidebar toggle
    const toggle = $('#sidebar-toggle');
    const sidebar = $('#sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Hash-based navigation
    const hash = window.location.hash?.replace('#', '');
    if (hash && $(`#section-${hash}`)) {
      navigateTo(hash);
    } else {
      loadOverview();
    }

    // Try SSE connection (non-blocking)
    if (!DEMO_MODE) {
      setTimeout(connectSSE, 1000);
    }

    // Auto-refresh overview every 30s
    setInterval(() => {
      if (currentSection === 'overview') loadOverview();
    }, 30000);

    console.log('%c🛡️ RIDHWAN Dashboard Initialized', 'color: #6366f1; font-size: 14px; font-weight: bold');
    console.log(`%cMode: ${DEMO_MODE ? 'DEMO' : 'LIVE'} | Sections: 15 | API Endpoints: 130+`, 'color: #8b95a5');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
