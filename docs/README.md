# RIDHWAN — Enterprise Trust & Commerce Mesh for Autonomous AI Agents

> **SURGE × lablab.ai Hackathon | 5-Week Sprint**
> **21,400+ lines of TypeScript | 100+ API endpoints | 17 active modules**

For the **full project documentation**, see:
- [**Main README**](../README.md) — Features, tech stack, API endpoints, quick start
- [**FINAL Project Documentation**](../Documentation/FINAL-Project-Documentation.md) — Complete module inventory, architecture, prize track coverage
- [**SOC 2 Control Mapping**](../Documentation/SOC2-Control-Mapping.md) — 30+ controls across 5 trust service criteria

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # Edit .env with your API keys

# 3. Compile TypeScript
npx tsc

# 4. Start full system (API :3000 + Dashboard :3001)
npm run dev:all

# 5. Run governance demo (9 steps)
npm run demo

# 6. Run all governance scenarios (5 scenarios)
npm run scenario:all
```

### Docker
```bash
docker compose up --build
```

### Key URLs
| URL | Description |
|---|---|
| http://localhost:3000/api/health | Health check |
| http://localhost:3000/api/overview | Full system overview |
| http://localhost:3000/api/docs | OpenAPI 3.0 / Swagger spec |
| http://localhost:3000/api/events/stream | SSE real-time event stream |
| http://localhost:3000/api/mcp/manifest | MCP agent manifest |
| http://localhost:3001 | Next.js analytics dashboard |

---

## Module Overview

### Core Governance (Weeks 1-2)
- **Agent Runtime** — Lifecycle management, hook pipeline, action execution
- **Policy Engine** — 5 policy checks: budget, address, action gating, risk, API
- **Audit Ledger** — Immutable SQLite action log with compliance receipts
- **HOLD Mechanism** — Circuit breaker with time delays & escalation
- **Risk Scorer** — 7 weighted signals + z-score normalization

### Economic Layer (Weeks 2-5)
- **Trading Engine** — Order book matching, FIFO PnL, Sortino ratio, leaderboard
- **Prediction Markets** — Binary AMM, oracle resolution, liquidity provisioning
- **DeFi Aggregator** — Multi-protocol yield farming (DeFiLlama)
- **Revenue Sharing** — Skill marketplace with 70/20/10 splits
- **Procurement/Escrow** — Inter-agent commerce with milestone delivery
- **Insurance** — Premium calculation, claim validation, loss pools
- **Credit Scoring** — 5-component 1000-point scale (AAA–D)
- **Restaking Optimizer** — Multi-service allocation with Sharpe ratio

### Intelligence Layer (Weeks 3-5)
- **GNN Fraud Detection** — Graph neural network risk propagation
- **Trend Engine** — CoinGecko/DeFiLlama technical analysis (RSI, MACD, Bollinger)
- **Carbon Tracker** — Per-chain energy, ESG scoring
- **ZK Privacy** — Zero-knowledge balance/compliance/identity proofs

### Web3 Layer (Weeks 1, 5)
- **SURGE Wallet** — Base L2 wallet management, transfers, token launch
- **Multi-Chain Manager** — 7 chains, provider failover
- **Smart Contract Verifier** — Bytecode analysis, vulnerability scanning
- **Token Monitor** — Balance tracking, whale alerts

### Integration Layer (Week 5)
- **MCP Server** — Agent discovery, capability negotiation, channels
- **SSE Event Hub** — Real-time streaming across 10 categories  
- **Swagger/OpenAPI** — Full API documentation at `/api/docs`
- **Moltbook** — Automated daily build updates

---

## API Reference

100+ REST endpoints across 18 groups. Full listing in the [main README](../README.md#api-endpoints) or access the live OpenAPI spec at `GET /api/docs` when the server is running.

---

## License

MIT

*Built for [SURGE × lablab.ai Hackathon](https://lablab.ai)*
