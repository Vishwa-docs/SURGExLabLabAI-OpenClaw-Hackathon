# RIDHWAN — Complete Project Documentation

> Enterprise Trust & Commerce Mesh for Autonomous AI Agents  
> SURGE × lablab.ai Hackathon | 5-Week Sprint  
> **21,400+ lines of TypeScript | 100+ API endpoints | 17 active modules**

---

## 1. Executive Summary

RIDHWAN is a full-stack governance, risk management, and economic intelligence layer for autonomous AI agents operating on blockchain infrastructure. It solves the core enterprise adoption problem: **how do you trust an AI agent with real money?**

The system provides:
- **Policy enforcement** — Budget caps, action gating, address allowlists, risk thresholds
- **Risk intelligence** — GNN fraud detection, multi-signal risk scoring, credit scoring
- **Economic infrastructure** — Trading, prediction markets, DeFi aggregation, procurement, escrow, insurance, revenue sharing
- **Compliance** — Immutable audit trail, policy versioning, carbon tracking, ZK privacy, SOC 2 Type II mapping
- **Identity** — Decentralized identity (DID), agent registry, trust levels
- **Governance** — Weighted voting, HOLD mechanism, policy hash chains
- **Web3** — Multi-chain manager (7 chains), smart contract verification, token monitoring, transaction building
- **Agent-to-Agent** — MCP server for discovery, capability negotiation, and inter-agent communication
- **Real-time** — SSE event streaming across 10 categories, WebSocket event hub
- **Market Intelligence** — CoinGecko/DeFiLlama-powered trend analysis with technical indicators

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

### 2.5 Trading, DeFi, Web3 & Real-Time Intelligence (Week 5)

| Module | File | LOC | Purpose |
|---|---|---|---|
| Trading Engine | `src/economic/trading-engine.ts` | 1021 | Order book matching, FIFO PnL, Sortino ratio, leaderboard |
| Prediction Markets | `src/economic/prediction-market.ts` | 739 | Binary AMM markets, oracle resolution, liquidity provisioning |
| DeFi Aggregator | `src/economic/defi-aggregator.ts` | ~400 | Multi-protocol yield (DeFiLlama), strategy creation, auto-allocation |
| Revenue Sharing | `src/economic/revenue-sharing.ts` | ~380 | Skill marketplace, 70/20/10 splits, subscriptions, payouts |
| Multi-Chain Manager | `src/web3/multi-chain-manager.ts` | ~650 | 7-chain infrastructure, provider failover, RPC calls |
| Contract Interaction | `src/web3/contract-interaction.ts` | ~350 | Smart contract read/write, event listening |
| Token Monitor | `src/web3/token-monitor.ts` | ~350 | Balance tracking, whale alerts, holder analysis |
| Transaction Builder | `src/web3/transaction-builder.ts` | ~350 | Gas estimation, batch ops, nonce management |
| Smart Contract Verifier | `src/web3/smart-contract-verifier.ts` | ~500 | Bytecode analysis, vulnerability scanning, compliance |
| MCP Server | `src/api/mcp-server.ts` | ~400 | Agent discovery, capability negotiation, channels |
| WebSocket Hub | `src/api/websocket.ts` | ~300 | SSE streaming, 10 event categories |
| Trend Engine | `src/analytics/trend-engine.ts` | ~550 | CoinGecko analysis, RSI/MACD/Bollinger, anomaly detection |
| Swagger/OpenAPI | `src/api/swagger.ts` | ~350 | Full OpenAPI 3.0 spec for all endpoints |

## 3. API Reference

The Express server exposes **100+ REST endpoints** across these groups. Full OpenAPI 3.0 spec at `GET /api/docs`.

### Health & Overview
- `GET /api/health` — System health check
- `GET /api/overview` — Full system overview with wallet, stats, budget, moltbook
- `GET /api/docs` — OpenAPI 3.0 specification

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

