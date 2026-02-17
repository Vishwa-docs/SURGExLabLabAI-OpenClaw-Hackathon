# 🛡️ RIDHWAN

**The Enterprise Trust & Commerce Mesh for Autonomous AI Agents**

> Built for the [SURGE × lablab.ai Hackathon](https://lablab.ai) — $50K prize pool

---

## What is Ridhwan?

AI agents are powerful, but enterprises won't trust them with real money without guardrails. **Ridhwan** is the governance backbone that makes autonomous agents enterprise-safe — providing trust, risk management, compliance, and economic intelligence as a unified layer.

Ridhwan sits between your AI agent and the blockchain, enforcing policies, tracking budgets, auditing every action, and generating compliance receipts — all in real time.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RIDHWAN MESH                                 │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Policy   │  │  Budget  │  │  Audit   │  │   Risk   │           │
│  │  Engine   │  │ Tracker  │  │  Ledger  │  │  Scorer  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │              │                 │
│  ┌────┴──────────────┴──────────────┴──────────────┴───────┐       │
│  │              Hook Interception Pipeline                  │       │
│  └──────────────────────┬──────────────────────────────────┘       │
│                         │                                           │
│  ┌──────────────────────┴──────────────────────────────────┐       │
│  │                   Agent Runtime                          │       │
│  └──┬────────┬────────┬────────┬────────┬────────┬────────┘       │
│     │        │        │        │        │        │                  │
│  ┌──┴──┐ ┌──┴──┐ ┌───┴──┐ ┌──┴───┐ ┌──┴──┐ ┌──┴──────┐          │
│  │SURGE│ │ x402│ │Molt- │ │ DID  │ │ GNN │ │Credit  │          │
│  │Wallt│ │ Gas │ │ book │ │Ident.│ │Fraud│ │ Score  │          │
│  └─────┘ └─────┘ └──────┘ └──────┘ └─────┘ └────────┘          │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │Governance│  │ Escrow & │  │Insurance │  │Restaking │           │
│  │ Voting   │  │ Procure  │  │ Engine   │  │Optimizer │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Carbon  │  │  Audit   │  │  Risk    │  │ Policy   │           │
│  │ Tracker  │  │  Export  │  │Dashboard │  │Versioning│           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
         │                │                        │
    ┌────┴────┐    ┌──────┴──────┐          ┌─────┴───────┐
    │  Base   │    │  Dashboard  │          │  Moltbook   │
    │(L2 EVM) │    │ (Next.js)   │          │Distribution │
    └─────────┘    └─────────────┘          └─────────────┘
```

## Features

### Core Governance (Week 1)
- **🛡️ Universal Policy Engine** — Action gating with allow/deny lists, budget caps, risk scoring, and human-in-the-loop approvals
- **💰 SURGE Wallet Integration** — Server-managed wallets on Base (Coinbase L2), token launch, and trading via OpenClaw
- **📊 Immutable Audit Ledger** — Every action recorded in SQLite with full receipts and compliance metadata
- **🔗 Hook Interception System** — Pre/post action processing pipeline for policy enforcement and audit logging
- **📱 Next.js Governance Dashboard** — Real-time monitoring, policy management, wallet view, and audit trail
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

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22+ / TypeScript |
| Agent Framework | OpenClaw |
| Blockchain | SURGE on Base (Coinbase L2) |
| Gasless Txns | x402 Protocol |
| Database | SQLite (better-sqlite3) |
| Dashboard | Next.js 14 / React 18 |
| Validation | Zod |
| Logging | Winston |
| Social | Moltbook API, X/Twitter API v2 |
| Observability | Langfuse |
| LLM | Azure OpenAI (GPT-4o) |
| Identity | DID (Ed25519) + ZK Proofs |
| Risk ML | GNN message-passing (TypeScript) |

## Project Structure

```
src/
├── agent/                     # Agent runtime & lifecycle
│   ├── agent-runtime.ts       # Core runtime engine
│   ├── types.ts               # Agent action types
│   ├── credit-scoring.ts      # Agent credit scoring engine
│   ├── heartbeat/             # Cron scheduler
│   └── hooks/                 # Pre/post action hooks
├── analytics/                 # Analytics & reporting
│   ├── risk-dashboard.ts      # Risk dashboard data provider
│   ├── carbon-tracker.ts      # Carbon footprint tracker
│   └── audit-export.ts        # Audit packet export
├── api/
│   └── server.ts              # Express REST API (60+ endpoints)
├── dashboard/                 # Next.js 14 governance UI
├── economic/                  # Economic intelligence
│   ├── cost-router.ts         # LLM cost optimization
│   ├── treasury-tracker.ts    # Multi-chain treasury
│   ├── procurement-engine.ts  # Agent procurement workflow
│   ├── escrow-manager.ts      # Multi-party escrow
│   ├── restaking-optimizer.ts # Dynamic restaking
│   └── insurance-engine.ts    # Micro-insurance
├── governance/                # Governance systems
│   ├── hold-mechanism.ts      # HOLD circuit breaker
│   ├── risk-scorer.ts         # Risk scoring engine
│   ├── voting-system.ts       # Governance voting
│   └── policy-versioning.ts   # Policy version hashing
├── identity/                  # Decentralized identity
│   ├── did-manager.ts         # DID management
│   ├── agent-registry.ts      # Agent discovery
│   └── zk-privacy.ts          # Zero-knowledge proofs
├── moltbook/                  # Moltbook integration
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
└── utils/                     # Config & logging
demo/
├── run-demo.ts                # 9-step feature demo
└── run-scenarios.ts           # 5-scenario validation
```

## API Endpoints (60+)

### Core
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/overview` | Full system overview |
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

## Getting Started

### Prerequisites

- Node.js 22+
- npm 11+
- OpenClaw CLI (`npm install -g openclaw@latest`)

### Installation

```bash
git clone https://github.com/Vishwa-docs/SURGExLabLabAI-OpenClaw-Hackathon.git
cd SURGExLabLabAI-OpenClaw-Hackathon
npm install
cd src/dashboard && npm install && cd ../..
```

### Configuration

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

Required keys:
| Key | Where to get it | Cost |
|---|---|---|
| `SURGE_API_KEY` | [app.surge.xyz](https://app.surge.xyz) | Free |
| `MOLTBOOK_API_KEY` | Auto-generated via `npm run moltbook:register` | Free |
| `AZURE_OPENAI_*` | [Azure Portal](https://portal.azure.com) | Free tier available |
| `HUGGINGFACE_API_KEY` | [huggingface.co](https://huggingface.co) | Free |
| `LANGFUSE_*` | [cloud.langfuse.com](https://cloud.langfuse.com) | Free tier |
| `TWITTER_*` | [developer.x.com](https://developer.x.com) | Free tier |

### Run the Demo

```bash
npm run demo
```

Runs all 9 features end-to-end: policy engine, audit ledger, wallet ops, token launch, transfers, hooks, receipts, x402, and X thread generation.

### Run Scenarios

```bash
npm run scenario:all
```

Runs all 5 governance scenarios: normal transfer, large transfer HOLD, malicious transfer block, skill scanner, and multi-step workflow.

### Run the Full System

```bash
npm run dev:all
```

Starts the backend agent on `localhost:3000` and the governance dashboard on `localhost:3001`.

### Available Commands

| Command | Description |
|---|---|
| `npm run demo` | Run the 9-step feature demo |
| `npm run scenario:all` | Run all 5 governance scenarios |
| `npm run dev` | Start backend agent (port 3000) |
| `npm run dev:dashboard` | Start dashboard UI (port 3001) |
| `npm run dev:all` | Start both agent + dashboard |
| `npm run moltbook:register` | Register agent on Moltbook |
| `npm run moltbook:post` | Post build update to lablab |
| `npm run build` | Compile TypeScript |

## Prize Track Alignment

| Track | RIDHWAN Module |
|---|---|
| **Agent-to-Agent Economies** | Procurement, Escrow, Insurance, Credit Scoring, Registry |
| **Internet Capital Markets** | Restaking Optimizer, Treasury Tracker, Token Launcher |
| **Compliance-Ready Tokenization** | Policy Engine, Audit Export, Carbon Tracker, ZK Privacy |
| **Community Incentives + Governance** | Voting System, Policy Versioning, HOLD Mechanism |
| **Moltbook-Native Distribution** | Daily Poster, Build-in-Public Threads, Agent Registry |

## Team

Built by a 5-member team for the SURGE × lablab.ai Hackathon (4-week sprint).

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

*Built with 🔥 for the SURGE × OpenClaw Hackathon | Building in Public*
