// ============================================================
// src/api/mcp-server.ts — Model Context Protocol (MCP) Server
// ============================================================
// Exposes Ridhwan agent capabilities via the MCP standard
// for agent-to-agent discovery, capability negotiation,
// and inter-agent communication channels.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ---- Types ----

export interface MCPCapability {
  name: string;
  version: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  category: string;
  costPerCall: number; // SURGE tokens
  rateLimit: number;   // calls per minute
  avgLatency: number;  // ms
}

export interface MCPAgent {
  id: string;
  name: string;
  did: string;
  capabilities: MCPCapability[];
  endpoint: string;
  status: 'online' | 'offline' | 'busy';
  trustScore: number;
  registeredAt: string;
  lastSeen: string;
  metadata: Record<string, any>;
}

export interface MCPRequest {
  id: string;
  fromAgent: string;
  toAgent: string;
  capability: string;
  params: Record<string, any>;
  timestamp: string;
  timeout: number; // ms
}

export interface MCPResponse {
  id: string;
  requestId: string;
  fromAgent: string;
  success: boolean;
  result?: any;
  error?: string;
  latency: number;
  cost: number;
  timestamp: string;
}

export interface MCPChannel {
  id: string;
  agents: string[];
  purpose: string;
  created: string;
  messages: MCPMessage[];
  isActive: boolean;
}

export interface MCPMessage {
  id: string;
  channelId: string;
  from: string;
  type: 'request' | 'response' | 'broadcast' | 'heartbeat';
  content: any;
  timestamp: string;
}

export interface MCPDiscoveryResult {
  agents: MCPAgent[];
  totalAvailable: number;
  matchedCapabilities: string[];
  searchCriteria: Record<string, any>;
  timestamp: string;
}

export interface MCPStats {
  registeredAgents: number;
  onlineAgents: number;
  totalCapabilities: number;
  totalRequests: number;
  totalResponses: number;
  avgLatency: number;
  activeChannels: number;
  uptime: number;
}

// ---- MCP Server ----

export class MCPServer {
  private agents: Map<string, MCPAgent> = new Map();
  private requests: MCPRequest[] = [];
  private responses: MCPResponse[] = [];
  private channels: Map<string, MCPChannel> = new Map();
  private startedAt: number = Date.now();

