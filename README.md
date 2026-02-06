# 🛡️ RIDHWAN

**The Enterprise Trust & Commerce Mesh for Autonomous AI Agents**

> Built for the [SURGE × lablab.ai Hackathon](https://lablab.ai) — $50K prize pool

---

## What is Ridhwan?

AI agents are powerful, but enterprises won't trust them with real money without guardrails. **Ridhwan** is the governance backbone that makes autonomous agents enterprise-safe — providing trust, risk management, compliance, and economic intelligence as a unified layer.

Ridhwan sits between your AI agent and the blockchain, enforcing policies, tracking budgets, auditing every action, and generating compliance receipts — all in real time.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RIDHWAN MESH                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Policy   │  │  Budget  │  │  Audit   │              │
│  │  Engine   │  │ Tracker  │  │  Ledger  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴─────┐             │
│  │         Hook Interception Pipeline      │             │
│  └────────────────┬───────────────────────┘             │
│                   │                                      │
│  ┌────────────────┴───────────────────────┐             │
│  │           Agent Runtime                 │             │
│  └────┬───────────┬───────────┬───────────┘             │
│       │           │           │                          │
│  ┌────┴────┐ ┌────┴────┐ ┌───┴─────┐                   │
│  │  SURGE  │ │  x402   │ │Moltbook │                   │
│  │ Wallet  │ │ Gasless │ │  Posts  │                   │
│  └─────────┘ └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────────────────┘
         │                        │
    ┌────┴────┐            ┌──────┴──────┐
    │  Base   │            │  Dashboard  │
    │(L2 EVM) │            │ (Next.js)   │
    └─────────┘            └─────────────┘
```

## Features

- **🛡️ Universal Policy Engine** — Action gating with allow/deny lists, budget caps, risk scoring, and human-in-the-loop approvals
- **💰 SURGE Wallet Integration** — Server-managed wallets on Base (Coinbase L2), token launch, and trading via OpenClaw
- **📊 Immutable Audit Ledger** — Every action recorded in SQLite with full receipts and compliance metadata
- **🔗 Hook Interception System** — Pre/post action processing pipeline for policy enforcement and audit logging
- **📱 Next.js Governance Dashboard** — Real-time monitoring, policy management, wallet view, and audit trail
- **⛽ x402 Gasless Transactions** — Agent-sponsored gas via the x402 open payment protocol
- **🦞 Moltbook Integration** — Automated daily build updates posted to the lablab submolt
- **🐦 X/Twitter Thread Generator** — Auto-generated build-in-public threads with daily stats
- **💓 Heartbeat Scheduler** — Cron-based health checks and automated daily operations

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

## Project Structure

```
src/
├── agent/                  # Agent runtime & lifecycle
│   ├── agent-runtime.ts    # Core runtime engine
│   ├── types.ts            # Agent action types
│   ├── heartbeat/          # Cron scheduler
│   └── hooks/              # Pre/post action hooks
│       ├── hook-manager.ts
│       ├── policy-hook.ts
│       └── audit-hook.ts
├── api/
│   └── server.ts           # Express REST API
├── dashboard/              # Next.js 14 governance UI
│   ├── app/                # App router pages
│   │   ├── page.tsx        # Dashboard home
│   │   ├── audit/          # Audit log viewer
│   │   ├── policies/       # Policy management
│   │   ├── receipts/       # Compliance receipts
│   │   └── wallet/         # Wallet overview
│   └── lib/api.ts          # API client
├── moltbook/               # Moltbook integration
│   ├── moltbook-client.ts  # API client
│   └── daily-poster.ts     # Automated posting
├── policy-engine/          # Core governance
│   ├── engine.ts           # Policy evaluation
│   ├── audit-ledger.ts     # Immutable audit log
│   ├── budget-tracker.ts   # Spending limits
│   ├── policy-store.ts     # Policy CRUD
│   ├── db/                 # SQLite layer
│   └── schemas/            # Zod schemas
├── social/
│   └── x-thread-generator.ts  # Twitter threads
├── surge/                  # SURGE blockchain
│   ├── wallet/             # Wallet management
│   ├── token-launch/       # Token launcher
│   ├── transfers/          # Transfer manager
│   └── x402/               # Gasless transactions
├── utils/
│   ├── config.ts           # Environment config
│   └── logger.ts           # Winston logger
├── index.ts                # Entry point
demo/
│   └── run-demo.ts         # 9-step feature demo
scripts/
├── register-moltbook.ts    # Register agent on Moltbook
└── post-to-lablab.ts       # Post to lablab submolt
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 11+
- OpenClaw CLI (`npm install -g openclaw@latest`)

### Installation

```bash
git clone https://github.com/yourusername/ridhwan.git
cd ridhwan
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

### Run the Full System

```bash
npm run dev:all
```

Starts the backend agent on `localhost:3000` and the governance dashboard on `localhost:3001`.

### Available Commands

| Command | Description |
|---|---|
| `npm run demo` | Run the 9-step feature demo |
| `npm run dev` | Start backend agent (port 3000) |
| `npm run dev:dashboard` | Start dashboard UI (port 3001) |
| `npm run dev:all` | Start both agent + dashboard |
| `npm run moltbook:register` | Register agent on Moltbook |
| `npm run moltbook:post` | Post build update to lablab |
| `npm run db:init` | Initialize SQLite database |
| `npm run build` | Compile TypeScript |

## How It Works

### Policy Enforcement Flow

1. Agent receives an action request (transfer, trade, launch token)
2. **Pre-hooks** fire: Policy Hook evaluates rules → Audit Hook logs the attempt
3. Policy Engine checks: budget limits, address allow/deny lists, action class permissions, risk score
4. If **allowed**: action executes via SURGE wallet → receipt generated → audit logged
5. If **blocked**: action denied with reason → audit logged → alert fired
6. **Post-hooks** fire: compliance receipt stored, stats updated

### Budget Tracking

```
Daily limit: $1,000    │  Per-tx limit: $500
Monthly limit: $10,000 │  Cooldown: 60s between transfers
```

Budgets are enforced in real time. When a limit is hit, the policy engine blocks the action and logs the violation.

### Audit Trail

Every action — allowed or blocked — is recorded with:
- Timestamp, action class, agent ID
- Policy evaluation result + risk score
- Transaction hash (if executed)
- Compliance receipt with full metadata

## Team

Built by a 5-member team for the SURGE × lablab.ai Hackathon (4-week sprint).

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

*Built with 🔥 for the SURGE × OpenClaw Hackathon | Building in Public*
