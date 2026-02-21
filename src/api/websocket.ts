// ============================================================
// src/api/websocket.ts — WebSocket Real-Time Event System
// ============================================================
// Pushes real-time events over WebSocket for:
//   - Risk alerts, policy decisions, audit events
//   - Trade executions, price updates, position changes
//   - Agent actions, heartbeats, anomaly detection
//   - MCP requests and inter-agent communication
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ---- Types ----

export type EventCategory =
  | 'risk'
  | 'policy'
  | 'audit'
  | 'trade'
  | 'price'
  | 'agent'
  | 'mcp'
  | 'governance'
  | 'compliance'
  | 'system';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface WSEvent {
  id: string;
  category: EventCategory;
  type: string;
  severity: EventSeverity;
  data: any;
  timestamp: string;
  source: string;
}

export interface WSSubscription {
  id: string;
  clientId: string;
  categories: EventCategory[];
  filters?: Record<string, any>;
  createdAt: string;
}

export interface WSClient {
  id: string;
  connectedAt: string;
  subscriptions: WSSubscription[];
  lastPing: string;
  messagesSent: number;
}

export interface WSStats {
  connectedClients: number;
  totalEvents: number;
  totalMessagesSent: number;
  eventsByCategory: Record<string, number>;
  uptime: number;
  eventsPerMinute: number;
}

// ---- WebSocket Event Hub ----

/**
 * In-process event hub that can be attached to a real WebSocket server.
 * Stores events in memory and provides subscription-based dispatch.
 * Can be integrated with ws/socket.io when a WS server is present.
 */
export class WebSocketEventHub {
  private events: WSEvent[] = [];
  private clients: Map<string, WSClient> = new Map();
  private subscriptions: Map<string, WSSubscription> = new Map();
  private listeners: Map<string, (event: WSEvent) => void> = new Map();
  private maxEvents: number = 10000;
  private startedAt: number = Date.now();

  // ── Event Publishing ──