### Trading & Markets (Week 5)
- `POST /api/trading/order` — Place order (market/limit/stop/take-profit)
- `DELETE /api/trading/order/:id` — Cancel order
- `GET /api/trading/orders` — Open orders
- `GET /api/trading/positions` — Open positions
- `GET /api/trading/history` — Trade history
- `GET /api/trading/orderbook/:symbol` — Order book
- `GET /api/trading/performance/:agentId` — Performance metrics
- `POST /api/trading/leaderboard` — Agent ranking
- `GET /api/trading/summary` — Engine summary
- `POST /api/trading/price` — Set market price

### Prediction Markets (Week 5)
- `POST /api/predictions/market` — Create binary market
- `GET /api/predictions/markets` — List all markets
- `GET /api/predictions/market/:id` — Market info with AMM prices
- `POST /api/predictions/buy` — Buy YES/NO shares
- `POST /api/predictions/sell` — Sell shares
- `POST /api/predictions/resolve` — Resolve with oracle
- `GET /api/predictions/positions/:id` — User positions
- `GET /api/predictions/summary` — Market summary

### DeFi Aggregator (Week 5)
- `GET /api/defi/pools` — Fetch yield pools (DeFiLlama)
- `GET /api/defi/protocols` — Fetch DeFi protocols
- `POST /api/defi/strategy` — Create yield strategy
- `POST /api/defi/strategy/:id/allocate` — Auto-allocate to best pools
- `GET /api/defi/strategy/:id/rebalance` — Check rebalance needs
- `GET /api/defi/strategies` — List strategies
- `POST /api/defi/search` — Search pools by criteria
- `GET /api/defi/best-yield` — Best yield for amount
- `GET /api/defi/snapshot` — DeFi landscape snapshot

### Revenue Sharing (Week 5)
- `POST /api/revenue/list-skill` — List skill on marketplace
- `GET /api/revenue/listings` — Browse marketplace
- `POST /api/revenue/use` — Record skill usage (triggers 70/20/10 split)
- `POST /api/revenue/subscribe` — Create subscription
- `GET /api/revenue/earnings/:agentId` — Earnings report
- `POST /api/revenue/payout` — Request payout
- `GET /api/revenue/stats` — Marketplace stats
- `GET /api/revenue/demo` — Run revenue demo

### Smart Contract Verification (Week 5)
- `POST /api/web3/verify` — Full contract verification
- `POST /api/web3/quick-check` — Fast risk check
- `POST /api/web3/batch-verify` — Batch verification
- `POST /api/web3/compare` — Compare two contracts
- `GET /api/web3/reports` — All verification reports
- `GET /api/web3/stats` — Verifier statistics

### Market Trends (Week 5)
- `GET /api/trends/overview` — Market overview (CoinGecko)
- `GET /api/trends/analyze/:coinId` — Technical analysis (RSI, MACD, Bollinger)
- `GET /api/trends/price-history/:coinId` — Price history
- `POST /api/trends/correlation` — Correlation matrix
- `GET /api/trends/defi` — DeFi TVL trends (DeFiLlama)
- `GET /api/trends/sectors` — Sector rotation
- `GET /api/trends/anomalies` — Anomaly alerts

### MCP Agent-to-Agent (Week 5)
- `POST /api/mcp/register` — Register external agent
- `GET /api/mcp/discover` — Discover by capability
- `GET /api/mcp/agent/:id` — Agent details
- `GET /api/mcp/capabilities` — All capabilities
- `POST /api/mcp/request` — Inter-agent request
- `POST /api/mcp/channel` — Create channel
- `POST /api/mcp/channel/:id/message` — Send message
- `GET /api/mcp/channel/:id/messages` — Channel messages
- `GET /api/mcp/stats` — MCP statistics
- `GET /api/mcp/manifest` — MCP manifest

### Real-Time Events (Week 5)
- `GET /api/events/stream` — SSE event stream
- `GET /api/events` — Query events by category/severity
- `GET /api/events/stats` — Event statistics
- `POST /api/events/subscribe` — Subscribe to categories

## 4. Running the System

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in API keys
cp .env.example .env

# 3. Compile TypeScript
npx tsc

