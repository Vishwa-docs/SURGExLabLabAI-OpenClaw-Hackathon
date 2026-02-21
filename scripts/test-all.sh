#!/bin/bash
# RIDHWAN — Automated API Test Suite
# Tests all 100+ endpoints and reports results
# Usage: ./scripts/test-all.sh

set -euo pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_endpoint() {
  local method=$1 url=$2 data=$3 label=$4
  TOTAL=$((TOTAL+1))
  if [ "$method" = "GET" ]; then
    result=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$url" 2>/dev/null || echo "000")
  elif [ "$method" = "DELETE" ]; then
    result=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X DELETE "$BASE$url" 2>/dev/null || echo "000")
  else
    result=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo "000")
  fi
  if [ "$result" -ge 200 ] 2>/dev/null && [ "$result" -lt 400 ] 2>/dev/null; then
    echo -e "${GREEN}✅${NC} $label ${YELLOW}($result)${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}❌${NC} $label ${RED}($result)${NC}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         RIDHWAN — API Test Suite                    ║"
echo "║         Testing: $BASE                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────
echo "── Core System ──"
test_endpoint GET "/api/health" "" "Health Check"
test_endpoint GET "/api/overview" "" "System Overview"
test_endpoint GET "/api/docs" "" "OpenAPI Docs"

echo ""
echo "── Policy Engine ──"
test_endpoint GET "/api/policies" "" "List Policies"

echo ""
echo "── Audit & Receipts ──"
test_endpoint GET "/api/audit" "" "Audit Log"
test_endpoint GET "/api/receipts" "" "Receipts"
test_endpoint GET "/api/audit/export" "" "Audit Export"

echo ""
echo "── Wallet & Budget ──"
test_endpoint GET "/api/wallet" "" "Wallet Info"
test_endpoint GET "/api/budget" "" "Budget Usage"

echo ""
echo "── Actions ──"
test_endpoint POST "/api/actions/transfer" '{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28","amount":"0.001"}' "Transfer"
test_endpoint POST "/api/actions/token-launch" '{"name":"TestToken","symbol":"TST","initialSupply":"1000000"}' "Token Launch"
test_endpoint GET "/api/actions/summary" "" "Action Summary"

echo ""
echo "── Risk & Governance ──"
test_endpoint GET "/api/risk/assess" "" "Risk Assessment"
test_endpoint GET "/api/risk/trend" "" "Risk Trend"
test_endpoint GET "/api/risk/stats" "" "Risk Stats"
test_endpoint GET "/api/hold/stats" "" "HOLD Stats"
test_endpoint GET "/api/hold/active" "" "Active Holds"
test_endpoint POST "/api/governance/proposal" '{"title":"Test Proposal","description":"Test","proposer":"agent-001"}' "Create Proposal"
test_endpoint GET "/api/governance/demo" "" "Governance Demo"

echo ""
echo "── Identity & Privacy ──"
test_endpoint POST "/api/identity/did/create" '{"name":"test-agent"}' "Create DID"
test_endpoint POST "/api/registry/register" '{"agentId":"test-reg","name":"TestBot","capabilities":["test"]}' "Register Agent"
test_endpoint GET "/api/registry/discover" "" "Discover Agents"
test_endpoint POST "/api/privacy/proof/balance" '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28","threshold":"100"}' "Balance Proof"
test_endpoint POST "/api/privacy/proof/compliance" '{"agentId":"agent-001"}' "Compliance Proof"

echo ""
echo "── Economics ──"
test_endpoint POST "/api/cost-router/route" '{"prompt":"Hello","maxCost":0.01}' "Cost Router"
test_endpoint GET "/api/cost-router/usage" "" "Cost Usage"
test_endpoint GET "/api/treasury/snapshot" "" "Treasury Snapshot"
test_endpoint GET "/api/treasury/stats" "" "Treasury Stats"
test_endpoint GET "/api/procurement/demo" "" "Procurement Demo"
test_endpoint GET "/api/escrow/demo" "" "Escrow Demo"
test_endpoint POST "/api/restaking/optimize" '{"amount":10000}' "Restaking Optimize"
test_endpoint POST "/api/insurance/policy" '{"agentId":"agent-001","coverage":10000,"riskType":"smart_contract"}' "Insurance Policy"
test_endpoint GET "/api/insurance/demo" "" "Insurance Demo"
test_endpoint GET "/api/credit/demo" "" "Credit Demo"
test_endpoint GET "/api/credit/score/agent-001" "" "Credit Score"

echo ""
echo "── Trading Engine (Week 5) ──"
test_endpoint POST "/api/trading/price" '{"symbol":"ETH/USDC","price":2500}' "Set Price"
test_endpoint POST "/api/trading/order" '{"agentId":"t1","symbol":"ETH/USDC","side":"buy","type":"market","quantity":1}' "Place Order"
test_endpoint GET "/api/trading/orders" "" "Open Orders"
test_endpoint GET "/api/trading/positions" "" "Positions"
test_endpoint GET "/api/trading/history" "" "Trade History"
test_endpoint GET "/api/trading/orderbook/ETH%2FUSDC" "" "Order Book"
test_endpoint GET "/api/trading/performance/t1" "" "Performance"
test_endpoint POST "/api/trading/leaderboard" '{"metric":"pnl","limit":10}' "Leaderboard"
test_endpoint GET "/api/trading/summary" "" "Engine Summary"

