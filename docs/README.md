# 🔥 RIDHWAN — Enterprise Trust & Commerce Mesh for Autonomous AI Agents

> **SURGE × lablab.ai Hackathon — Week 1 Deliverable**

RIDHWAN is a governance-first operating layer for autonomous AI agents on Base L2. It provides real-time policy enforcement, budget controls, immutable audit trails, and autonomous Moltbook publishing — ensuring every agent action is governed, traceable, and compliant.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Dashboard (Next.js)            │
│         http://localhost:3001                     │
├─────────────────────────────────────────────────┤
│                   REST API (Express)             │
│         http://localhost:3000                     │
├──────────┬──────────┬──────────┬────────────────┤
│  Agent   │  Policy  │  SURGE   │   Moltbook     │
│  Runtime │  Engine  │  Skills  │   Publisher    │
├──────────┴──────────┴──────────┴────────────────┤
│              SQLite + Audit Ledger               │
├─────────────────────────────────────────────────┤
│           Base L2 (Coinbase) + x402              │
└─────────────────────────────────────────────────┘
```

## Quick Start

### One-Command Start

```bash
./scripts/start.sh
```

This will:
1. Check Node.js 18+
2. Install all dependencies
3. Create `.env` from template
4. Build TypeScript
5. Initialize SQLite database
6. Start API server + Dashboard concurrently

### Manual Start

```bash
# Install
npm install
cd src/dashboard && npm install && cd ../..

# Configure
cp .env.example .env
# Edit .env with your keys

# Build + init
npx tsc --skipLibCheck
npm run db:init

# Run
npm run dev           # Backend API on :3000
npm run dev:dashboard # Dashboard on :3001 (separate terminal)
```

### Run Demo

```bash
npm run demo
```

Walks through all 9 governance steps: wallet setup → policy allow → policy block → budget check → Moltbook post → audit review → receipt generation → X thread.

---

## Project Structure

```
src/
├── index.ts                    # Main entry point
├── utils/
│   ├── config.ts               # Environment configuration
│   └── logger.ts               # Winston structured logging
├── agent/
│   ├── types.ts                # Core type definitions
│   ├── agent-runtime.ts        # Agent lifecycle + action execution
│   ├── hooks/
│   │   ├── hook-manager.ts     # Hook interception system
│   │   ├── policy-hook.ts      # Pre-hook: policy enforcement
│   │   └── audit-hook.ts       # Post-hook: audit logging
│   └── heartbeat/
│       └── scheduler.ts        # Periodic heartbeat + Moltbook
├── policy-engine/
│   ├── schemas/
│   │   └── policy-schema.ts    # Zod-validated policy schemas
│   ├── db/
│   │   ├── database.ts         # SQLite manager (WAL mode)
│   │   └── init.ts             # DB initialization + seed
│   ├── policy-store.ts         # Policy CRUD + SHA-256 hashing
│   ├── budget-tracker.ts       # Daily/weekly/monthly caps
│   ├── engine.ts               # Universal policy evaluator
│   └── audit-ledger.ts         # Immutable audit log + receipts
├── surge/
│   ├── wallet/
│   │   └── wallet-manager.ts   # Wallet create/balance (Base)
│   ├── transfers/
│   │   └── transfer-manager.ts # ETH + ERC-20 transfers
│   ├── token-launch/
│   │   └── token-launcher.ts   # ERC-20 deployment
│   └── x402/
│       └── gasless-manager.ts  # x402 gasless transactions
├── moltbook/
│   ├── moltbook-client.ts      # Moltbook API client + templates
│   ├── daily-poster.ts         # Automated daily posting
│   └── index.ts                # Module exports
├── social/
│   └── x-thread-generator.ts   # X/Twitter thread builder
├── api/
│   └── server.ts               # Express REST API
└── dashboard/                  # Next.js 14 App Router
    ├── app/
    │   ├── layout.tsx           # Root layout + sidebar nav
    │   ├── page.tsx             # Overview dashboard
    │   ├── policies/page.tsx    # Policy editor
    │   ├── audit/page.tsx       # Audit timeline
    │   ├── wallet/page.tsx      # Wallet + budget usage
    │   └── receipts/page.tsx    # Receipt viewer
    ├── lib/api.ts               # API client
    └── styles/globals.css       # Dark theme design system

demo/
└── run-demo.ts                 # Replayable autonomy demo