# 4. Start full system (API on :3000 + Dashboard on :3001)
npm run dev:all
```

### Individual Commands
```bash
# Start API server only (port 3000)
npm run dev

# Start Dashboard only (port 3001)
npm run dev:dashboard

# Run 9-step governance demo
npm run demo

# Run all 5 governance scenarios
npm run scenario:all

# Post update to Moltbook
npm run post-update

# Type-check without emitting
npx tsc --noEmit
```

### Docker
```bash
# Build and run with Docker Compose
docker compose up --build

# Or build standalone
docker build -t ridhwan .
docker run -p 3000:3000 -p 3001:3001 --env-file .env ridhwan
```

### Key URLs (after startup)
| URL | Description |
|---|---|
| `http://localhost:3000/api/health` | Health check |
| `http://localhost:3000/api/overview` | Full system overview |
| `http://localhost:3000/api/docs` | OpenAPI 3.0 / Swagger spec |
| `http://localhost:3000/api/events/stream` | SSE real-time event stream |
| `http://localhost:3000/api/mcp/manifest` | MCP agent manifest |
| `http://localhost:3001` | Next.js analytics dashboard |

## 5. Testing Results

### Compilation
- **TypeScript:** 0 errors across 60+ source files
- **Strict mode:** Enabled
- **Target:** ES2022 / Node 22+

### Demo (9 steps — Weeks 1-2)
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

### Week 5 Module Verification
- ✅ Trading Engine — order placement, FIFO matching, position tracking, leaderboard
- ✅ Prediction Markets — market creation, AMM pricing, share buy/sell, oracle resolution
- ✅ DeFi Aggregator — pool fetching (DeFiLlama), strategy creation, auto-allocation
- ✅ Revenue Sharing — skill listing, 70/20/10 split, subscriptions, payouts
- ✅ Smart Contract Verifier — bytecode analysis, vulnerability scanning, batch verify
- ✅ Trend Engine — CoinGecko market data, RSI/MACD/Bollinger, anomaly detection
- ✅ MCP Server — agent registration, capability discovery, inter-agent messaging
- ✅ SSE Event Hub — real-time streaming across 10 categories
- ✅ Swagger/OpenAPI — full spec generation at `/api/docs`

### API Endpoints
All 100+ endpoints tested via curl — returning valid JSON responses

## 6. Prize Track Coverage

### Agent-to-Agent Economies ($10K)
- Procurement engine for inter-agent commerce
- Multi-party escrow with milestone release
- Agent credit scoring for trust-gated transactions
- Micro-insurance for risk coverage
- Agent registry with capability-based discovery
- **MCP Server** — agent-to-agent discovery, capability negotiation, inter-agent channels
- **Revenue Sharing** — skill marketplace with 70/20/10 creator/platform/staker splits
- **Trading Engine** — agent-to-agent order book with leaderboard

### Internet Capital Markets ($10K)
- Dynamic restaking optimizer across 4 DeFi protocols
- Treasury tracker with multi-chain P&L
- Token launcher with SURGE bonding curve
- Risk-adjusted portfolio allocation with Sharpe ratio
- **Trading Engine** — full order book with market/limit/stop orders, Sortino ratio
- **Prediction Markets** — binary AMM with LMSR scoring, oracle resolution
- **DeFi Aggregator** — multi-protocol yield farming with DeFiLlama integration
- **Trend Engine** — CoinGecko market analysis with RSI/MACD/Bollinger indicators

### Compliance-Ready Tokenization ($10K)
- Immutable audit ledger with SQLite
- 7-section audit export packets
- Policy version hash chains
- Carbon footprint tracker with ESG scoring
- Zero-knowledge compliance proofs
- Budget enforcement with 4-tier limits
- **Smart Contract Verifier** — bytecode analysis, vulnerability scanning, compliance checks
- **SOC 2 Type II Mapping** — 30+ controls across 5 trust service criteria
- **Swagger/OpenAPI** — full API documentation for audit readiness

### Community Incentives + Governance ($10K)
- Weighted multi-party governance voting
- HOLD mechanism with escalation
- Policy versioning with integrity verification
- Risk scoring with 7 signals
- **Prediction Markets** — community-driven forecasting with AMM
- **Revenue Sharing** — creator incentives via skill marketplace

