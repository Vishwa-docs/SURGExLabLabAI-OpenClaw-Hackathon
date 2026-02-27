# 🛡️ RIDHWAN

**The Enterprise Trust & Commerce Mesh for Autonomous AI Agents**

> Built for the [SURGE × OpenClaw x lablab.ai Hackathon](https://lablab.ai/ai-hackathons/openclaw-surge-hackathon)

---

## What is Ridhwan?

AI agents are powerful, but enterprises won't trust them with real money without guardrails. **Ridhwan** is the governance backbone that makes autonomous agents enterprise-safe — providing trust, risk management, compliance, and economic intelligence as a unified layer.

Ridhwan sits between your AI agent and the blockchain, enforcing policies, tracking budgets, auditing every action, and generating compliance receipts — all in real time.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           RIDHWAN MESH v2.0                             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                  Multi-Agent Orchestrator                        │    │
│  │   risk-guard · policy-bot · trade-runner · compliance-ai         │    │
│  │                    trust-broker                                  │    │
│  └────────────────────────┬─────────────────────────────────────────┘    │
│                           │                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Policy   │  │  Budget  │  │  Audit   │  │   Risk   │  │  Trust   │  │
│  │  Engine   │  │ Tracker  │  │  Ledger  │  │  Scorer  │  │Delegatn  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │              │       │
│  ┌────┴──────────────┴──────────────┴──────────────┴──────────────┴──┐   │
│  │              Hook Interception Pipeline                           │   │
│  └──────────────────────┬────────────────────────────────────────────┘   │
│                         │                                                │
│  ┌──────────────────────┴────────────────────────────────────────┐      │
│  │                    Agent Runtime                               │      │
│  └──┬────────┬────────┬────────┬────────┬────────┬────────┬─────┘      │
│     │        │        │        │        │        │        │              │
│  ┌──┴──┐ ┌──┴──┐ ┌───┴──┐ ┌──┴───┐ ┌──┴──┐ ┌──┴──────┐ ┌──┴──┐      │
│  │SURGE│ │ x402│ │Molt- │ │ DID  │ │ GNN │ │Credit  │ │x402 │      │
│  │Wallt│ │ Gas │ │ book │ │Ident.│ │Fraud│ │ Score  │ │Comm.│      │
│  └─────┘ └─────┘ └──────┘ └──────┘ └─────┘ └────────┘ └─────┘      │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Governance│  │ Escrow & │  │Insurance │  │Restaking │  │Narrative │  │
│  │ Voting   │  │ Procure  │  │ Engine   │  │Optimizer │  │Generator │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Carbon  │  │  Audit   │  │  Risk    │  │ Policy   │  │  Agent   │  │
│  │ Tracker  │  │  Export  │  │Dashboard │  │Versioning│  │ Swarm UI │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
         │                │                        │
    ┌────┴────┐    ┌──────┴──────┐          ┌─────┴───────┐
    │  Base   │    │  Dashboard  │          │  Moltbook   │
    │(L2 EVM) │    │(HTML/CSS/JS)│          │Distribution │
    └─────────┘    └─────────────┘          └─────────────┘
```

## Features

### Core Governance (Week 1)
- **🛡️ Universal Policy Engine** — Action gating with allow/deny lists, budget caps, risk scoring, and human-in-the-loop approvals
- **💰 SURGE Wallet Integration** — Server-managed wallets on Base (Coinbase L2), token launch, and trading via OpenClaw
- **📊 Immutable Audit Ledger** — Every action recorded in SQLite with full receipts and compliance metadata
- **🔗 Hook Interception System** — Pre/post action processing pipeline for policy enforcement and audit logging
- **📱 Web Dashboard with Demo Mode** — Real-time monitoring dashboard with 15 interactive sections and a **Demo Mode toggle** that switches between rich pre-populated dummy data (for presentations) and live API calls hitting 130+ real backend endpoints
- **⛽ x402 Gasless Transactions** — Agent-sponsored gas via the x402 open payment protocol
- **🦞 Moltbook Integration** — Automated daily build updates posted to the lablab submolt
- **🐦 X/Twitter Thread Generator** — Auto-generated build-in-public threads with daily stats

### Advanced Governance & Economics (Week 2)
- **⏸️ HOLD Mechanism** — Delay-based circuit breaker with escalation for dangerous actions
- **📈 Risk Scoring Engine** — 7 weighted signals + z-score normalization for real-time risk assessment
- **🧠 Intelligent Cost Router** — Routes LLM calls across Azure OpenAI, HuggingFace & local templates to minimize cost
- **💎 Treasury Tracker** — Multi-chain balance monitoring, cash flow analysis, and financial health scoring
- **🔍 Skill Security Scanner** — 15-pattern rule engine scanning agent skills for malicious code
- **🎯 Scenario Runner** — 5 pre-built scenarios with 16 total steps for end-to-end validation
- **⚡ SURGE Action Loop** — Full lifecycle management for transfers, token launches, and irreversible actions

### Advanced Intelligence & Analytics (Week 3)
- **🕸️ GNN Fraud Detection** — Graph Neural Network message-passing for neighborhood risk propagation and circular flow detection
- **🆔 Decentralized Identity (DID)** — Ed25519 key-based identity with verifiable credentials issuance
- **📋 Agent Registry** — On-chain discovery with 4-tier trust levels (untrusted → enterprise)
- **🔐 Zero-Knowledge Privacy** — ZK proofs for balance verification, compliance attestation, and identity without exposure
- **🗳️ Governance Voting** — Weighted multi-party consensus with quorum, threshold, and on-chain anchoring
- **📝 Policy Version Hashing** — Hash-chain integrity verification for policy audit trails
- **🛒 Agent Procurement** — Vendor catalog, bidding, approval workflow, and settlement for inter-agent commerce
- **🔒 Multi-Party Escrow** — Milestone-based escrow with dispute resolution and arbitration
- **📊 Risk Dashboard** — Real-time heatmap, Sankey money flow, timeline, and alert data
- **🌍 Carbon Footprint Tracker** — Per-chain energy estimation with ESG scoring and environmental equivalents
- **📋 Audit Export** — 7-section compliance packet (executive summary, action log, policy versions, risk, carbon, compliance, recommendations)

### Hardening & Advanced Modules (Week 4)
- **📊 Dynamic Restaking Optimizer** — Risk-aware allocation across EigenLayer, Symbiotic, Karak, Kelp DAO; Sharpe ratio and diversification scoring
- **🏥 Agent Micro-Insurance** — Premium calculation based on risk score, automatic claim validation, loss coverage pools
- **💳 Agent Credit Scoring** — 5-component 1000-point scale (AAA–D grades), credit limits, multi-agent comparison

### Trading, DeFi, Web3 & Real-Time Intelligence (Week 5)
- **📈 Multi-Asset Trading Engine** — Order book matching (market/limit/stop/take-profit), FIFO PnL accounting, Sortino ratio, agent leaderboard, and position tracking across any token pair
- **🎯 Prediction Markets** — Binary markets with constant-product AMM, liquidity provisioning, oracle-based resolution, and hedge cost calculation
- **🌾 DeFi Yield Aggregator** — Multi-protocol yield tracking via DeFiLlama API; strategy creation (single_pool, stable_yield, delta_neutral, leveraged_yield); auto-allocation via risk-parity; rebalance monitoring
- **💸 Revenue Sharing Engine** — Agent skill marketplace with 70/20/10 splits (creator/platform/referrer); per-use, subscription, and perpetual licensing; payout tracking
- **🔗 Multi-Chain Manager** — 7-chain infrastructure (Ethereum, Base, Polygon, Arbitrum, BSC, Optimism, Solana) with provider failover and cross-chain monitoring
- **📜 Smart Contract Verifier** — Bytecode analysis for ERC-20/721/1155 detection, vulnerability scanning (reentrancy, selfdestruct, delegatecall, tx.origin, honeypot), proxy detection, and MiCA/SEC/FATF/SOC2 compliance checks
- **🔨 Transaction Builder** — Gas estimation, multi-chain tx construction, batch operations, and nonce management
- **📡 Token Monitor** — Real-time token balance tracking, whale alert detection, and holder analysis
- **📶 MCP Agent Server** — Model Context Protocol for agent-to-agent discovery, capability negotiation, inter-agent request/response, and communication channels
- **🔴 WebSocket Event Hub** — Real-time SSE event broadcasting across 10 categories (risk, policy, audit, trade, price, agent, MCP, governance, compliance, system)
- **📊 Market Trend Engine** — CoinGecko-powered analysis with RSI, MACD, EMA, Bollinger Bands, ATR, OBV; sector rotation detection; Pearson correlation matrices; anomaly alerts
- **📖 OpenAPI/Swagger** — Full OpenAPI 3.0 spec for all 130+ API endpoints
- **🐳 Docker** — Multi-stage production build with health checks, non-root execution, and compose orchestration
- **🏛️ SOC 2 Type II Mapping** — 30+ controls mapped across Security, Availability, Processing Integrity, Confidentiality, and Privacy

### Multi-Agent Mesh & Autonomous Commerce (Week 6)
- **🤖 Multi-Agent Orchestrator** — 5 specialized sub-agents (risk-guard, policy-bot, trade-runner, compliance-ai, trust-broker) with automatic task routing across 20+ task types, pipeline execution for multi-step workflows (transfer, trade, token launch, x402 payment), and real-time agent coordination
- **💳 x402 Autonomous Commerce** — HTTP 402 Payment Required protocol for agent-to-agent paid services (fraud-scan, risk-report, compliance-packet, contract-verify, market-intel, credit-score) with automatic cost-benefit evaluation, payment verification, and resource delivery
- **🔑 Trust Delegation System** — Depth-limited, constraint-scoped capability chains where permissions follow people, not software. 10 capabilities (transfer, trade, read-balance, risk-scan, contract-deploy, governance-vote, compliance-audit, moltbook-post, agent-spawn, x402-pay) with cascade revocation
- **📖 LLM Narrative Moltbook Posts** — Story-driven, first-person agent voice for Moltbook posts with dramatic openers, 5 narrative types (risk, trade, x402, orchestrator, trust), agent-to-agent conversations, and 5 writing styles (dramatic, technical, reflective, triumphant, cautionary)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22+ / TypeScript |
| Agent Framework | OpenClaw |
| Blockchain | SURGE on Base (Coinbase L2) |
| Multi-Chain | Ethereum, Base, Polygon, Arbitrum, BSC, Optimism, Solana |
| Gasless Txns | x402 Protocol |
| Database | SQLite (better-sqlite3) |
| Dashboard | Vanilla HTML/CSS/JS (zero-dependency, served from Express) |
| Validation | Zod |
| Logging | Winston |
| Social | Moltbook API, X/Twitter API v2 |
| Observability | Langfuse |
| LLM | Azure OpenAI (GPT-4o) |
| Identity | DID (Ed25519) + ZK Proofs |
| Risk ML | GNN message-passing (TypeScript) |
| Market Data | CoinGecko, DeFiLlama |
| Protocol | Model Context Protocol (MCP) |
| Real-Time | Server-Sent Events (SSE) |
| Containerization | Docker + Docker Compose |
| Compliance | SOC 2 Type II, MiCA, FATF |

## Project Structure

```
src/
├── agent/                     # Agent runtime & lifecycle
│   ├── agent-runtime.ts       # Core runtime engine
│   ├── types.ts               # Agent action types
│   ├── credit-scoring.ts      # Agent credit scoring engine
│   ├── orchestrator.ts        # Multi-agent orchestrator (5 sub-agents)
│   ├── x402-commerce.ts       # x402 autonomous commerce engine
│   ├── heartbeat/             # Cron scheduler
│   └── hooks/                 # Pre/post action hooks
├── analytics/                 # Analytics & reporting
│   ├── risk-dashboard.ts      # Risk dashboard data provider
│   ├── carbon-tracker.ts      # Carbon footprint tracker
│   ├── audit-export.ts        # Audit packet export
│   └── trend-engine.ts        # Market trend analysis (RSI, MACD, Bollinger)
├── api/
│   ├── server.ts              # Express REST API (130+ endpoints)
│   ├── mcp-server.ts          # MCP agent discovery & communication
│   ├── websocket.ts           # SSE event hub (10 categories)
│   └── swagger.ts             # OpenAPI 3.0 spec
├── dashboard/                 # Legacy dashboard (unused)
public/                        # Web dashboard UI
├── index.html                 # Dashboard HTML (15 sections)
├── styles.css                 # Dark-theme CSS (2,900+ lines)
└── app.js                     # Dashboard JS (1,900+ lines)
├── economic/                  # Economic intelligence
│   ├── cost-router.ts         # LLM cost optimization
│   ├── treasury-tracker.ts    # Multi-chain treasury
│   ├── procurement-engine.ts  # Agent procurement workflow
│   ├── escrow-manager.ts      # Multi-party escrow
│   ├── restaking-optimizer.ts # Dynamic restaking
│   ├── insurance-engine.ts    # Micro-insurance
│   ├── trading-engine.ts      # Multi-asset trading (1021 lines)
│   ├── prediction-market.ts   # Binary prediction markets (739 lines)
│   ├── defi-aggregator.ts     # DeFi yield aggregation
│   └── revenue-sharing.ts     # Agent skill marketplace
├── governance/                # Governance systems
│   ├── hold-mechanism.ts      # HOLD circuit breaker
│   ├── risk-scorer.ts         # Risk scoring engine
│   ├── voting-system.ts       # Governance voting
│   └── policy-versioning.ts   # Policy version hashing
├── identity/                  # Decentralized identity
│   ├── did-manager.ts         # DID management
│   ├── agent-registry.ts      # Agent discovery
│   ├── zk-privacy.ts          # Zero-knowledge proofs
│   └── trust-delegation.ts    # Trust delegation chains
├── moltbook/                  # Moltbook integration
│   ├── moltbook-client.ts     # Full Moltbook API client
│   ├── daily-poster.ts        # Automated daily updates
│   └── narrative-generator.ts # LLM narrative post generator
├── policy-engine/             # Core governance
│   ├── engine.ts              # Policy evaluation
│   ├── audit-ledger.ts        # Immutable audit log
│   ├── budget-tracker.ts      # Spending limits
│   └── policy-store.ts        # Policy CRUD
├── risk-engine/               # Advanced risk analysis
│   └── gnn-fraud-engine.ts    # GNN fraud detection
├── scenarios/                 # Scenario testing
│   └── scenario-runner.ts     # 5-scenario test suite
├── security/                  # Security scanning
│   └── skill-scanner.ts       # Skill security scanner
├── social/                    # Social integrations
│   └── x-thread-generator.ts  # Twitter threads
├── surge/                     # SURGE blockchain
│   ├── wallet/                # Wallet management
│   ├── token-launch/          # Token launcher
│   ├── transfers/             # Transfer manager
│   ├── x402/                  # Gasless transactions
│   └── action-loop.ts         # Action lifecycle
├── web3/                      # Multi-chain Web3
│   ├── multi-chain-manager.ts # 7-chain provider management
│   ├── contract-interaction.ts# Smart contract calls
│   ├── token-monitor.ts       # Token balance tracking
│   ├── transaction-builder.ts # TX construction & gas estimation
│   └── smart-contract-verifier.ts # Bytecode security analysis
└── utils/                     # Config & logging
Dockerfile                     # Multi-stage production build
docker-compose.yml             # Container orchestration
Documentation/
├── SOC2-Control-Mapping.md    # SOC 2 Type II compliance mapping
├── FINAL-Project-Documentation.md
└── ...
demo/
├── run-demo.ts                # 9-step feature demo
└── run-scenarios.ts           # 5-scenario validation
```

## API Endpoints (130+)

### Core
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/overview` | Full system overview |
| GET | `/api/docs` | OpenAPI 3.0 spec |
| GET | `/api/policies` | List all policies |
| GET | `/api/audit` | Audit log entries |
| GET | `/api/wallet` | Wallet info |
| GET | `/api/budget` | Budget usage |
| GET | `/api/receipts` | Compliance receipts |

### Governance & Risk
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/risk/assess` | Real-time risk assessment |
| GET | `/api/risk/trend` | Risk trend over time |
| GET | `/api/hold/active` | Active HOLD delays |
| POST | `/api/governance/proposal` | Create governance proposal |
| POST | `/api/governance/vote` | Cast weighted vote |
| GET | `/api/governance/demo` | Run voting demo |

### Identity & Privacy
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/identity/did/create` | Create DID |
| POST | `/api/registry/register` | Register agent |
| GET | `/api/registry/discover` | Discover agents |
| POST | `/api/privacy/proof/balance` | Generate balance proof |
| POST | `/api/privacy/proof/compliance` | Generate compliance proof |

### Trading & Markets
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/trading/order` | Place trade order |
| DELETE | `/api/trading/order/:id` | Cancel order |
| GET | `/api/trading/positions` | View open positions |
| GET | `/api/trading/orderbook/:sym` | Order book for symbol |
| GET | `/api/trading/performance/:id` | Agent performance metrics |
| POST | `/api/trading/leaderboard` | Agent ranking |
| POST | `/api/predictions/market` | Create prediction market |
| POST | `/api/predictions/buy` | Buy YES/NO shares |
| POST | `/api/predictions/resolve` | Resolve market with oracle |

### DeFi & Revenue
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/defi/pools` | Fetch yield pools (DeFiLlama) |
| POST | `/api/defi/strategy` | Create yield strategy |
| POST | `/api/defi/strategy/:id/allocate` | Auto-allocate capital |
| GET | `/api/defi/best-yield` | Find best yield for amount |
| POST | `/api/revenue/list-skill` | List skill on marketplace |
| POST | `/api/revenue/use` | Record skill usage |
| GET | `/api/revenue/earnings/:id` | Agent earnings report |

### Web3 & Smart Contracts
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/web3/verify` | Full contract verification |
| POST | `/api/web3/quick-check` | Fast risk check |
| POST | `/api/web3/batch-verify` | Batch verification |
| POST | `/api/web3/compare` | Compare two contracts |

### MCP Agent-to-Agent
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/mcp/register` | Register agent |
| GET | `/api/mcp/discover` | Discover by capability |
| POST | `/api/mcp/request` | Send inter-agent request |
| POST | `/api/mcp/channel` | Create communication channel |
| GET | `/api/mcp/manifest` | MCP capability manifest |

### Real-Time Events
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/events/stream` | SSE event stream |
| GET | `/api/events` | Query events by category |
| POST | `/api/events/subscribe` | Subscribe to event categories |

### Market Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/trends/overview` | Market overview (CoinGecko) |
| GET | `/api/trends/analyze/:coin` | Technical analysis |
| GET | `/api/trends/sectors` | Sector rotation analysis |
| GET | `/api/trends/anomalies` | Price anomaly alerts |

### Economics
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/procurement/request` | Create procurement request |
| POST | `/api/escrow/create` | Create escrow contract |
| POST | `/api/restaking/optimize` | Optimize restaking allocation |
| POST | `/api/insurance/policy` | Issue insurance policy |
| POST | `/api/insurance/claim` | Submit insurance claim |
| GET | `/api/credit/score/:agentId` | Compute credit score |
| GET | `/api/credit/demo` | Run credit scoring demo |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/snapshot` | Risk dashboard data |
| GET | `/api/carbon/report` | Carbon footprint report |
| GET | `/api/carbon/esg` | ESG score |
| GET | `/api/audit/export` | Full audit packet |
| GET | `/api/fraud/demo` | GNN fraud detection demo |

### Multi-Agent Orchestrator
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/orchestrator/agents` | List all sub-agents |
| GET | `/api/orchestrator/stats` | Orchestrator statistics |
| GET | `/api/orchestrator/tasks` | Recent task history |
| GET | `/api/orchestrator/pipelines` | Recent pipeline executions |
| GET | `/api/orchestrator/pipeline-templates` | Available pipeline templates |
| POST | `/api/orchestrator/task` | Dispatch task to sub-agent |
| POST | `/api/orchestrator/pipeline` | Execute multi-step pipeline |

### x402 Autonomous Commerce
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/x402/resources` | List priced resources |
| GET | `/api/x402/stats` | Commerce statistics |
| GET | `/api/x402/payments` | Recent payment history |
| GET | `/api/x402/transactions` | Transaction ledger |
| POST | `/api/x402/request` | Create payment request |
| POST | `/api/x402/pay` | Record a payment |
| POST | `/api/x402/verify` | Verify and deliver resource |
| POST | `/api/x402/purchase` | Full purchase flow |

### Trust Delegation
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/trust/capabilities` | List all capabilities |
| GET | `/api/trust/delegations` | View all delegations |
| GET | `/api/trust/stats` | Trust system statistics |
| GET | `/api/trust/agent/:agentId/capabilities` | Agent's capabilities |
| GET | `/api/trust/agent/:agentId/chain` | Agent's trust chain |
| POST | `/api/trust/check` | Check permission |
| POST | `/api/trust/delegate` | Create delegation |
| POST | `/api/trust/revoke` | Revoke delegation (cascade) |

### Narrative Moltbook Posts
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/moltbook/narrative` | Generate narrative post |
| POST | `/api/moltbook/narrative/conversation` | Generate agent conversation |
| GET | `/api/moltbook/narrative/history` | Narrative history |

## Getting Started

### Prerequisites

- **Node.js 18+** (22+ recommended) — [Download](https://nodejs.org)
- **npm 9+** (comes with Node.js)
- **Git** — [Download](https://git-scm.com)
- **OpenClaw CLI** (optional) — `npm install -g openclaw@latest`

### 1. Clone & Install

```bash
git clone https://github.com/Vishwa-docs/SURGExLabLabAI-OpenClaw-Hackathon.git
cd SURGExLabLabAI-OpenClaw-Hackathon
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

| Key | Where to get it | Cost | Required? |
|---|---|---|---|
| `SURGE_API_KEY` | [app.surge.xyz](https://app.surge.xyz) → Profile → API Keys | Free | Yes (or runs in dry-run mode) |
| `MOLTBOOK_API_KEY` | Run `npm run moltbook:register` | Free | For Moltbook posting |
| `AZURE_OPENAI_*` | [Azure Portal](https://portal.azure.com) | Free tier available | For LLM features |
| `HUGGINGFACE_API_KEY` | [huggingface.co](https://huggingface.co) | Free | For LLM fallback |
| `LANGFUSE_*` | [cloud.langfuse.com](https://cloud.langfuse.com) | Free tier | For observability |
| `TWITTER_*` | [developer.x.com](https://developer.x.com) | Free tier | For X thread posting |

> **Cost Safety:** All services are either free or run in dry-run/simulation mode. No real money is spent. SURGE wallets use free Base Sepolia testnet funding.

### 3. Compile & Run

```bash
# Compile TypeScript (0 errors expected)
npx tsc

# Start the server
node dist/src/index.js
```

You'll see the startup banner, then **open your browser to [http://localhost:3000](http://localhost:3000)** to access the full dashboard UI.

The dashboard features:
- **Demo Mode (ON by default)** — starts with rich pre-populated enterprise-grade dummy data for presentations
- **Live Mode** — toggle Demo Mode OFF to hit 130+ real backend API endpoints in real-time
- 15 interactive sections (Overview, Policies, Risk & Fraud, Trading, DeFi, Governance, Identity, Audit, Web3, Actions, Events, Trends, Agent Swarm, x402 Commerce, Trust Delegation)
- Real-time SSE event streaming
- Interactive forms for trading, governance proposals, DID creation, contract verification, task dispatch, x402 purchases, and more
- Auto-refreshing data with live system status

### 4. Open the Dashboard

Open **http://localhost:3000** in your browser. The dashboard starts in **Demo Mode** with rich pre-populated data. Click the **"Toggle Demo Mode"** button in the sidebar footer to switch between demo data and live backend API calls.

The full web dashboard loads instantly with:
- **Overview** — System health, actions executed/blocked, wallet, budget, recent actions
- **Policies** — Toggle and inspect all 5 governance policies
- **Risk & Fraud** — GNN fraud detection, risk gauge, HOLD mechanism, trend history
- **Trading** — Place orders (market/limit/stop), view order book, positions, performance, leaderboard
- **DeFi** — Browse yield pools, create strategies, find best yield
- **Governance** — Create proposals, cast weighted votes, run governance demo
- **Identity** — Create DIDs, register agents, view credit scores, MCP discovery
- **Audit** — Immutable audit log, download compliance packet, carbon report, ESG score
- **Web3** — Verify smart contracts (7 chains), vulnerability scanning
- **Live Events** — Real-time SSE stream across 10 event categories
- **Trends** — Market overview (CoinGecko), coin analysis (RSI/MACD/Bollinger), anomaly alerts
- **Agent Swarm** — Multi-agent orchestrator with 5 sub-agents, task dispatch, pipeline execution
- **x402 Commerce** — Autonomous agent economy, purchase resources, cost-benefit analysis
- **Trust Delegation** — Capability chains, permission verification, cascade revocation
- **Moltbook** — Narrative posts, agent conversations, storytelling engine

Alternatively, test via CLI:
```bash
curl -s http://localhost:3000/api/health | jq
curl -s http://localhost:3000/api/overview | jq
bash scripts/test-all.sh   # 86 automated tests
```

### 5. Alternative Run Methods

```bash
# One-command start (installs, compiles, runs everything)
./scripts/start.sh

# Backend-only (port 3000)
npm run dev

# Backend + Dashboard (port 3000)
npm run dev:all

# Docker (full system)
docker compose up --build

# Run the 9-step feature demo
npm run demo

# Run all 5 governance scenarios
npm run scenario:all
```

### Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start backend agent (port 3000) |
| `npm run dev:all` | Start agent (dashboard included at port 3000) |
| `npm run build` | Compile TypeScript |
| `npm run demo` | Run the 9-step feature demo |
| `npm run scenario:all` | Run all 5 governance scenarios |
| `npm run moltbook:register` | Register agent on Moltbook |
| `npm run moltbook:post` | Post build update to lablab |
| `npm run heartbeat` | Run a single heartbeat post |

### Key URLs (when running)

| URL | Description |
|---|---|
| http://localhost:3000 | **Web Dashboard** (15 interactive sections) |
| http://localhost:3000/api/health | Health check |
| http://localhost:3000/api/overview | Full system overview |
| http://localhost:3000/api/docs | OpenAPI 3.0 / Swagger spec |
| http://localhost:3000/api/events/stream | SSE real-time event stream |
| http://localhost:3000/api/mcp/manifest | MCP agent capability manifest |

## Demo Mode

The dashboard includes a **Demo Mode toggle** designed for presentations and demos:

| Mode | Indicator | Data Source | Use Case |
|---|---|---|---|
| **Demo Mode (ON)** | Orange "DEMO MODE" badge | Pre-populated dummy data | Presentations, video recording, showcasing all features |
| **Live Mode (OFF)** | Green "LIVE MODE" badge | Real backend API (130+ endpoints) | Production use, proving backend is real |

**How it works:**
- The dashboard starts in Demo Mode by default
- Click **"Toggle Demo Mode"** in the sidebar footer to switch
- Demo data includes realistic enterprise scenarios across all 15 sections: wallet balances, risk scores, trade orders, GNN fraud graphs, governance proposals, DID credentials, yield pools, smart contract verifications, agent swarm coordination, x402 commerce transactions, trust delegation chains, and more
- When you toggle to Live Mode, the dashboard makes real API calls to the backend — proving the entire system is functional, not just mocks
- **Demo tip:** During a presentation, keep Demo Mode ON for a polished walkthrough, then briefly toggle to Live Mode to prove the backend is real, then toggle back

## Prize Track Alignment

| Track | RIDHWAN Modules |
|---|---|
| **Agent-to-Agent Economies ($10K)** | MCP Server, Revenue Sharing, Procurement, Escrow, Insurance, Credit Scoring, Agent Registry, Prediction Markets, **Multi-Agent Orchestrator**, **x402 Autonomous Commerce**, **Trust Delegation** |
| **Internet Capital Markets ($10K)** | Trading Engine, DeFi Aggregator, Restaking Optimizer, Treasury Tracker, Token Launcher, Trend Engine, **x402 Commerce Protocol** |
| **Compliance-Ready Tokenization ($10K)** | Smart Contract Verifier, Policy Engine, Audit Export, Carbon Tracker, ZK Privacy, SOC 2 Mapping, MiCA/SEC/FATF checks, **Trust Delegation Chains** |
| **Community Incentives + Governance ($10K)** | Voting System, Policy Versioning, HOLD Mechanism, Prediction Markets, Revenue Sharing, **Multi-Agent Orchestrator** |
| **Moltbook-Native Distribution ($10K)** | Daily Poster, Build-in-Public Threads, Agent Registry, MCP Discovery, **LLM Narrative Posts**, **Agent-to-Agent Conversations** |

## Autonomous Agent Features

Ridhwan runs as a **self-operating agent**:

- **Multi-Agent Orchestrator** — Coordinates 5 specialized sub-agents (risk-guard, policy-bot, trade-runner, compliance-ai, trust-broker) autonomously
- **Heartbeat Scheduler** — Posts status updates to Moltbook every 24 hours automatically
- **Daily Poster** — Generates build summaries from audit data and publishes autonomously
- **Narrative Generator** — Creates story-driven, first-person Moltbook posts and agent-to-agent conversations
- **Risk Monitoring** — Continuously scores risk and flags anomalies
- **Policy Enforcement** — Every action goes through the governance pipeline without human intervention
- **x402 Commerce** — Agents buy and sell services autonomously using the HTTP 402 protocol
- **Trust Delegation** — Permissions cascade through delegation chains with automatic scope enforcement
- **Event Streaming** — Real-time SSE broadcasting across 10 event categories
- **MCP Discovery** — Other agents can discover and communicate with Ridhwan via the MCP protocol

When the server starts, the agent:
1. Creates/connects to SURGE wallet
2. Registers hooks (policy + audit)
3. Boots multi-agent orchestrator (5 sub-agents)
4. Initializes trust delegation chains
5. Starts x402 commerce engine (6 priced resources)
6. Starts heartbeat scheduler (auto Moltbook posting)
7. Starts daily poster with narrative generator
8. Registers itself on MCP with 8 capabilities
9. Seeds trading engine with market data
10. Pre-fetches DeFi yield pools
11. Opens API server on port 3000
12. Begins streaming events via SSE

## Team

Built for the SURGE × lablab.ai OpenClaw Hackathon.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

## Deployment Guide

Ridhwan can be deployed in multiple configurations — from a single local process to a containerized production setup.

### Option 1: Local Development (Recommended for Demos)

The fastest way to get running. Everything serves from a single Express process on port 3000.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with API keys (SURGE_API_KEY is free, others optional)

# 3. Compile & start
npx tsc
node dist/src/index.js

# Dashboard available at http://localhost:3000
# API endpoints at http://localhost:3000/api/*
```

**What starts:**
- Express server serving 130+ API endpoints
- Static file server for the dashboard (HTML/CSS/JS)
- SSE event stream on `/api/events/stream`
- MCP agent server on `/api/mcp/*`
- Multi-agent orchestrator with 5 sub-agents
- x402 commerce engine with 6 priced resources
- Trust delegation manager
- Heartbeat scheduler (Moltbook auto-posting)
- All 20+ modules initialize in ~2 seconds

### Option 2: Docker (Production)

Uses a multi-stage Dockerfile that compiles TypeScript, then copies only `dist/` and `node_modules/` into a minimal runtime image.

```bash
# Build and run with Docker Compose
docker compose up --build

# Or standalone
docker build -t ridhwan .
docker run -p 3000:3000 --env-file .env ridhwan
```

**Dockerfile features:**
- Multi-stage build (build stage + runtime stage)
- Non-root execution (`node` user)
- Health check via `/api/health`
- Only production dependencies in final image
- Port 3000 exposed

### Option 3: One-Command Start

```bash
./scripts/start.sh
```

This script handles `npm install`, `npx tsc`, and `node dist/src/index.js` in sequence. Useful for fresh clones.

### Environment Variables

| Variable | Purpose | Required | Default |
|---|---|---|---|
| `AGENT_NAME` | Agent display name | No | `ridhwan-agent-01` |
| `SURGE_API_KEY` | SURGE wallet API key | No | Runs in dry-run mode |
| `MOLTBOOK_API_KEY` | Moltbook posting key | No | Moltbook posting disabled |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | No | Falls back to templates |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | No | Falls back to templates |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name | No | `gpt-4o` |
| `HUGGINGFACE_API_KEY` | HuggingFace Inference API | No | Falls back to local |
| `LANGFUSE_SECRET_KEY` | Langfuse observability | No | Observability disabled |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key | No | Observability disabled |
| `TWITTER_API_KEY` | X/Twitter API key | No | Thread generation only |
| `PORT` | Server port | No | `3000` |

> **All API keys are optional.** Without them, Ridhwan runs in simulation/dry-run mode — all features work, but external integrations (wallet creation, Moltbook posting, LLM calls) use local fallbacks.

### Health Check & Monitoring

```bash
# Verify the system is running
curl http://localhost:3000/api/health
# {"status":"ok","agent":"ridhwan-agent-01","uptime":42.5}

# Full system overview
curl http://localhost:3000/api/overview | jq

# Run the automated test suite (checks all endpoint categories)
bash scripts/test-all.sh
```

### Production Recommendations

1. **Reverse Proxy** — Put Nginx or Caddy in front of port 3000 for TLS termination
2. **Process Manager** — Use `pm2` or `systemd` to restart on crash: `pm2 start dist/src/index.js --name ridhwan`
3. **Persistent Storage** — SQLite files are created in the project root (`audit.db`, `policies.db`). Mount a volume in Docker:
   ```yaml
   volumes:
     - ./data:/app/data
   ```
4. **Log Aggregation** — Winston logs to stdout in JSON format. Pipe to Datadog, Splunk, or ELK
5. **Environment Secrets** — Use Docker secrets or a vault (not `.env` files) in production
6. **Resource Limits** — The system runs well on 512MB RAM / 1 vCPU. Set Docker limits:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
         cpus: '1.0'
   ```

### Architecture Notes

- **Single-process design** — Everything runs in one Node.js process for simplicity. No microservices, no message queues. The multi-agent orchestrator runs sub-agents as in-process functions, not separate services.
- **SQLite for persistence** — WAL mode enabled for concurrent reads. All audit logs, policies, and trading data are stored locally. For production scale, swap to PostgreSQL by changing the database adapter.
- **Stateless API** — No sessions or cookies. Every request is self-contained. Horizontal scaling works via a load balancer with sticky sessions for SSE connections.
- **Zero external dependencies at runtime** — The dashboard is pure HTML/CSS/JS served by Express. No React, no webpack, no build step for the frontend.

---

*23,000+ lines of TypeScript | 130+ API endpoints | 20+ modules | 5 sub-agents | Built with 🔥 for the SURGE × OpenClaw Hackathon*