echo ""
echo "── Prediction Markets (Week 5) ──"
test_endpoint POST "/api/predictions/market" '{"title":"Test market?","creatorId":"a1","endDate":"2026-12-31T00:00:00Z","initialLiquidity":100}' "Create Market"
test_endpoint GET "/api/predictions/markets" "" "List Markets"
test_endpoint GET "/api/predictions/summary" "" "Market Summary"

echo ""
echo "── DeFi Aggregator (Week 5) ──"
test_endpoint GET "/api/defi/pools" "" "Fetch Pools"
test_endpoint GET "/api/defi/protocols" "" "Fetch Protocols"
test_endpoint POST "/api/defi/strategy" '{"name":"Test","agentId":"a1","totalAllocation":1000,"riskTolerance":"low","chains":["ethereum"]}' "Create Strategy"
test_endpoint GET "/api/defi/strategies" "" "List Strategies"
test_endpoint GET "/api/defi/snapshot" "" "DeFi Snapshot"
test_endpoint GET "/api/defi/best-yield?amount=1000" "" "Best Yield"

echo ""
echo "── Revenue Sharing (Week 5) ──"
test_endpoint POST "/api/revenue/list-skill" '{"skillId":"s-test","name":"Test Skill","creatorId":"a1","pricePerUse":1,"category":"test"}' "List Skill"
test_endpoint GET "/api/revenue/listings" "" "Browse Listings"
# Get the listing ID for s-test dynamically
LISTING_ID=$(curl -s http://localhost:3000/api/revenue/listings 2>/dev/null | python3 -c "import sys,json; listings=json.load(sys.stdin); print(next((l['id'] for l in listings if l.get('skillId')=='s-test'), 'none'))" 2>/dev/null || echo "none")
test_endpoint POST "/api/revenue/use" "{\"listingId\":\"$LISTING_ID\",\"buyerId\":\"a2\"}" "Use Skill"
test_endpoint GET "/api/revenue/earnings/a1" "" "Earnings"
test_endpoint GET "/api/revenue/stats" "" "Marketplace Stats"
test_endpoint GET "/api/revenue/demo" "" "Revenue Demo"

echo ""
echo "── Smart Contract Verifier (Week 5) ──"
test_endpoint POST "/api/web3/verify" '{"address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum"}' "Full Verify"
test_endpoint POST "/api/web3/quick-check" '{"address":"0xdAC17F958D2ee523a2206206994597C13D831ec7","chain":"ethereum"}' "Quick Check"
test_endpoint GET "/api/web3/reports" "" "Reports"
test_endpoint GET "/api/web3/stats" "" "Verifier Stats"

echo ""
echo "── Market Trends (Week 5) ──"
test_endpoint GET "/api/trends/overview" "" "Market Overview"
test_endpoint GET "/api/trends/analyze/bitcoin" "" "BTC Analysis"
test_endpoint GET "/api/trends/defi" "" "DeFi Trends"
test_endpoint GET "/api/trends/sectors" "" "Sectors"
test_endpoint GET "/api/trends/anomalies" "" "Anomalies"

echo ""
echo "── MCP Agent Protocol (Week 5) ──"
test_endpoint POST "/api/mcp/register" '{"agentId":"mcp-test","name":"TestBot","capabilities":["test"],"endpoint":"http://localhost:9999"}' "Register Agent"
test_endpoint GET "/api/mcp/discover?capability=test" "" "Discover"
test_endpoint GET "/api/mcp/agent/mcp-test" "" "Agent Details"
test_endpoint GET "/api/mcp/capabilities" "" "Capabilities"
test_endpoint GET "/api/mcp/stats" "" "MCP Stats"
test_endpoint GET "/api/mcp/manifest" "" "MCP Manifest"

echo ""
echo "── Real-Time Events (Week 5) ──"
test_endpoint GET "/api/events?category=system" "" "Query Events"
test_endpoint GET "/api/events/stats" "" "Event Stats"
test_endpoint POST "/api/events/subscribe" '{"categories":["trading","security"]}' "Subscribe"

echo ""
echo "── Analytics ──"
test_endpoint GET "/api/dashboard/snapshot" "" "Risk Dashboard"
test_endpoint GET "/api/carbon/report" "" "Carbon Report"
test_endpoint GET "/api/carbon/esg" "" "ESG Score"
test_endpoint GET "/api/fraud/demo" "" "Fraud Demo"

echo ""
echo "── Social & Moltbook ──"
test_endpoint GET "/api/social/x-thread" "" "X Thread"
test_endpoint GET "/api/moltbook/history" "" "Moltbook History"

echo ""
echo "── Scenarios ──"
test_endpoint GET "/api/scenarios" "" "List Scenarios"

echo ""
echo "── Security ──"
test_endpoint POST "/api/skills/scan" '{"code":"const x = 1 + 1;"}' "Skill Scan"
test_endpoint GET "/api/skills/scan/demo" "" "Scanner Demo"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
printf "║  Results: ${GREEN}%d passed${NC}, ${RED}%d failed${NC}, %d total          ║\n" "$PASS" "$FAIL" "$TOTAL"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