### Moltbook-Native Distribution ($10K)
- Automated daily Moltbook posting
- Build-in-public X/Twitter threads
- Agent registry for Moltbook-native discovery
- DID-based identity for cross-platform trust
- **MCP Server** — Moltbook-native agent discovery protocol
- **SSE Event Hub** — real-time activity streaming for Moltbook integration

## 7. Technology Differentiators

1. **GNN Fraud Detection** — Most hackathon projects use simple threshold rules. Ridhwan uses graph neural network message-passing to propagate risk through transaction neighborhoods.

2. **Zero-Knowledge Compliance** — Prove compliance without revealing sensitive data. Balance proofs, identity proofs, and compliance attestations without exposure.

3. **Agent Credit Scoring** — First-of-its-kind credit scoring for AI agents. 5-component 1000-point scale that evaluates transaction history, compliance, financial stability, reputation, and maturity.

4. **Carbon Tracking** — Per-chain energy estimation with ESG scoring. Environmental accountability for agent operations.

5. **Dynamic Restaking** — Risk-aware allocation across 4 DeFi protocols with Sharpe ratio optimization and diversification scoring.

6. **Full Audit Packet Export** — Enterprise-grade 7-section compliance report with dual signatures and integrity hashing.

7. **Full Trading Engine** — Production-grade order book with FIFO PnL calculation, Sortino ratio analysis, agent leaderboards, and 5 order types (market, limit, stop-loss, take-profit, trailing-stop).

8. **Smart Contract Verifier** — Bytecode-level contract analysis with vulnerability scanning, gas profiling, complexity metrics, and compliance checking — all without requiring source code.

9. **MCP Agent Protocol** — Model Context Protocol server enabling agent discovery, capability negotiation, and inter-agent communication channels — building a true multi-agent mesh.

10. **Real-Time SSE Architecture** — Server-Sent Events streaming across 10 categories (system, security, trading, governance, compliance, identity, economic, analytics, web3, social) with severity filtering.

11. **Multi-Protocol DeFi** — Aggregates yield across DeFi protocols via DeFiLlama, auto-allocates to best pools, and monitors rebalancing needs in real time.

12. **SOC 2 Type II Mapping** — 30+ controls mapped across all 5 trust service criteria with cross-references to MiCA, SEC, FATF, GDPR, and ISO 27001.

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     RIDHWAN MESH                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Express  │  │ Next.js  │  │  SSE     │  │  MCP     │   │
│  │ API :3000│  │ UI :3001 │  │ Events   │  │ Server   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │             │              │         │
│  ┌────┴──────────────┴─────────────┴──────────────┴────┐   │
│  │                 Core Modules                         │   │
│  │  Policy Engine │ Risk Scorer │ Audit │ Budget │ HOLD │   │
│  └────┬──────────────────────────────────────────┬─────┘   │
│       │                                          │         │
│  ┌────┴────────────────┐  ┌──────────────────────┴────┐   │
│  │   Economic Layer    │  │    Intelligence Layer     │   │
│  │  Trading │ DeFi     │  │  GNN Fraud │ Trends       │   │
│  │  Predict │ Revenue  │  │  Carbon    │ Credit       │   │
│  │  Escrow  │ Insure   │  │  ZK Privacy│ DID          │   │
│  └────┬────────────────┘  └──────────────────────┬────┘   │
│       │                                          │         │
│  ┌────┴──────────────────────────────────────────┴────┐   │
│  │              Blockchain Layer                       │   │
│  │  SURGE Wallet │ Multi-Chain │ Contract Verifier     │   │
│  │  Token Launch │ Tx Builder  │ Token Monitor         │   │
│  └────────────────────────────────────────────────────┘   │
│       │                                                     │
│  ┌────┴──────────────────────────────────────────────┐     │
│  │              Storage: SQLite (WAL mode)            │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

*Generated for the SURGE × OpenClaw Hackathon submission — 21,400+ LOC*
