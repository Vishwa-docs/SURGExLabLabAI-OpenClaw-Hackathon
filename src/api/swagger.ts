// ============================================================
// src/api/swagger.ts — OpenAPI / Swagger Documentation
// ============================================================
// Generates OpenAPI 3.0 spec for the Ridhwan API.
// Can be served at /api/docs as JSON or used with Swagger UI.
// ============================================================

export function getOpenAPISpec(): Record<string, any> {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Ridhwan — Enterprise Trust & Commerce Mesh API',
      version: '1.0.0',
      description: `
Ridhwan is an autonomous AI agent platform built on the SURGE protocol (Base L2 / Coinbase).
It provides enterprise-grade trust, governance, and commerce infrastructure for AI agents,
including policy enforcement, multi-chain trading, DeFi aggregation, fraud detection,
smart contract verification, and agent-to-agent communication via MCP.

## Key Features
- **Policy Engine**: Multi-constraint policy evaluation with budget tracking
- **Trading Engine**: Order management with FIFO PnL and Sortino ratio
- **DeFi Aggregator**: Cross-protocol yield farming via DeFiLlama
- **Smart Contract Verifier**: Bytecode analysis and compliance checks
- **GNN Fraud Detection**: Graph neural network-based fraud scanning
- **MCP Server**: Agent-to-agent discovery and communication
- **Identity**: DID-based identity with ZK privacy proofs
- **Governance**: Multi-party voting, risk scoring, hold mechanism
      `.trim(),
      contact: {
        name: 'Ridhwan Team',
        url: 'https://github.com/Vishwa-docs/SURGExLabLabAI-OpenClaw-Hackathon',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
      { url: 'https://ridhwan.surge.xyz', description: 'Production (SURGE)' },
    ],
    tags: [
      { name: 'Health', description: 'System health and status' },
      { name: 'Agent', description: 'Agent runtime and actions' },
      { name: 'Policy', description: 'Policy engine and evaluation' },
      { name: 'Audit', description: 'Audit ledger and compliance' },
      { name: 'Wallet', description: 'SURGE wallet management' },
      { name: 'Trading', description: 'Trading engine and orders' },
      { name: 'DeFi', description: 'DeFi aggregation and yield' },
      { name: 'Web3', description: 'Multi-chain and smart contracts' },
      { name: 'Governance', description: 'Voting, risk scoring, holds' },
      { name: 'Identity', description: 'DID, agent registry, ZK proofs' },
      { name: 'Analytics', description: 'Trends, carbon, risk dashboard' },
      { name: 'MCP', description: 'Model Context Protocol server' },
      { name: 'Revenue', description: 'Skill marketplace and revenue sharing' },
      { name: 'WebSocket', description: 'Real-time event streaming' },
    ],
    paths: {
      // ── Health ──
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
          },
        },
      },
      '/api/overview': {
        get: {
          tags: ['Agent'],
          summary: 'Full system overview',
          responses: { 200: { description: 'Complete system state' } },
        },
      },

      // ── Policy ──
      '/api/policies': {
        get: {
          tags: ['Policy'],
          summary: 'List all policies',
          responses: { 200: { description: 'Array of policies' } },
        },
        post: {
          tags: ['Policy'],
          summary: 'Create or update a policy',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PolicyInput' } } } },
          responses: { 200: { description: 'Policy saved' } },
        },
      },
      '/api/policies/{id}': {
        get: {
          tags: ['Policy'],
          summary: 'Get a specific policy',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Policy details' }, 404: { description: 'Not found' } },
        },
      },
      '/api/policies/evaluate': {
        post: {
          tags: ['Policy'],
          summary: 'Evaluate an action against policies',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Policy decision' } },
        },
      },

      // ── Audit ──
      '/api/audit': {
        get: {
          tags: ['Audit'],
          summary: 'Get audit log entries',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: { 200: { description: 'Audit entries' } },
        },
      },
      '/api/audit/export': {
        get: {
          tags: ['Audit'],
          summary: 'Export full audit packet',
          responses: { 200: { description: 'Complete audit export' } },
        },
      },

      // ── Wallet ──
      '/api/wallet/info': {
        get: {
          tags: ['Wallet'],
          summary: 'Get wallet information',
          responses: { 200: { description: 'Wallet details' } },
        },
      },
      '/api/wallet/balance': {
        get: {
          tags: ['Wallet'],
          summary: 'Get wallet balance',
          responses: { 200: { description: 'Balance details' } },
        },
      },

      // ── Trading ──
      '/api/trading/orders': {
        get: {
          tags: ['Trading'],
          summary: 'List open orders',
          parameters: [{ name: 'agentId', in: 'query', schema: { type: 'string' } }],
          responses: { 200: { description: 'Open orders' } },
        },
        post: {
          tags: ['Trading'],
          summary: 'Place a new order',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderInput' } } },
          },
          responses: { 200: { description: 'Order placed' }, 400: { description: 'Validation error' } },
        },
      },
      '/api/trading/positions': {
        get: {
          tags: ['Trading'],
          summary: 'List positions',
          responses: { 200: { description: 'Current positions' } },
        },
      },
      '/api/trading/history': {
        get: {
          tags: ['Trading'],
          summary: 'Get trade history',
          responses: { 200: { description: 'Trade history' } },
        },
      },
      '/api/trading/performance/{agentId}': {
        get: {
          tags: ['Trading'],
          summary: 'Get performance metrics for an agent',
          parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Performance metrics including Sortino ratio' } },
        },
      },
      '/api/trading/leaderboard': {
        get: {
          tags: ['Trading'],
          summary: 'Get trading leaderboard',
          responses: { 200: { description: 'Ranked agents' } },
        },
      },

      // ── DeFi ──
      '/api/defi/pools': {
        get: {
          tags: ['DeFi'],
          summary: 'Get yield pools from DeFiLlama',
          parameters: [
            { name: 'chain', in: 'query', schema: { type: 'string' } },
            { name: 'minApy', in: 'query', schema: { type: 'number' } },
          ],
          responses: { 200: { description: 'Yield pools' } },
        },
      },
      '/api/defi/protocols': {
        get: {
          tags: ['DeFi'],
          summary: 'Get DeFi protocols',
          responses: { 200: { description: 'Protocol list with TVL' } },
        },
      },
      '/api/defi/strategies': {
        get: {
          tags: ['DeFi'],
          summary: 'List yield strategies',
          responses: { 200: { description: 'Active strategies' } },
        },
        post: {
          tags: ['DeFi'],
          summary: 'Create a yield strategy',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Strategy created' } },
        },
      },
      '/api/defi/best-yield': {
        get: {
          tags: ['DeFi'],
          summary: 'Find best yield for an amount',
          parameters: [{ name: 'amount', in: 'query', required: true, schema: { type: 'number' } }],
          responses: { 200: { description: 'Best yield opportunities' } },
        },
      },

      // ── Web3 ──
      '/api/web3/chains': {
        get: {
          tags: ['Web3'],
          summary: 'List supported chains',
          responses: { 200: { description: 'Chain configurations' } },
        },
      },
      '/api/web3/balances': {
        get: {
          tags: ['Web3'],
          summary: 'Get multi-chain balances',
          parameters: [{ name: 'address', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Balances across chains' } },
        },
      },
      '/api/web3/verify': {
        post: {
          tags: ['Web3'],
          summary: 'Verify a smart contract',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyInput' } } },
          },
          responses: { 200: { description: 'Verification report' } },
        },
      },
      '/api/web3/verify/quick': {
        post: {
          tags: ['Web3'],
          summary: 'Quick safety check for a contract',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Quick safety result' } },
        },
      },
      '/api/web3/portfolio': {
        get: {
          tags: ['Web3'],
          summary: 'Get token portfolio with prices',
          responses: { 200: { description: 'Portfolio data' } },
        },
      },

      // ── Governance ──
      '/api/governance/risk': {
        get: {
          tags: ['Governance'],
          summary: 'Get risk scores',
          responses: { 200: { description: 'Risk scoring data' } },
        },
      },
      '/api/governance/votes': {
        get: {
          tags: ['Governance'],
          summary: 'Get voting proposals and results',
          responses: { 200: { description: 'Voting data' } },
        },
        post: {
          tags: ['Governance'],
          summary: 'Submit a vote',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Vote recorded' } },
        },
      },
      '/api/governance/holds': {
        get: {
          tags: ['Governance'],
          summary: 'Get active hold mechanisms',
          responses: { 200: { description: 'Active holds' } },
        },
      },

      // ── Identity ──
      '/api/identity/did': {
        get: {
          tags: ['Identity'],
          summary: 'Get DID document',
          responses: { 200: { description: 'DID document' } },
        },
      },
      '/api/identity/agents': {
        get: {
          tags: ['Identity'],
          summary: 'Discover agents in registry',
          responses: { 200: { description: 'Agent registry entries' } },
        },
      },
      '/api/identity/zk-proof': {
        post: {
          tags: ['Identity'],
          summary: 'Generate a ZK proof',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'ZK proof generated' } },
        },
      },

      // ── Analytics ──
      '/api/analytics/trends': {
        get: {
          tags: ['Analytics'],
          summary: 'Get market trends',
          responses: { 200: { description: 'Market trend data' } },
        },
      },
      '/api/analytics/trends/{coinId}': {
        get: {
          tags: ['Analytics'],
          summary: 'Analyze trend for a specific asset',
          parameters: [{ name: 'coinId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Asset trend analysis' } },
        },
      },
      '/api/analytics/market-overview': {
        get: {
          tags: ['Analytics'],
          summary: 'Get market overview with Fear & Greed',
          responses: { 200: { description: 'Market overview' } },
        },
      },
      '/api/analytics/defi-trends': {
        get: {
          tags: ['Analytics'],
          summary: 'Get DeFi TVL trends',
          responses: { 200: { description: 'DeFi trend data' } },
        },
      },
      '/api/analytics/carbon': {
        get: {
          tags: ['Analytics'],
          summary: 'Get carbon tracking report',
          responses: { 200: { description: 'Carbon/ESG metrics' } },
        },
      },
      '/api/analytics/risk-dashboard': {
        get: {
          tags: ['Analytics'],
          summary: 'Get risk dashboard snapshot',
          responses: { 200: { description: 'Risk dashboard data' } },
        },
      },

      // ── MCP ──
      '/api/mcp/manifest': {
        get: {
          tags: ['MCP'],
          summary: 'Get MCP server manifest',
          responses: { 200: { description: 'MCP manifest with capabilities' } },
        },
      },
      '/api/mcp/discover': {
        get: {
          tags: ['MCP'],
          summary: 'Discover agents by capability',
          parameters: [
            { name: 'capability', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Discovery results' } },
        },
      },
      '/api/mcp/capabilities': {
        get: {
          tags: ['MCP'],
          summary: 'List all MCP capabilities',
          responses: { 200: { description: 'Capability catalog' } },
        },
      },
      '/api/mcp/request': {
        post: {
          tags: ['MCP'],
          summary: 'Send a request to another agent',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Agent response' } },
        },
      },
      '/api/mcp/stats': {
        get: {
          tags: ['MCP'],
          summary: 'Get MCP server statistics',
          responses: { 200: { description: 'MCP stats' } },
        },
      },

      // ── Revenue ──
      '/api/revenue/listings': {
        get: {
          tags: ['Revenue'],
          summary: 'List skill marketplace listings',
          responses: { 200: { description: 'Skill listings' } },
        },
        post: {
          tags: ['Revenue'],
          summary: 'List a skill on the marketplace',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Listing created' } },
        },
      },
      '/api/revenue/earnings/{agentId}': {
        get: {
          tags: ['Revenue'],
          summary: 'Get agent earnings',
          parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Agent earnings breakdown' } },
        },
      },
      '/api/revenue/marketplace/stats': {
        get: {
          tags: ['Revenue'],
          summary: 'Get marketplace statistics',
          responses: { 200: { description: 'Marketplace stats' } },
        },
      },

      // ── WebSocket ──
      '/api/events': {
        get: {
          tags: ['WebSocket'],
          summary: 'Get recent events',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          ],
          responses: { 200: { description: 'Recent events' } },
        },
      },
      '/api/events/stream': {
        get: {
          tags: ['WebSocket'],
          summary: 'Server-Sent Events stream',
          responses: { 200: { description: 'SSE event stream', content: { 'text/event-stream': {} } } },
        },
      },
      '/api/events/stats': {
        get: {
          tags: ['WebSocket'],
          summary: 'Get event hub statistics',
          responses: { 200: { description: 'Event stats' } },
        },
      },

      // ── Scenarios ──
      '/api/scenarios/run': {
        post: {
          tags: ['Agent'],
          summary: 'Run a predefined scenario',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { scenario: { type: 'string', enum: ['happy-path', 'guardrails', 'hold-gate', 'skill-audit', 'full-cycle'] } } } } },
          },
          responses: { 200: { description: 'Scenario results' } },
        },
      },

      // ── Fraud ──
      '/api/fraud/scan': {
        post: {
          tags: ['Identity'],
          summary: 'Run GNN fraud scan on agent graph',
          requestBody: { required: true, content: { 'application/json': {} } },
          responses: { 200: { description: 'Fraud scan results' } },
        },
      },
    },

    components: {
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            agent: { type: 'string', example: 'ridhwan-agent-01' },
            uptime: { type: 'number', example: 3600 },
          },
        },
        PolicyInput: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            version: { type: 'string' },
            rules: { type: 'object' },
          },
        },
        OrderInput: {
          type: 'object',
          required: ['agentId', 'symbol', 'type', 'side', 'quantity'],
          properties: {
            agentId: { type: 'string' },
            symbol: { type: 'string' },
            type: { type: 'string', enum: ['market', 'limit', 'stop_loss', 'take_profit'] },
            side: { type: 'string', enum: ['buy', 'sell'] },
            quantity: { type: 'number' },
            price: { type: 'number' },
          },
        },
        VerifyInput: {
          type: 'object',
          required: ['address'],
          properties: {
            address: { type: 'string', description: 'Contract address' },
            chain: { type: 'string', default: 'base' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
  };
}