scripts/
└── start.sh                    # One-command start
```

---

## Core Components

### Agent Runtime (`src/agent/`)

The agent runtime is the central nervous system. Every action flows through:

```
Action → Pre-Hooks (Policy) → Execute → Post-Hooks (Audit) → Receipt
```

- **Hook System**: Extensible pre/post action interception with priority ordering
- **Heartbeat**: 24-hour periodic health check with automatic Moltbook posting
- **Wallet**: Manages agent's on-chain identity via ethers.js

### Policy Engine (`src/policy-engine/`)

Zod-validated, composable policy schemas:

| Policy Type | What It Controls |
|---|---|
| **Budget** | Per-tx, daily, weekly, monthly spend caps |
| **Address** | Allowlist/denylist for transaction targets |
| **Action Gating** | Allow/block/require-approval per action class |
| **Risk Threshold** | Auto-block actions above risk score |
| **API Domain** | Restrict which APIs the agent can call |
| **File Path** | Restrict file system access |
| **Skill Permissions** | Which SURGE skills the agent can use |

Default policy ships with sensible defaults:
- $100/transaction, $500/day, $2000/week, $5000/month
- `ownership_renounce` **blocked**
- `token_launch` requires **manual approval**
- Everything else **allowed**

### SURGE Integration (`src/surge/`)

| Skill | Description |
|---|---|
| **Wallet** | Create on Base L2, check balance, get signer |
| **Transfers** | ETH + ERC-20 with policy governance |
| **Token Launch** | Deploy custom ERC-20 (policy-gated) |
| **x402 Gasless** | Sponsored transactions with credit pool |

### Moltbook Publishing (`src/moltbook/`)

**Agents autonomously publish daily updates to Moltbook.**

- `MoltbookClient`: Full API client with templated posting (daily_update, milestone, launch, technical)
- `DailyPoster`: Automated daily posting with highlights auto-generated from audit stats
- Posts go through `agentRuntime.executeAction('moltbook_post')` — subject to policy checks
- Deduplication: won't double-post in the same day
- Local fallback when no API key (logs to console + file)

### Dashboard (`src/dashboard/`)

Next.js 14 dark-themed governance UI:

| Page | Features |
|---|---|
| **Overview** | Stats grid, wallet balance, recent actions table with risk scores |
| **Policies** | Full CRUD editor, action gating grid, budget inputs, toggle switches |
| **Audit** | Timeline view, filters (all/blocked/by-type), detail panel with risk bars |
| **Wallet** | Address display, budget usage progress bars |
| **Receipts** | Table view, JSON viewer modal, explorer links |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/overview` | Dashboard overview (stats, actions, moltbook status) |
| GET | `/api/policies` | List all policies |
| GET | `/api/audit` | Audit log with filters |
| GET | `/api/wallet` | Wallet address + balance |
| GET | `/api/budget` | Budget usage |
| GET | `/api/receipts` | All receipts |
| POST | `/api/moltbook/post` | Manual Moltbook post |
| POST | `/api/moltbook/daily` | Trigger daily update |
| GET | `/api/moltbook/history` | Post history |
| GET | `/api/social/x-thread` | Generate daily X thread |
| POST | `/api/social/x-thread/submission` | Generate submission thread |

---

## Environment Variables

```env
# Agent Identity
AGENT_NAME=ridhwan-alpha
AGENT_ID=ridhwan-001

# Base L2
BASE_RPC_URL=https://mainnet.base.org
WALLET_PRIVATE_KEY=        # Leave empty to auto-generate

# SURGE
SURGE_API_URL=https://api.surgeapp.dev
SURGE_API_KEY=

# x402 Gasless
X402_PROVIDER_URL=
X402_CREDIT_POOL_ADDRESS=

# Moltbook (agents post daily updates here)
MOLTBOOK_API_URL=https://api.moltbook.com
MOLTBOOK_API_KEY=
MOLTBOOK_SUBMOLT=ridhwan-builds

# Social
TWITTER_API_KEY=
TWITTER_API_SECRET=

# AI (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Database
DB_PATH=./data/ridhwan.db
```

---

## Week 1 Coverage by Role

| Member | Role | Deliverables |
|---|---|---|
| **A** | OpenClaw Agent Setup | Agent runtime, hook system, heartbeat, wallet integration |
| **B** | Policy Engine | Zod schemas, SQLite store, budget tracker, audit ledger |
| **C** | SURGE Integration | Wallet, transfers, token launch, x402 gasless |
| **D** | Dashboard & API | 5-page Next.js dashboard, Express REST API |
| **E** | Docs & Demo | README, demo script, start script, X thread generator |

---

## Tech Stack

- **Runtime**: TypeScript + Node.js
- **Database**: SQLite (better-sqlite3, WAL mode)
- **Blockchain**: ethers.js v6, Base L2
- **Dashboard**: Next.js 14 (App Router)
- **API**: Express.js
- **Validation**: Zod
- **Logging**: Winston
- **Gasless**: x402 Protocol
- **Social**: Moltbook API, X/Twitter API

---

## License

MIT

---

*Built for [SURGE × lablab.ai Hackathon](https://lablab.ai)*
