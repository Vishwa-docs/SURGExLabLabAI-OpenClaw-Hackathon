# RIDHWAN — Complete Project Documentation

> Enterprise Trust & Commerce Mesh for Autonomous AI Agents  
> SURGE × lablab.ai Hackathon | 4-Week Sprint

---

## 1. Executive Summary

RIDHWAN is a full-stack governance, risk management, and economic intelligence layer for autonomous AI agents operating on blockchain infrastructure. It solves the core enterprise adoption problem: **how do you trust an AI agent with real money?**

The system provides:
- **Policy enforcement** — Budget caps, action gating, address allowlists, risk thresholds
- **Risk intelligence** — GNN fraud detection, multi-signal risk scoring, credit scoring
- **Economic infrastructure** — Procurement, escrow, insurance, restaking optimization
- **Compliance** — Immutable audit trail, policy versioning, carbon tracking, ZK privacy
- **Identity** — Decentralized identity (DID), agent registry, trust levels
- **Governance** — Weighted voting, HOLD mechanism, policy hash chains

## 2. Module Inventory

### 2.1 Core Governance (Week 1)

| Module | File | Purpose |
|---|---|---|
| Agent Runtime | `src/agent/agent-runtime.ts` | Lifecycle management, action execution, hook pipeline |
| Policy Engine | `src/policy-engine/engine.ts` | 5 policy checks: action gating, budget, address, risk, API |
| Audit Ledger | `src/policy-engine/audit-ledger.ts` | Immutable SQLite action log |
| Budget Tracker | `src/policy-engine/budget-tracker.ts` | Per-tx, daily, weekly, monthly tracking |
| Policy Store | `src/policy-engine/policy-store.ts` | CRUD for policies in SQLite |
| Hook Manager | `src/agent/hooks/hook-manager.ts` | Priority-ordered pre/post hook pipeline |
| SURGE Wallet | `src/surge/wallet/wallet-manager.ts` | Real SURGE wallet API + dry-run mode |
| Token Launcher | `src/surge/token-launch/token-launcher.ts` | Token launch via SURGE bonding curve |
| Transfer Manager | `src/surge/transfers/transfer-manager.ts` | ETH/ERC-20 transfers via SURGE |
| x402 Gasless | `src/surge/x402/gasless-manager.ts` | Gasless transactions with fallback |
| Moltbook Client | `src/moltbook/moltbook-client.ts` | Full Moltbook API integration |
| Daily Poster | `src/moltbook/daily-poster.ts` | Automated daily build updates |
| X Thread Gen | `src/social/x-thread-generator.ts` | Twitter thread generation |

### 2.2 Advanced Governance & Economics (Week 2)

| Module | File | Purpose |
|---|---|---|
| HOLD Mechanism | `src/governance/hold-mechanism.ts` | Circuit breaker with time delays & escalation |
| Risk Scorer | `src/governance/risk-scorer.ts` | 7 weighted signals + z-score normalization |
| Cost Router | `src/economic/cost-router.ts` | Routes LLM calls across Azure/HuggingFace/local |
| Treasury Tracker | `src/economic/treasury-tracker.ts` | Multi-chain balances, cash flow, P&L |
| Skill Scanner | `src/security/skill-scanner.ts` | 15-pattern security rule engine |
| Action Loop | `src/surge/action-loop.ts` | Full lifecycle for transfers/launches |
| Scenario Runner | `src/scenarios/scenario-runner.ts` | 5 scenarios, 16 steps for validation |

### 2.3 Advanced Intelligence & Analytics (Week 3)

| Module | File | Purpose |
|---|---|---|
| GNN Fraud Engine | `src/risk-engine/gnn-fraud-engine.ts` | Graph NN message-passing, circular flow detection |
| DID Manager | `src/identity/did-manager.ts` | Ed25519 DID creation & credential issuance |
| Agent Registry | `src/identity/agent-registry.ts` | On-chain discovery with 4-tier trust levels |
| ZK Privacy | `src/identity/zk-privacy.ts` | Zero-knowledge proofs: balance, compliance, identity |
| Voting System | `src/governance/voting-system.ts` | Weighted multi-party consensus with quorum |
| Policy Versioning | `src/governance/policy-versioning.ts` | Hash-chain integrity for policy audit trail |
| Procurement Engine | `src/economic/procurement-engine.ts` | Vendor catalog, bidding, approval, settlement |
| Escrow Manager | `src/economic/escrow-manager.ts` | Milestone escrow with dispute & arbitration |
| Risk Dashboard | `src/analytics/risk-dashboard.ts` | Heatmap, Sankey flow, timeline, alerts |
| Carbon Tracker | `src/analytics/carbon-tracker.ts` | Per-chain energy → CO2, ESG scoring |
| Audit Export | `src/analytics/audit-export.ts` | 7-section compliance audit packet |

