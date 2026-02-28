# RIDHWAN

**Enterprise Trust & Commerce Mesh for Autonomous AI Agents**

> Built for the [SURGE x OpenClaw x lablab.ai Hackathon](https://lablab.ai/ai-hackathons/openclaw-surge-hackathon)

---

## What is Ridhwan?

AI agents are powerful, but enterprises won't trust them with real money without guardrails. **Ridhwan** is the governance backbone that makes autonomous agents enterprise-safe — providing trust, risk management, compliance, and economic intelligence as a unified layer.

It sits between your AI agent and the blockchain, enforcing policies, tracking budgets, auditing every action, and generating compliance receipts — all in real time.

---

## Quick Start

### Prerequisites

- **Node.js 18+** (22+ recommended)
- **npm 9+**
- **Git**

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

Edit `.env` with your API keys. All keys are **optional** — without them, Ridhwan runs in simulation/dry-run mode.

| Key | Source | Required? |
|---|---|---|
| `SURGE_API_KEY` | [app.surge.xyz](https://app.surge.xyz) | Recommended (or dry-run) |
| `MOLTBOOK_API_KEY` | `npm run moltbook:register` | For Moltbook posting |
| `AZURE_OPENAI_*` | [Azure Portal](https://portal.azure.com) | For LLM features |
| `HUGGINGFACE_API_KEY` | [huggingface.co](https://huggingface.co) | LLM fallback |
| `LANGFUSE_*` | [cloud.langfuse.com](https://cloud.langfuse.com) | For observability |

> **No real money is spent.** SURGE wallets use free Base Sepolia testnet funding.

### 3. Build & Run

```bash
npx tsc
node dist/src/index.js
```

Open **http://localhost:3000** — the dashboard starts in Demo Mode with pre-populated data.

### Alternative Run Methods

```bash
./scripts/start.sh            # One-command: install, compile, run
npm run dev                    # Backend only
npm run dev:all                # Backend + dashboard
docker compose up --build      # Docker
npm run demo                   # 9-step feature demo
npm run scenario:all           # 5 governance scenarios
```

---

## Features

- **Policy Engine** — Action gating with allow/deny lists, budget caps, risk scoring, and human-in-the-loop approvals
- **SURGE Wallet** — Server-managed wallets on Base (Coinbase L2), token launch and trading via OpenClaw
- **Immutable Audit Ledger** — Every action recorded with full receipts and compliance metadata
- **Hook Interception** — Pre/post action pipeline for policy enforcement and audit logging
- **HOLD Mechanism** — Delay-based circuit breaker with escalation for dangerous actions
- **Risk Scoring** — 7 weighted signals with z-score normalization for real-time risk assessment
- **GNN Fraud Detection** — Graph Neural Network message-passing for neighborhood risk propagation
- **Decentralized Identity** — Ed25519-based DIDs with verifiable credentials
- **Zero-Knowledge Privacy** — ZK proofs for balance verification and compliance attestation
- **Governance Voting** — Weighted multi-party consensus with quorum and on-chain anchoring
- **Multi-Agent Orchestrator** — 5 sub-agents (risk-guard, policy-bot, trade-runner, compliance-ai, trust-broker) with automatic task routing and pipeline execution
- **x402 Commerce** — HTTP 402 protocol for agent-to-agent paid services with cost-benefit evaluation
- **Trust Delegation** — Depth-limited, constraint-scoped capability chains with cascade revocation
- **Trading Engine** — Order book matching, PnL accounting, agent leaderboard, and position tracking
- **DeFi Yield Aggregator** — Multi-protocol yield tracking via DeFiLlama, risk-parity allocation
- **Smart Contract Verifier** — Bytecode analysis, vulnerability scanning, and compliance checks
- **MCP Agent Server** — Model Context Protocol for agent-to-agent discovery and communication
- **Real-Time Events** — SSE broadcasting across 10 event categories
- **Web Dashboard** — 15 interactive sections with Demo Mode toggle for presentations
- **Moltbook Integration** — Automated daily build updates and narrative post generation
- **Docker Support** — Multi-stage production build with health checks

---

## Architecture

```
+----------------------------------------------------------------------+
|                        RIDHWAN MESH                                  |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  |              Multi-Agent Orchestrator                          |  |
|  |  risk-guard . policy-bot . trade-runner . compliance-ai        |  |
|  |                   trust-broker                                 |  |
|  +---------------------------+------------------------------------+  |
|                              |                                       |
|  +----------+ +----------+ +----------+ +----------+ +----------+   |
|  |  Policy  | |  Budget  | |  Audit   | |   Risk   | |  Trust   |   |
|  |  Engine  | | Tracker  | |  Ledger  | |  Scorer  | | Deleg.   |   |
|  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +----+-----+   |
|       +-------------+------------+-------------+------------+        |
|                              |                                       |
|               +--------------+----------------+                      |
|               |  Hook Interception Pipeline   |                      |
|               +--------------+----------------+                      |
|                              |                                       |
|  +------+ +------+ +------+ +------+ +------+ +------+ +------+    |
|  |SURGE | | x402 | |Molt- | | DID  | | GNN  | |Credit| | MCP  |    |
|  |Wallet| | Gas  | | book | |Ident.| |Fraud | |Score | |Agent |    |
|  +------+ +------+ +------+ +------+ +------+ +------+ +------+    |
+----------------------------------------------------------------------+
        |                |                       |
   +----+----+    +------+------+         +------+------+
   |  Base   |    |  Dashboard  |         |  Moltbook   |
   |(L2 EVM) |    |(HTML/CSS/JS)|         |Distribution |
   +---------+    +-------------+         +-------------+
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js / TypeScript |
| Agent Framework | OpenClaw |
| Blockchain | SURGE on Base (Coinbase L2) |
| Gasless Txns | x402 Protocol |
| Database | SQLite (better-sqlite3) |
| Dashboard | Vanilla HTML/CSS/JS |
| LLM | Azure OpenAI (GPT-4o), HuggingFace |
| Identity | DID (Ed25519) + ZK Proofs |
| Risk ML | GNN message-passing |
| Market Data | CoinGecko, DeFiLlama |
| Protocol | Model Context Protocol (MCP) |
| Real-Time | Server-Sent Events (SSE) |
| Containerization | Docker + Docker Compose |

---

## API

130+ REST endpoints. Full OpenAPI 3.0 spec available at `/api/docs`.

| Category | Example Endpoints |
|---|---|
| **Core** | `/api/health`, `/api/overview`, `/api/policies`, `/api/audit`, `/api/wallet` |
| **Risk & Governance** | `/api/risk/assess`, `/api/hold/active`, `/api/governance/proposal`, `/api/governance/vote` |
| **Identity** | `/api/identity/did/create`, `/api/registry/register`, `/api/privacy/proof/balance` |
| **Trading** | `/api/trading/order`, `/api/trading/positions`, `/api/predictions/market` |
| **DeFi** | `/api/defi/pools`, `/api/defi/strategy`, `/api/revenue/list-skill` |
| **Web3** | `/api/web3/verify`, `/api/web3/quick-check`, `/api/web3/batch-verify` |
| **MCP** | `/api/mcp/register`, `/api/mcp/discover`, `/api/mcp/request` |
| **Orchestrator** | `/api/orchestrator/task`, `/api/orchestrator/pipeline`, `/api/orchestrator/agents` |
| **x402 Commerce** | `/api/x402/purchase`, `/api/x402/resources`, `/api/x402/verify` |
| **Trust** | `/api/trust/delegate`, `/api/trust/check`, `/api/trust/revoke` |
| **Events** | `/api/events/stream` (SSE), `/api/events`, `/api/events/subscribe` |
| **Analytics** | `/api/trends/overview`, `/api/carbon/report`, `/api/audit/export` |

---

## Dashboard

The web dashboard at `http://localhost:3000` includes 15 interactive sections and a **Demo Mode** toggle:

- **Demo Mode (ON)** — Pre-populated enterprise data for presentations
- **Live Mode (OFF)** — Real API calls to the backend

Toggle via the sidebar footer. Sections include Overview, Policies, Risk & Fraud, Trading, DeFi, Governance, Identity, Audit, Web3, Events, Trends, Agent Swarm, x402 Commerce, Trust Delegation, and Moltbook.

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `SURGE_API_KEY` | SURGE wallet API key | Dry-run mode |
| `MOLTBOOK_API_KEY` | Moltbook posting | Disabled |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | Template fallback |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | Template fallback |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name | `gpt-4o` |
| `HUGGINGFACE_API_KEY` | HuggingFace API | Local fallback |
| `LANGFUSE_SECRET_KEY` | Observability | Disabled |
| `PORT` | Server port | `3000` |

---

## Docker

```bash
docker compose up --build

# Or standalone
docker build -t ridhwan .
docker run -p 3000:3000 --env-file .env ridhwan
```

Multi-stage build, non-root execution, health check at `/api/health`.

---

## Testing

```bash
curl http://localhost:3000/api/health | jq
curl http://localhost:3000/api/overview | jq
bash scripts/test-all.sh
```

---

## Build Timeline

### Week 1 — Core Governance
Policy engine, SURGE wallet integration, audit ledger, hook interception pipeline, web dashboard with demo mode, x402 gasless transactions, Moltbook integration.

### Week 2 — Risk & Economics
HOLD circuit breaker, risk scoring engine, intelligent LLM cost router, treasury tracker, skill security scanner, scenario runner, SURGE action loop.

### Week 3 — Intelligence & Analytics
GNN fraud detection, decentralized identity (DID), agent registry, zero-knowledge privacy, governance voting, policy version hashing, procurement engine, escrow manager, risk dashboard, carbon tracker, audit export.

### Week 4 — Multi-Agent Mesh & Commerce
Multi-agent orchestrator with 5 sub-agents, x402 autonomous commerce, trust delegation system, trading engine, prediction markets, DeFi yield aggregator, smart contract verifier, MCP agent server, real-time SSE events, market trend engine, Docker support, narrative Moltbook posts, credit scoring, insurance engine, restaking optimizer.

---

## Architecture Notes

- **Single-process** — Everything runs in one Node.js process. Sub-agents run as in-process functions.
- **SQLite** — WAL mode for concurrent reads. Swap to PostgreSQL for production scale.
- **Stateless API** — No sessions or cookies. Horizontally scalable with sticky sessions for SSE.
- **Zero frontend build step** — Dashboard is pure HTML/CSS/JS served by Express.

---

## License

MIT — see [LICENSE](LICENSE) for details.