  // Self-agent capabilities
  private readonly selfCapabilities: MCPCapability[] = [
    {
      name: 'fraud_detection',
      version: '2.0.0',
      description: 'GNN-based fraud detection with graph analysis and circular flow detection',
      inputSchema: { type: 'object', properties: { transactions: { type: 'array' }, agentId: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { riskScore: { type: 'number' }, alerts: { type: 'array' } } },
      category: 'security',
      costPerCall: 2.0,
      rateLimit: 30,
      avgLatency: 150,
    },
    {
      name: 'policy_evaluation',
      version: '1.0.0',
      description: 'Multi-constraint policy evaluation with budget, address, and risk checks',
      inputSchema: { type: 'object', properties: { action: { type: 'object' }, policyId: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { decision: { type: 'string' }, reasons: { type: 'array' } } },
      category: 'governance',
      costPerCall: 0.5,
      rateLimit: 100,
      avgLatency: 50,
    },
    {
      name: 'smart_contract_verify',
      version: '1.0.0',
      description: 'Smart contract security verification with vulnerability scanning and compliance checks',
      inputSchema: { type: 'object', properties: { address: { type: 'string' }, chain: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { riskScore: { type: 'number' }, vulnerabilities: { type: 'array' } } },
      category: 'security',
      costPerCall: 5.0,
      rateLimit: 10,
      avgLatency: 2000,
    },
    {
      name: 'trading_execute',
      version: '1.0.0',
      description: 'Autonomous trading with order management, FIFO PnL, and risk limits',
      inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string' }, quantity: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { orderId: { type: 'string' }, status: { type: 'string' } } },
      category: 'trading',
      costPerCall: 1.0,
      rateLimit: 60,
      avgLatency: 100,
    },
    {
      name: 'yield_optimization',
      version: '1.0.0',
      description: 'Cross-chain DeFi yield optimization with auto-rebalancing',
      inputSchema: { type: 'object', properties: { amount: { type: 'number' }, strategy: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { allocations: { type: 'array' }, projectedApy: { type: 'number' } } },
      category: 'defi',
      costPerCall: 3.0,
      rateLimit: 20,
      avgLatency: 500,
    },
    {
      name: 'compliance_check',
      version: '1.0.0',
      description: 'Regulatory compliance verification (MiCA, SEC, FATF standards)',
      inputSchema: { type: 'object', properties: { entityType: { type: 'string' }, data: { type: 'object' } } },
      outputSchema: { type: 'object', properties: { compliant: { type: 'boolean' }, checks: { type: 'array' } } },
      category: 'compliance',
      costPerCall: 4.0,
      rateLimit: 20,
      avgLatency: 300,
    },
    {
      name: 'market_analysis',
      version: '1.0.0',
      description: 'Real-time market trend analysis with momentum indicators and anomaly detection',
      inputSchema: { type: 'object', properties: { asset: { type: 'string' }, timeframe: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { trend: { type: 'object' }, signals: { type: 'array' } } },
      category: 'analytics',
      costPerCall: 1.5,
      rateLimit: 30,
      avgLatency: 200,
    },
    {
      name: 'credit_scoring',
      version: '1.0.0',
      description: 'Multi-factor agent credit scoring (AAA-D grades, 0-1000 scale)',
      inputSchema: { type: 'object', properties: { agentId: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { score: { type: 'number' }, grade: { type: 'string' } } },
      category: 'risk',
      costPerCall: 1.0,
      rateLimit: 60,
      avgLatency: 50,
    },
  ];

  constructor() {
    this.seedDemoAgents();
  }

  // ── Registration ──

  /**
   * Register self as an MCP agent
   */
  registerSelf(agentId: string, name: string, did: string, endpoint: string): MCPAgent {
    const agent: MCPAgent = {
      id: agentId,
      name,
      did,
      capabilities: this.selfCapabilities,
      endpoint,
      status: 'online',
      trustScore: 95,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      metadata: {
        version: '1.0.0',
        runtime: 'openclaw',
        chain: 'base',
        specialization: ['compliance', 'trading', 'security'],
      },
    };

    this.agents.set(agentId, agent);
    logger.info(`[MCP] Registered self as agent: ${name} (${agentId})`);
    return agent;
  }

  /**
   * Register an external agent
   */
  registerAgent(params: {
    id: string;
    name: string;
    did: string;
    capabilities: MCPCapability[];
    endpoint: string;
    metadata?: Record<string, any>;
  }): MCPAgent {
    const agent: MCPAgent = {
      id: params.id,
      name: params.name,
      did: params.did,
      capabilities: params.capabilities,
      endpoint: params.endpoint,
      status: 'online',
      trustScore: 50,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      metadata: params.metadata || {},
    };

    this.agents.set(params.id, agent);
    logger.info(`[MCP] Registered agent: ${params.name} (${params.id}) with ${params.capabilities.length} capabilities`);
    return agent;
  }

  // ── Discovery ──

  /**
   * Discover agents by capability
   */
  discoverAgents(params?: {
    capability?: string;
    category?: string;
    minTrustScore?: number;
    status?: MCPAgent['status'];
    maxCost?: number;
  }): MCPDiscoveryResult {
    let agents = Array.from(this.agents.values());

    if (params?.capability) {
      agents = agents.filter(a =>
        a.capabilities.some(c => c.name.includes(params.capability!))
      );
    }
    if (params?.category) {
      agents = agents.filter(a =>
        a.capabilities.some(c => c.category === params.category)
      );
    }
    if (params?.minTrustScore) {
      agents = agents.filter(a => a.trustScore >= params.minTrustScore!);
    }
    if (params?.status) {
      agents = agents.filter(a => a.status === params.status);
    }
    if (params?.maxCost) {
      agents = agents.filter(a =>
        a.capabilities.some(c => c.costPerCall <= params.maxCost!)
      );
    }

    const matchedCapabilities = new Set<string>();
    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        if (!params?.capability || cap.name.includes(params.capability)) {
          matchedCapabilities.add(cap.name);
        }
      }
    }

    return {
      agents,
      totalAvailable: agents.length,
      matchedCapabilities: Array.from(matchedCapabilities),
      searchCriteria: params || {},
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get a specific agent
   */
  getAgent(agentId: string): MCPAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all capabilities across all agents
   */
  listCapabilities(): { capability: string; agents: string[]; avgCost: number; category: string }[] {
    const capMap: Record<string, { agents: string[]; costs: number[]; category: string }> = {};

    for (const agent of this.agents.values()) {
      for (const cap of agent.capabilities) {
        if (!capMap[cap.name]) {
          capMap[cap.name] = { agents: [], costs: [], category: cap.category };
        }
        capMap[cap.name].agents.push(agent.id);
        capMap[cap.name].costs.push(cap.costPerCall);
      }
    }

    return Object.entries(capMap).map(([name, data]) => ({
      capability: name,
      agents: data.agents,
      avgCost: data.costs.reduce((s, c) => s + c, 0) / data.costs.length,
      category: data.category,
    }));
  }

  // ── Communication ──

  /**
   * Send a request to another agent
   */
  sendRequest(fromAgent: string, toAgent: string, capability: string, params: Record<string, any>): MCPResponse {
    const target = this.agents.get(toAgent);
    if (!target) throw new Error(`Agent ${toAgent} not found`);
    if (target.status !== 'online') throw new Error(`Agent ${toAgent} is ${target.status}`);

    const cap = target.capabilities.find(c => c.name === capability);
    if (!cap) throw new Error(`Agent ${toAgent} does not support capability: ${capability}`);

    const request: MCPRequest = {
      id: uuidv4(),
      fromAgent,
      toAgent,
      capability,
      params,
      timestamp: new Date().toISOString(),
      timeout: 30000,
    };
    this.requests.push(request);

    // Simulate response (in production, this would be an actual HTTP/WS call)
    const startTime = Date.now();
    const response: MCPResponse = {
      id: uuidv4(),
      requestId: request.id,
      fromAgent: toAgent,
      success: true,
      result: {
        capability,
        message: `Request processed by ${target.name}`,
        data: this.simulateCapabilityResponse(capability, params),
      },
      error: undefined,
      latency: cap.avgLatency + Math.random() * 50,
      cost: cap.costPerCall,
      timestamp: new Date().toISOString(),
    };
    this.responses.push(response);

    logger.info(`[MCP] Request ${request.id}: ${fromAgent} → ${toAgent} (${capability}) — ${response.latency.toFixed(0)}ms, $${response.cost}`);
    return response;
  }

  /**
   * Create a communication channel between agents
   */
  createChannel(agents: string[], purpose: string): MCPChannel {
    const channel: MCPChannel = {
      id: uuidv4(),
      agents,
      purpose,
      created: new Date().toISOString(),
      messages: [],
      isActive: true,
    };

    this.channels.set(channel.id, channel);
    logger.info(`[MCP] Channel created: ${channel.id} — ${agents.join(', ')} — ${purpose}`);
    return channel;
  }

  /**
   * Send a message on a channel
   */
  sendMessage(channelId: string, from: string, type: MCPMessage['type'], content: any): MCPMessage {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if (!channel.isActive) throw new Error('Channel is closed');

    const message: MCPMessage = {
      id: uuidv4(),
      channelId,
      from,
      type,
      content,
      timestamp: new Date().toISOString(),
    };

    channel.messages.push(message);
    return message;
  }

  /**
   * Get channel messages
   */
  getChannelMessages(channelId: string, limit: number = 50): MCPMessage[] {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    return channel.messages.slice(-limit);
  }

  // ── Stats ──

  /**
   * Get MCP server statistics
   */
  getStats(): MCPStats {
    const agents = Array.from(this.agents.values());
    const totalLatency = this.responses.reduce((s, r) => s + r.latency, 0);

    return {
      registeredAgents: agents.length,
      onlineAgents: agents.filter(a => a.status === 'online').length,
      totalCapabilities: agents.reduce((s, a) => s + a.capabilities.length, 0),
      totalRequests: this.requests.length,
      totalResponses: this.responses.length,
      avgLatency: this.responses.length > 0 ? totalLatency / this.responses.length : 0,
      activeChannels: Array.from(this.channels.values()).filter(c => c.isActive).length,
      uptime: Date.now() - this.startedAt,
    };
  }

  /**
   * Get MCP manifest (OpenAPI-like)
   */
  getManifest(): Record<string, any> {
    return {
      name: 'Ridhwan MCP Server',
      version: '1.0.0',
      description: 'Enterprise Trust & Commerce Mesh for Autonomous AI Agents',
      protocol: 'MCP/1.0',
      capabilities: this.selfCapabilities,
      endpoints: {
        discover: '/api/mcp/discover',
        request: '/api/mcp/request',
        channel: '/api/mcp/channel',
        capabilities: '/api/mcp/capabilities',
        agents: '/api/mcp/agents',
        stats: '/api/mcp/stats',
        manifest: '/api/mcp/manifest',
      },
      authentication: {
        type: 'bearer',
        scheme: 'DID-based',
      },
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
      },
    };
  }

  // ── Internals ──

  private simulateCapabilityResponse(capability: string, params: Record<string, any>): any {
    switch (capability) {
      case 'fraud_detection':
        return { riskScore: Math.random() * 100, alerts: [], scannedTransactions: 42 };
      case 'policy_evaluation':
        return { decision: 'allow', reasons: ['Within budget', 'Trusted address'], confidence: 0.95 };
      case 'smart_contract_verify':
        return { riskScore: Math.floor(Math.random() * 40), vulnerabilities: [], safe: true };
      case 'trading_execute':
        return { orderId: uuidv4(), status: 'filled', price: 1.0 + Math.random() };
      case 'yield_optimization':
        return { allocations: [{ protocol: 'Aave', share: 0.5 }, { protocol: 'Compound', share: 0.5 }], projectedApy: 5.2 };
      case 'compliance_check':
        return { compliant: true, checks: [{ name: 'MiCA', passed: true }] };
      case 'market_analysis':
        return { trend: 'bullish', rsi: 55 + Math.random() * 20, confidence: 0.75 };
      case 'credit_scoring':
        return { score: 750 + Math.floor(Math.random() * 200), grade: 'AA' };
      default:
        return { message: 'Capability processed', params };
    }
  }

  private seedDemoAgents(): void {
    const demoAgents: Partial<MCPAgent>[] = [
      {
        id: 'agent-compliance-bot',
        name: 'ComplianceBot',
        did: 'did:ridhwan:compliance-bot',
        capabilities: [
          { name: 'kyc_verification', version: '1.0.0', description: 'KYC/AML identity verification', inputSchema: {}, outputSchema: {}, category: 'compliance', costPerCall: 3.0, rateLimit: 20, avgLatency: 800 },
          { name: 'sanctions_screening', version: '1.0.0', description: 'OFAC and global sanctions screening', inputSchema: {}, outputSchema: {}, category: 'compliance', costPerCall: 2.0, rateLimit: 50, avgLatency: 200 },
        ],
        endpoint: 'https://compliance-bot.example.com/mcp',
        status: 'online',
        trustScore: 88,
      },
      {
        id: 'agent-data-oracle',
        name: 'DataOracle',
        did: 'did:ridhwan:data-oracle',
        capabilities: [
          { name: 'price_feed', version: '2.0.0', description: 'Real-time price feeds for 10000+ tokens', inputSchema: {}, outputSchema: {}, category: 'data', costPerCall: 0.1, rateLimit: 500, avgLatency: 30 },
          { name: 'gas_estimation', version: '1.0.0', description: 'Multi-chain gas price estimation', inputSchema: {}, outputSchema: {}, category: 'data', costPerCall: 0.05, rateLimit: 1000, avgLatency: 20 },
        ],
        endpoint: 'https://data-oracle.example.com/mcp',
        status: 'online',
        trustScore: 92,
      },
      {
        id: 'agent-liquidity-provider',
        name: 'LiquidityEngine',
        did: 'did:ridhwan:liquidity-engine',
        capabilities: [
          { name: 'provide_liquidity', version: '1.0.0', description: 'Cross-DEX liquidity provisioning', inputSchema: {}, outputSchema: {}, category: 'defi', costPerCall: 5.0, rateLimit: 10, avgLatency: 3000 },
          { name: 'swap_routing', version: '1.0.0', description: 'Optimal swap routing across DEXs', inputSchema: {}, outputSchema: {}, category: 'defi', costPerCall: 1.0, rateLimit: 30, avgLatency: 500 },
        ],
        endpoint: 'https://liquidity-engine.example.com/mcp',
        status: 'online',
        trustScore: 80,
      },
      {
        id: 'agent-audit-firm',
        name: 'AuditChain',
        did: 'did:ridhwan:audit-chain',
        capabilities: [
          { name: 'full_audit', version: '1.0.0', description: 'Comprehensive smart contract audit', inputSchema: {}, outputSchema: {}, category: 'security', costPerCall: 50.0, rateLimit: 2, avgLatency: 30000 },
        ],
        endpoint: 'https://audit-chain.example.com/mcp',
        status: 'online',
        trustScore: 95,
      },
    ];

    for (const data of demoAgents) {
      const agent: MCPAgent = {
        id: data.id!,
        name: data.name!,
        did: data.did!,
        capabilities: data.capabilities!,
        endpoint: data.endpoint!,
        status: data.status as any,
        trustScore: data.trustScore!,
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        metadata: {},
      };
      this.agents.set(agent.id, agent);
    }
  }
}

export const mcpServer = new MCPServer();