  /**
   * Emit an event to all subscribed listeners
   */
  emit(params: {
    category: EventCategory;
    type: string;
    severity?: EventSeverity;
    data: any;
    source?: string;
  }): WSEvent {
    const event: WSEvent = {
      id: uuidv4(),
      category: params.category,
      type: params.type,
      severity: params.severity || 'info',
      data: params.data,
      timestamp: new Date().toISOString(),
      source: params.source || 'ridhwan',
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Dispatch to listeners
    for (const [clientId, callback] of this.listeners) {
      const sub = Array.from(this.subscriptions.values())
        .find(s => s.clientId === clientId);

      if (!sub || sub.categories.includes(params.category)) {
        try {
          callback(event);
          const client = this.clients.get(clientId);
          if (client) client.messagesSent++;
        } catch (err: any) {
          logger.warn(`[WS] Failed to deliver event to ${clientId}: ${err.message}`);
        }
      }
    }

    return event;
  }

  // ── Convenience Emitters ──

  emitRiskAlert(agentId: string, riskScore: number, details: string): WSEvent {
    return this.emit({
      category: 'risk',
      type: 'risk_alert',
      severity: riskScore > 80 ? 'critical' : riskScore > 60 ? 'error' : riskScore > 40 ? 'warning' : 'info',
      data: { agentId, riskScore, details },
    });
  }

  emitPolicyDecision(agentId: string, action: string, decision: string, reasons: string[]): WSEvent {
    return this.emit({
      category: 'policy',
      type: 'policy_decision',
      severity: decision === 'deny' ? 'warning' : 'info',
      data: { agentId, action, decision, reasons },
    });
  }

  emitAuditEvent(action: string, agentId: string, details: any): WSEvent {
    return this.emit({
      category: 'audit',
      type: 'audit_log',
      severity: 'info',
      data: { action, agentId, details },
    });
  }

  emitTradeExecution(trade: any): WSEvent {
    return this.emit({
      category: 'trade',
      type: 'trade_executed',
      severity: 'info',
      data: trade,
    });
  }

  emitPriceUpdate(symbol: string, price: number, change24h: number): WSEvent {
    return this.emit({
      category: 'price',
      type: 'price_update',
      severity: Math.abs(change24h) > 10 ? 'warning' : 'info',
      data: { symbol, price, change24h },
    });
  }

  emitAgentAction(agentId: string, actionClass: string, status: string, details?: any): WSEvent {
    return this.emit({
      category: 'agent',
      type: 'agent_action',
      severity: status === 'failed' ? 'error' : 'info',
      data: { agentId, actionClass, status, ...details },
    });
  }

  emitMCPRequest(from: string, to: string, capability: string): WSEvent {
    return this.emit({
      category: 'mcp',
      type: 'mcp_request',
      severity: 'info',
      data: { from, to, capability },
    });
  }

  emitGovernanceEvent(type: string, details: any): WSEvent {
    return this.emit({
      category: 'governance',
      type: `governance_${type}`,
      severity: 'info',
      data: details,
    });
  }

  emitComplianceAlert(entity: string, standard: string, passed: boolean, details: string): WSEvent {
    return this.emit({
      category: 'compliance',
      type: 'compliance_check',
      severity: passed ? 'info' : 'warning',
      data: { entity, standard, passed, details },
    });
  }

  emitSystemEvent(type: string, data: any): WSEvent {
    return this.emit({
      category: 'system',
      type: `system_${type}`,
      severity: 'info',
      data,
    });
  }

  // ── Client Management ──

  /**
   * Register a new client connection
   */
  registerClient(clientId?: string): WSClient {
    const id = clientId || uuidv4();
    const client: WSClient = {
      id,
      connectedAt: new Date().toISOString(),
      subscriptions: [],
      lastPing: new Date().toISOString(),
      messagesSent: 0,
    };

    this.clients.set(id, client);
    logger.info(`[WS] Client connected: ${id}`);
    return client;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    this.listeners.delete(clientId);
    // Remove client's subscriptions
    for (const [subId, sub] of this.subscriptions) {
      if (sub.clientId === clientId) {
        this.subscriptions.delete(subId);
      }
    }
    logger.info(`[WS] Client disconnected: ${clientId}`);
  }

  /**
   * Subscribe a client to event categories
   */
  subscribe(clientId: string, categories: EventCategory[], callback?: (event: WSEvent) => void): WSSubscription {
    const sub: WSSubscription = {
      id: uuidv4(),
      clientId,
      categories,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(sub.id, sub);

    if (callback) {
      this.listeners.set(clientId, callback);
    }

    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.push(sub);
    }

    logger.info(`[WS] Client ${clientId} subscribed to: ${categories.join(', ')}`);
    return sub;
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  // ── Queries ──

  /**
   * Get recent events
   */
  getEvents(params?: {
    category?: EventCategory;
    severity?: EventSeverity;
    since?: string;
    limit?: number;
  }): WSEvent[] {
    let events = this.events;

    if (params?.category) events = events.filter(e => e.category === params.category);
    if (params?.severity) events = events.filter(e => e.severity === params.severity);
    if (params?.since) events = events.filter(e => e.timestamp > params.since!);

    return events.slice(-(params?.limit || 100));
  }

  /**
   * Get event stream (for SSE fallback)
   */
  getEventStream(since?: string): WSEvent[] {
    if (since) {
      return this.events.filter(e => e.timestamp > since);
    }
    return this.events.slice(-50);
  }

  /**
   * Get statistics
   */
  getStats(): WSStats {
    const eventsByCategory: Record<string, number> = {};
    for (const event of this.events) {
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;
    }

    const uptime = Date.now() - this.startedAt;
    const minutes = Math.max(1, uptime / 60000);

    return {
      connectedClients: this.clients.size,
      totalEvents: this.events.length,
      totalMessagesSent: Array.from(this.clients.values())
        .reduce((s, c) => s + c.messagesSent, 0),
      eventsByCategory,
      uptime,
      eventsPerMinute: this.events.length / minutes,
    };
  }

  /**
   * Get connected clients
   */
  getClients(): WSClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Express.js middleware for SSE (Server-Sent Events) fallback
   */
  sseMiddleware() {
    return (req: any, res: any) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const clientId = this.registerClient().id;

      // Send initial events
      const recent = this.getEventStream();
      for (const event of recent) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      // Subscribe to new events
      this.subscribe(clientId, ['risk', 'trade', 'agent', 'system', 'compliance'], (event) => {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          this.removeClient(clientId);
        }
      });

      // Cleanup on disconnect
      req.on('close', () => {
        this.removeClient(clientId);
      });
    };
  }
}

export const wsEventHub = new WebSocketEventHub();