### 2.4 Hardening & Advanced Modules (Week 4)

| Module | File | Purpose |
|---|---|---|
| Restaking Optimizer | `src/economic/restaking-optimizer.ts` | Multi-service stake allocation, Sharpe ratio |
| Insurance Engine | `src/economic/insurance-engine.ts` | Premium calc, claim validation, loss pools |
| Credit Scoring | `src/agent/credit-scoring.ts` | 5-component 1000-point scoring, AAA–D grades |

## 3. API Reference

The Express server exposes 60+ REST endpoints across these groups:

### Health & Overview
- `GET /api/health` — System health check
- `GET /api/overview` — Full system overview with wallet, stats, budget, moltbook

### Policy Management
- `GET /api/policies` — List all policies
- `GET /api/policies/:id` — Get specific policy
- `PUT /api/policies/:id` — Update policy
- `POST /api/policies/:id/toggle` — Enable/disable policy

### Audit & Receipts
- `GET /api/audit` — Audit log entries
- `GET /api/receipts` — Compliance receipts
- `GET /api/receipts/:actionId` — Specific receipt
- `GET /api/audit/export` — Full 7-section audit packet

### Wallet & Budget
- `GET /api/wallet` — Wallet info
- `GET /api/budget` — Budget usage

### Actions
- `POST /api/actions/transfer` — Execute transfer
- `POST /api/actions/token-launch` — Launch token
- `GET /api/actions/summary` — Action loop summary

### Risk & Governance
- `GET /api/risk/assess` — Real-time risk assessment
- `GET /api/risk/trend` — Risk trend
- `GET /api/risk/stats` — Risk statistics
- `GET /api/hold/stats` — HOLD mechanism stats
- `GET /api/hold/active` — Active holds
- `POST /api/governance/proposal` — Create governance proposal
- `POST /api/governance/vote` — Cast weighted vote
- `GET /api/governance/proposal/:id/tally` — Vote tally
- `GET /api/governance/demo` — Run voting demo

### Identity & Privacy
- `POST /api/identity/did/create` — Create DID
- `GET /api/identity/did/:did` — Resolve DID
- `POST /api/identity/credential/issue` — Issue credential
- `POST /api/identity/credential/verify` — Verify credential
- `POST /api/registry/register` — Register agent
- `GET /api/registry/discover` — Discover agents
- `GET /api/registry/trust/:agentId` — Trust lookup
- `POST /api/privacy/obfuscate` — Obfuscate address
- `POST /api/privacy/proof/balance` — Balance proof
- `POST /api/privacy/proof/compliance` — Compliance proof
- `POST /api/privacy/proof/verify` — Verify ZK proof

### Economics
- `POST /api/cost-router/route` — Route LLM call
- `GET /api/cost-router/usage` — Usage stats
- `GET /api/treasury/snapshot` — Treasury snapshot
- `GET /api/treasury/stats` — Treasury stats
- `POST /api/procurement/request` — Create procurement request
- `GET /api/procurement/demo` — Run procurement demo
- `POST /api/escrow/create` — Create escrow
- `GET /api/escrow/demo` — Run escrow demo
- `POST /api/restaking/optimize` — Optimize restaking
- `POST /api/insurance/policy` — Issue insurance policy
- `POST /api/insurance/claim` — Submit claim
- `GET /api/insurance/pool` — Coverage pool status
- `GET /api/insurance/demo` — Run insurance demo
- `GET /api/credit/score/:agentId` — Compute credit score
- `GET /api/credit/demo` — Run credit scoring demo
- `POST /api/credit/compare` — Compare agents

### Analytics
- `GET /api/dashboard/snapshot` — Risk dashboard data
- `GET /api/carbon/report` — Carbon footprint report
- `GET /api/carbon/esg` — ESG score
- `POST /api/carbon/record` — Record transaction for carbon tracking
- `GET /api/fraud/assess/:address` — GNN fraud assessment
- `GET /api/fraud/demo` — Run fraud detection demo
- `POST /api/fraud/transaction` — Record transaction for fraud analysis

### Social
- `GET /api/social/x-thread` — Generate daily X thread
- `POST /api/social/x-thread/submission` — Generate submission thread
- `GET /api/moltbook/history` — Moltbook post history
- `POST /api/moltbook/post` — Post to Moltbook

### Scenarios
- `GET /api/scenarios` — List all scenarios
- `POST /api/scenarios/:id/run` — Run specific scenario
- `POST /api/scenarios/run-all` — Run all scenarios
- `GET /api/scenarios/history` — Scenario history

### Security
- `POST /api/skills/scan` — Scan skill for vulnerabilities
- `GET /api/skills/scan/demo` — Run scanner demo

## 4. Running the System

```bash
# Install dependencies
npm install

# Run 9-step feature demo
npm run demo

# Run all 5 governance scenarios
npm run scenario:all

# Start full system (API + Dashboard)
npm run dev:all

# Start API only
npm run dev

# Start Dashboard only
npm run dev:dashboard
```

## 5. Testing Results

### Compilation
- **TypeScript:** 0 errors across 40+ source files
- **Strict mode:** Enabled

### Demo (9 steps)
1. ✅ Policy Engine initialization
2. ✅ Audit Ledger — action logging
3. ✅ Wallet operations — SURGE wallet create/info
4. ✅ Token launch — bonding curve launch
5. ✅ Transfer — ETH/ERC-20 transfer
6. ✅ Hook pipeline — pre/post action hooks
7. ✅ Compliance receipts — audit trail
8. ✅ x402 Gasless — agent-sponsored gas
9. ✅ X Thread generation — build-in-public

### Scenarios (5/5 passing)
1. ✅ Normal Transfer — policy allows, action executes
2. ✅ Large Transfer HOLD — amount exceeds threshold, HOLD triggered
3. ✅ Malicious Transfer Block — blocked address detected, action denied
4. ✅ Skill Security Scanner — safe skill passes, malicious flagged
5. ✅ Multi-Step Workflow — full lifecycle: risk → hold → execute → audit

### API Endpoints
All 60+ endpoints tested via curl — returning valid JSON responses

## 6. Prize Track Coverage

### Agent-to-Agent Economies ($10K)
- Procurement engine for inter-agent commerce
- Multi-party escrow with milestone release
- Agent credit scoring for trust-gated transactions
- Micro-insurance for risk coverage
- Agent registry with capability-based discovery

### Internet Capital Markets ($10K)
- Dynamic restaking optimizer across 4 DeFi protocols
- Treasury tracker with multi-chain P&L
- Token launcher with SURGE bonding curve
- Risk-adjusted portfolio allocation with Sharpe ratio

### Compliance-Ready Tokenization ($10K)
- Immutable audit ledger with SQLite
- 7-section audit export packets
- Policy version hash chains
- Carbon footprint tracker with ESG scoring
- Zero-knowledge compliance proofs
- Budget enforcement with 4-tier limits

### Community Incentives + Governance ($10K)
- Weighted multi-party governance voting
- HOLD mechanism with escalation
- Policy versioning with integrity verification
- Risk scoring with 7 signals

### Moltbook-Native Distribution ($10K)
- Automated daily Moltbook posting
- Build-in-public X/Twitter threads
- Agent registry for Moltbook-native discovery
- DID-based identity for cross-platform trust

## 7. Technology Differentiators

1. **GNN Fraud Detection** — Most hackathon projects use simple threshold rules. Ridhwan uses graph neural network message-passing to propagate risk through transaction neighborhoods.

2. **Zero-Knowledge Compliance** — Prove compliance without revealing sensitive data. Balance proofs, identity proofs, and compliance attestations without exposure.

3. **Agent Credit Scoring** — First-of-its-kind credit scoring for AI agents. 5-component 1000-point scale that evaluates transaction history, compliance, financial stability, reputation, and maturity.

4. **Carbon Tracking** — Per-chain energy estimation with ESG scoring. Environmental accountability for agent operations.

5. **Dynamic Restaking** — Risk-aware allocation across 4 DeFi protocols with Sharpe ratio optimization and diversification scoring.

6. **Full Audit Packet Export** — Enterprise-grade 7-section compliance report with dual signatures and integrity hashing.

---

*Generated for the SURGE × OpenClaw Hackathon submission*
