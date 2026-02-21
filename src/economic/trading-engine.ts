// ============================================================
// src/economic/trading-engine.ts — Autonomous Agent Trading Engine
// ============================================================
// Comprehensive trading engine with order book management,
// FIFO-based PnL accounting, position tracking, risk management,
// and leaderboard support for the SuperMolt Arena.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import { logger } from '../utils/logger';

// ---- Types ----

export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'expired' | 'rejected';

export interface Order {
  id: string;
  agentId: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;          // Required for limit, stop_loss, take_profit
  triggerPrice?: number;   // For stop_loss / take_profit
  filledQuantity: number;
  averageFillPrice: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface Position {
  symbol: string;
  agentId: string;
  side: 'long' | 'short';
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  costBasis: number;
  /** FIFO lot queue: tracks each purchase lot for cost basis calculation */
  lots: Array<{ quantity: number; price: number; timestamp: number }>;
  openedAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  orderId: string;
  agentId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fee: number;
  pnl: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  agentId: string;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  bestTrade: number;
  worstTrade: number;
  totalFees: number;
  returnOnCapital: number;
  calculatedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  score: number;
}

export interface RiskLimits {
  maxPositionSizeUsd: number;
  maxLossPerTradeUsd: number;
  dailyLossLimitUsd: number;
  maxOpenOrders: number;
  maxPositions: number;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: Order[];
}

interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];  // Sorted descending by price
  asks: OrderBookLevel[];  // Sorted ascending by price
  lastTradePrice: number;
  updatedAt: number;
}

// ---- Trading Engine ----

export class TradingEngine {
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();  // key: `${agentId}:${symbol}`
  private trades: Trade[] = [];
  private orderBooks: Map<string, OrderBook> = new Map();
  private dailyLosses: Map<string, number> = new Map();  // key: `${agentId}:${dateStr}`
  private initialCapital: Map<string, number> = new Map(); // per-agent capital
  private equityCurves: Map<string, number[]> = new Map(); // per-agent equity snapshots

  private readonly FEE_RATE = 0.001; // 0.1% trading fee
  private readonly DEFAULT_RISK_LIMITS: RiskLimits = {
    maxPositionSizeUsd: 10000,
    maxLossPerTradeUsd: 500,
    dailyLossLimitUsd: 2000,
    maxOpenOrders: 50,
    maxPositions: 20,
  };
  private riskLimits: Map<string, RiskLimits> = new Map();

  constructor() {
    logger.info('[TradingEngine] Initialized');
  }

  // ---- Risk Limits ----

  setRiskLimits(agentId: string, limits: Partial<RiskLimits>): RiskLimits {
    const current = this.riskLimits.get(agentId) || { ...this.DEFAULT_RISK_LIMITS };
    const updated = { ...current, ...limits };
    this.riskLimits.set(agentId, updated);
    logger.info(`[TradingEngine] Risk limits updated for agent ${agentId}`);
    return updated;
  }

  getRiskLimits(agentId: string): RiskLimits {
    return this.riskLimits.get(agentId) || { ...this.DEFAULT_RISK_LIMITS };
  }

  setInitialCapital(agentId: string, capital: number): void {
    this.initialCapital.set(agentId, capital);
    if (!this.equityCurves.has(agentId)) {
      this.equityCurves.set(agentId, [capital]);
    }
    logger.info(`[TradingEngine] Initial capital set for ${agentId}: $${capital}`);
  }

  // ---- Order Book Management ----

  private getOrCreateOrderBook(symbol: string): OrderBook {
    let book = this.orderBooks.get(symbol);
    if (!book) {
      book = { symbol, bids: [], asks: [], lastTradePrice: 0, updatedAt: Date.now() };
      this.orderBooks.set(symbol, book);
    }
    return book;
  }

  private addToOrderBook(order: Order): void {
    const book = this.getOrCreateOrderBook(order.symbol);
    const side = order.side === 'buy' ? book.bids : book.asks;
    const price = order.price!;

    const existingLevel = side.find(l => l.price === price);
    if (existingLevel) {
      existingLevel.quantity += order.quantity - order.filledQuantity;
      existingLevel.orders.push(order);
    } else {
      side.push({ price, quantity: order.quantity - order.filledQuantity, orders: [order] });
    }

    // Sort: bids descending, asks ascending
    if (order.side === 'buy') {
      book.bids.sort((a, b) => b.price - a.price);
    } else {
      book.asks.sort((a, b) => a.price - b.price);
    }
    book.updatedAt = Date.now();
  }

  private removeFromOrderBook(order: Order): void {
    const book = this.orderBooks.get(order.symbol);
    if (!book) return;
    const side = order.side === 'buy' ? book.bids : book.asks;

    for (let i = side.length - 1; i >= 0; i--) {
      const level = side[i];
      const idx = level.orders.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        const removedQty = order.quantity - order.filledQuantity;
        level.quantity -= removedQty;
        level.orders.splice(idx, 1);
        if (level.orders.length === 0 || level.quantity <= 0) {
          side.splice(i, 1);
        }
        break;
      }
    }
    book.updatedAt = Date.now();
  }

  getOrderBook(symbol: string): { bids: Array<{ price: number; quantity: number }>; asks: Array<{ price: number; quantity: number }> } {
    const book = this.getOrCreateOrderBook(symbol);
    return {
      bids: book.bids.map(l => ({ price: l.price, quantity: l.quantity })),
      asks: book.asks.map(l => ({ price: l.price, quantity: l.quantity })),
    };
  }

  // ---- Risk Validation ----

  private validateRisk(order: Order): { valid: boolean; reason?: string } {
    const limits = this.getRiskLimits(order.agentId);
    const estimatedPrice = order.price || this.getLastPrice(order.symbol) || 0;
    const orderValue = order.quantity * estimatedPrice;

    // Check position size limit
    if (orderValue > limits.maxPositionSizeUsd) {
      return { valid: false, reason: `Order value $${orderValue.toFixed(2)} exceeds max position size $${limits.maxPositionSizeUsd}` };
    }

    // Check max open orders
    const openOrders = Array.from(this.orders.values()).filter(
      o => o.agentId === order.agentId && (o.status === 'open' || o.status === 'partially_filled')
    );
    if (openOrders.length >= limits.maxOpenOrders) {
      return { valid: false, reason: `Max open orders (${limits.maxOpenOrders}) reached` };
    }

    // Check max positions
    const positionCount = Array.from(this.positions.keys()).filter(k => k.startsWith(order.agentId + ':')).length;
    if (positionCount >= limits.maxPositions && !this.positions.has(`${order.agentId}:${order.symbol}`)) {
      return { valid: false, reason: `Max positions (${limits.maxPositions}) reached` };
    }

    // Check daily loss limit
    const dateKey = `${order.agentId}:${new Date().toISOString().slice(0, 10)}`;
    const dailyLoss = this.dailyLosses.get(dateKey) || 0;
    if (dailyLoss >= limits.dailyLossLimitUsd) {
      return { valid: false, reason: `Daily loss limit $${limits.dailyLossLimitUsd} reached (current: $${dailyLoss.toFixed(2)})` };
    }

    return { valid: true };
  }

  private getLastPrice(symbol: string): number {
    const book = this.orderBooks.get(symbol);
    if (book && book.lastTradePrice > 0) return book.lastTradePrice;
    // Fallback: midpoint of best bid/ask
    if (book && book.bids.length > 0 && book.asks.length > 0) {
      return (book.bids[0].price + book.asks[0].price) / 2;
    }
    return 0;
  }

  // ---- Set Market Price (for simulation / oracle feeds) ----

  setMarketPrice(symbol: string, price: number): void {
    const book = this.getOrCreateOrderBook(symbol);
    book.lastTradePrice = price;
    book.updatedAt = Date.now();

    // Update unrealized PnL for all positions in this symbol
    for (const [key, pos] of this.positions.entries()) {
      if (pos.symbol === symbol) {
        pos.currentPrice = price;
        if (pos.side === 'long') {
          pos.unrealizedPnl = (price - pos.averageEntryPrice) * pos.quantity;
        } else {
          pos.unrealizedPnl = (pos.averageEntryPrice - price) * pos.quantity;
        }
        pos.updatedAt = Date.now();
      }
    }

    // Check stop-loss and take-profit orders
    this.checkTriggerOrders(symbol, price);
  }

  private checkTriggerOrders(symbol: string, currentPrice: number): void {
    for (const order of this.orders.values()) {
      if (order.symbol !== symbol) continue;
      if (order.status !== 'open') continue;

      if (order.type === 'stop_loss' && order.triggerPrice) {
        // Stop-loss triggers when price falls below (for long) or rises above (for short)
        if (order.side === 'sell' && currentPrice <= order.triggerPrice) {
          logger.info(`[TradingEngine] Stop-loss triggered for order ${order.id} at $${currentPrice}`);
          this.executeTrade(order, currentPrice);
        } else if (order.side === 'buy' && currentPrice >= order.triggerPrice) {
          logger.info(`[TradingEngine] Stop-loss triggered for order ${order.id} at $${currentPrice}`);
          this.executeTrade(order, currentPrice);
        }
      }

      if (order.type === 'take_profit' && order.triggerPrice) {
        if (order.side === 'sell' && currentPrice >= order.triggerPrice) {
          logger.info(`[TradingEngine] Take-profit triggered for order ${order.id} at $${currentPrice}`);
          this.executeTrade(order, currentPrice);
        } else if (order.side === 'buy' && currentPrice <= order.triggerPrice) {
          logger.info(`[TradingEngine] Take-profit triggered for order ${order.id} at $${currentPrice}`);
          this.executeTrade(order, currentPrice);
        }
      }
    }
  }

  // ---- Place Order ----

  placeOrder(params: {
    agentId: string;
    symbol: string;
    type: OrderType;
    side: OrderSide;
    quantity: number;
    price?: number;
    triggerPrice?: number;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
  }): Order {
    // Validate required fields for specific order types
    if ((params.type === 'limit') && !params.price) {
      const rejected: Order = {
        id: uuidv4(),
        agentId: params.agentId,
        symbol: params.symbol,
        type: params.type,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        triggerPrice: params.triggerPrice,
        filledQuantity: 0,
        averageFillPrice: 0,
        status: 'rejected',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { rejectionReason: 'Limit orders require a price' },
      };
      logger.warn(`[TradingEngine] Order rejected: limit orders require a price`);
      return rejected;
    }

    if ((params.type === 'stop_loss' || params.type === 'take_profit') && !params.triggerPrice) {
      const rejected: Order = {
        id: uuidv4(),
        agentId: params.agentId,
        symbol: params.symbol,
        type: params.type,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        triggerPrice: params.triggerPrice,
        filledQuantity: 0,
        averageFillPrice: 0,
        status: 'rejected',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { rejectionReason: `${params.type} orders require a triggerPrice` },
      };
      logger.warn(`[TradingEngine] Order rejected: ${params.type} orders require a triggerPrice`);
      return rejected;
    }

    const order: Order = {
      id: uuidv4(),
      agentId: params.agentId,
      symbol: params.symbol,
      type: params.type,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
      triggerPrice: params.triggerPrice,
      filledQuantity: 0,
      averageFillPrice: 0,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: params.expiresAt,
      metadata: params.metadata,
    };

    // Risk validation
    const riskCheck = this.validateRisk(order);
    if (!riskCheck.valid) {
      order.status = 'rejected';
      order.metadata = { ...order.metadata, rejectionReason: riskCheck.reason };
      this.orders.set(order.id, order);
      logger.warn(`[TradingEngine] Order ${order.id} rejected: ${riskCheck.reason}`);
      return order;
    }

    this.orders.set(order.id, order);
    logger.info(`[TradingEngine] Order placed: ${order.side} ${order.quantity} ${order.symbol} @ ${order.type === 'market' ? 'market' : '$' + (order.price || order.triggerPrice)}`);

    // Market orders execute immediately
    if (order.type === 'market') {
      const marketPrice = this.getLastPrice(order.symbol);
      if (marketPrice > 0) {
        this.executeTrade(order, marketPrice);
      } else {
        // If no market price, try to match against the book
        this.matchOrder(order);
      }
    } else if (order.type === 'limit') {
      // Try to match limit order against book, otherwise add to book
      const matched = this.matchOrder(order);
      if (!matched && order.status === 'open') {
        this.addToOrderBook(order);
      }
    } else {
      // stop_loss / take_profit: add to pending, will be triggered by price updates
      // Don't add to order book; they wait for trigger
    }

    return order;
  }

  // ---- Match Order ----

  private matchOrder(order: Order): boolean {
    const book = this.getOrCreateOrderBook(order.symbol);
    const oppositeSide = order.side === 'buy' ? book.asks : book.bids;

    if (oppositeSide.length === 0) return false;

    let remainingQty = order.quantity - order.filledQuantity;
    let totalCost = 0;
    let totalFilled = 0;

    while (remainingQty > 0 && oppositeSide.length > 0) {
      const bestLevel = oppositeSide[0];

      // For limit orders, check price is acceptable
      if (order.type === 'limit' && order.price) {
        if (order.side === 'buy' && bestLevel.price > order.price) break;
        if (order.side === 'sell' && bestLevel.price < order.price) break;
      }

      const fillQty = Math.min(remainingQty, bestLevel.quantity);
      const fillPrice = bestLevel.price;

      // Execute against each resting order at this level
      let levelFilled = 0;
      for (let i = 0; i < bestLevel.orders.length && levelFilled < fillQty; i++) {
        const restingOrder = bestLevel.orders[i];
        const restingRemaining = restingOrder.quantity - restingOrder.filledQuantity;
        const matchQty = Math.min(fillQty - levelFilled, restingRemaining);

        restingOrder.filledQuantity += matchQty;
        restingOrder.averageFillPrice = fillPrice;
        restingOrder.updatedAt = Date.now();

        if (restingOrder.filledQuantity >= restingOrder.quantity) {
          restingOrder.status = 'filled';
        } else {
          restingOrder.status = 'partially_filled';
        }

        // Record trade for the resting order
        this.recordTrade(restingOrder, matchQty, fillPrice);
        this.updatePosition(restingOrder, matchQty, fillPrice);

        levelFilled += matchQty;
      }

      // Clean up filled orders from the level
      bestLevel.orders = bestLevel.orders.filter(o => o.status !== 'filled');
      bestLevel.quantity -= levelFilled;
      if (bestLevel.quantity <= 0 || bestLevel.orders.length === 0) {
        oppositeSide.shift();
      }

      totalCost += levelFilled * fillPrice;
      totalFilled += levelFilled;
      remainingQty -= levelFilled;
    }

    if (totalFilled > 0) {
      order.filledQuantity += totalFilled;
      order.averageFillPrice = totalCost / totalFilled;
      order.updatedAt = Date.now();
      order.status = order.filledQuantity >= order.quantity ? 'filled' : 'partially_filled';

      this.recordTrade(order, totalFilled, order.averageFillPrice);
      this.updatePosition(order, totalFilled, order.averageFillPrice);

      book.lastTradePrice = order.averageFillPrice;
      book.updatedAt = Date.now();

      logger.info(`[TradingEngine] Order ${order.id} matched: ${totalFilled} @ $${order.averageFillPrice.toFixed(4)}`);
      return true;
    }

    return false;
  }

  // ---- Execute Trade (direct fill at given price) ----

  executeTrade(order: Order, price: number): Trade {
    const remainingQty = order.quantity - order.filledQuantity;
    const fee = remainingQty * price * this.FEE_RATE;

    order.filledQuantity = order.quantity;
    order.averageFillPrice = price;
    order.status = 'filled';
    order.updatedAt = Date.now();

    const trade = this.recordTrade(order, remainingQty, price);
    this.updatePosition(order, remainingQty, price);

    const book = this.getOrCreateOrderBook(order.symbol);
    book.lastTradePrice = price;
    book.updatedAt = Date.now();

    logger.info(`[TradingEngine] Trade executed: ${order.side} ${remainingQty} ${order.symbol} @ $${price.toFixed(4)} (fee: $${fee.toFixed(4)})`);
    return trade;
  }

  // ---- Record Trade ----

  private recordTrade(order: Order, quantity: number, price: number): Trade {
    const fee = quantity * price * this.FEE_RATE;
    const pnl = this.calculateTradePnl(order, quantity, price);

    const trade: Trade = {
      id: uuidv4(),
      orderId: order.id,
      agentId: order.agentId,
      symbol: order.symbol,
      side: order.side,
      quantity,
      price,
      fee,
      pnl,
      timestamp: Date.now(),
    };

    this.trades.push(trade);

    // Track daily losses
    if (pnl < 0) {
      const dateKey = `${order.agentId}:${new Date().toISOString().slice(0, 10)}`;
      const current = this.dailyLosses.get(dateKey) || 0;
      this.dailyLosses.set(dateKey, current + Math.abs(pnl));
    }

    // Update equity curve
    this.updateEquityCurve(order.agentId);

    return trade;
  }

  // ---- FIFO PnL Calculation ----

  private calculateTradePnl(order: Order, quantity: number, price: number): number {
    const posKey = `${order.agentId}:${order.symbol}`;
    const position = this.positions.get(posKey);

    // Only sells against an existing long position or buys against a short generate realized PnL
    if (!position) return 0;

    if (order.side === 'sell' && position.side === 'long' && position.lots.length > 0) {
      return this.fifoRealize(position, quantity, price);
    }
    if (order.side === 'buy' && position.side === 'short' && position.lots.length > 0) {
      return this.fifoRealize(position, quantity, price);
    }

    return 0;
  }

  /** FIFO cost-basis realization: consume oldest lots first */
  private fifoRealize(position: Position, quantity: number, exitPrice: number): number {
    let remaining = quantity;
    let totalPnl = 0;

    while (remaining > 0 && position.lots.length > 0) {
      const lot = position.lots[0];
      const consumeQty = Math.min(remaining, lot.quantity);

      if (position.side === 'long') {
        totalPnl += (exitPrice - lot.price) * consumeQty;
      } else {
        totalPnl += (lot.price - exitPrice) * consumeQty;
      }

      lot.quantity -= consumeQty;
      remaining -= consumeQty;

      if (lot.quantity <= 0) {
        position.lots.shift();
      }
    }

    position.realizedPnl += totalPnl;
    return totalPnl;
  }

  // ---- Position Management ----

  private updatePosition(order: Order, quantity: number, price: number): void {
    const posKey = `${order.agentId}:${order.symbol}`;
    let position = this.positions.get(posKey);

    if (!position) {
      // Create new position
      position = {
        symbol: order.symbol,
        agentId: order.agentId,
        side: order.side === 'buy' ? 'long' : 'short',
        quantity: 0,
        averageEntryPrice: 0,
        currentPrice: price,
        unrealizedPnl: 0,
        realizedPnl: 0,
        costBasis: 0,
        lots: [],
        openedAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.positions.set(posKey, position);
    }

    const isIncreasing =
      (order.side === 'buy' && position.side === 'long') ||
      (order.side === 'sell' && position.side === 'short');

    if (isIncreasing) {
      // Add to position
      const totalCost = position.averageEntryPrice * position.quantity + price * quantity;
      position.quantity += quantity;
      position.averageEntryPrice = position.quantity > 0 ? totalCost / position.quantity : 0;
      position.costBasis += price * quantity;
      position.lots.push({ quantity, price, timestamp: Date.now() });
    } else {
      // Reduce position
      position.quantity -= quantity;

      if (position.quantity <= 0) {
        if (position.quantity < 0) {
          // Flip position
          const flippedQty = Math.abs(position.quantity);
          position.side = position.side === 'long' ? 'short' : 'long';
          position.quantity = flippedQty;
          position.averageEntryPrice = price;
          position.costBasis = price * flippedQty;
          position.lots = [{ quantity: flippedQty, price, timestamp: Date.now() }];
        } else {
          // Position closed
          this.positions.delete(posKey);
          logger.info(`[TradingEngine] Position closed: ${order.symbol} for agent ${order.agentId}`);
          return;
        }
      }
    }

    // Update unrealized PnL
    position.currentPrice = price;
    if (position.side === 'long') {
      position.unrealizedPnl = (price - position.averageEntryPrice) * position.quantity;
    } else {
      position.unrealizedPnl = (position.averageEntryPrice - price) * position.quantity;
    }
    position.updatedAt = Date.now();
  }

  private updateEquityCurve(agentId: string): void {
    const capital = this.initialCapital.get(agentId) || 10000;
    const agentTrades = this.trades.filter(t => t.agentId === agentId);
    const totalPnl = agentTrades.reduce((sum, t) => sum + t.pnl - t.fee, 0);
    const equity = capital + totalPnl;

    let curve = this.equityCurves.get(agentId);
    if (!curve) {
      curve = [capital];
      this.equityCurves.set(agentId, curve);
    }
    curve.push(equity);
  }

  // ---- Cancel Order ----

  cancelOrder(orderId: string): Order | null {
    const order = this.orders.get(orderId);
    if (!order) {
      logger.warn(`[TradingEngine] Cancel failed: order ${orderId} not found`);
      return null;
    }
    if (order.status === 'filled' || order.status === 'cancelled') {
      logger.warn(`[TradingEngine] Cannot cancel order ${orderId} with status ${order.status}`);
      return order;
    }

    order.status = 'cancelled';
    order.updatedAt = Date.now();
    this.removeFromOrderBook(order);

    logger.info(`[TradingEngine] Order cancelled: ${orderId}`);
    return order;
  }

  // ---- Queries ----

  getOpenOrders(agentId?: string): Order[] {
    const allOrders = Array.from(this.orders.values());
    const open = allOrders.filter(o => o.status === 'open' || o.status === 'partially_filled');
    if (agentId) return open.filter(o => o.agentId === agentId);
    return open;
  }

  getPositions(agentId?: string): Position[] {
    const all = Array.from(this.positions.values());
    if (agentId) return all.filter(p => p.agentId === agentId);
    return all;
  }

  getTradeHistory(agentId?: string, symbol?: string, limit?: number): Trade[] {
    let result = [...this.trades];
    if (agentId) result = result.filter(t => t.agentId === agentId);
    if (symbol) result = result.filter(t => t.symbol === symbol);
    result.sort((a, b) => b.timestamp - a.timestamp);
    if (limit) result = result.slice(0, limit);
    return result;
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  // ---- Performance Metrics ----

  getPerformanceMetrics(agentId: string): PerformanceMetrics {
    const agentTrades = this.trades.filter(t => t.agentId === agentId);
    const agentPositions = this.getPositions(agentId);

    const realizedPnl = agentTrades.reduce((sum, t) => sum + t.pnl, 0);
    const unrealizedPnl = agentPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const totalPnl = realizedPnl + unrealizedPnl;
    const totalFees = agentTrades.reduce((sum, t) => sum + t.fee, 0);

    // Win/loss tracking (only trades with non-zero PnL)
    const closingTrades = agentTrades.filter(t => t.pnl !== 0);
    const winningTrades = closingTrades.filter(t => t.pnl > 0);
    const losingTrades = closingTrades.filter(t => t.pnl < 0);

    const winRate = closingTrades.length > 0 ? winningTrades.length / closingTrades.length : 0;
    const averageWin = winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length
      : 0;
    const averageLoss = losingTrades.length > 0
      ? losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length
      : 0;

    const grossProfit = winningTrades.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const bestTrade = closingTrades.length > 0 ? Math.max(...closingTrades.map(t => t.pnl)) : 0;
    const worstTrade = closingTrades.length > 0 ? Math.min(...closingTrades.map(t => t.pnl)) : 0;

    // Sharpe & Sortino ratios
    const { sharpeRatio, sortinoRatio } = this.calculateRiskRatios(agentId);

    // Max drawdown
    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(agentId);

    const capital = this.initialCapital.get(agentId) || 10000;
    const returnOnCapital = totalPnl / capital;

    return {
      agentId,
      totalPnl,
      realizedPnl,
      unrealizedPnl,
      totalTrades: agentTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownPercent,
      bestTrade,
      worstTrade,
      totalFees,
      returnOnCapital,
      calculatedAt: Date.now(),
    };
  }

  private calculateRiskRatios(agentId: string): { sharpeRatio: number; sortinoRatio: number } {
    const curve = this.equityCurves.get(agentId);
    if (!curve || curve.length < 3) {
      return { sharpeRatio: 0, sortinoRatio: 0 };
    }

    // Calculate returns from equity curve
    const returns: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      returns.push((curve[i] - curve[i - 1]) / curve[i - 1]);
    }

    const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const riskFreeRate = 0.05 / 252; // ~5% annual / 252 trading days

    // Standard deviation of returns
    const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Downside deviation (only negative returns)
    const downsideReturns = returns.filter(r => r < riskFreeRate);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((s, r) => s + Math.pow(r - riskFreeRate, 2), 0) / downsideReturns.length
      : 0;
    const downsideDev = Math.sqrt(downsideVariance);

    const sharpeRatio = stdDev > 0 ? (meanReturn - riskFreeRate) / stdDev : 0;
    const sortinoRatio = downsideDev > 0 ? (meanReturn - riskFreeRate) / downsideDev : 0;

    return {
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    };
  }

  private calculateMaxDrawdown(agentId: string): { maxDrawdown: number; maxDrawdownPercent: number } {
    const curve = this.equityCurves.get(agentId);
    if (!curve || curve.length < 2) {
      return { maxDrawdown: 0, maxDrawdownPercent: 0 };
    }

    let peak = curve[0];
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const equity of curve) {
      if (equity > peak) peak = equity;
      const drawdown = peak - equity;
      const drawdownPercent = peak > 0 ? drawdown / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return {
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 10000) / 10000,
    };
  }

  // ---- Leaderboard ----

  getAgentRanking(agentIds: string[]): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = agentIds.map(agentId => {
      const metrics = this.getPerformanceMetrics(agentId);

      // Composite score: weighted combination of key metrics
      // 40% PnL-based, 20% win rate, 20% Sharpe, 20% drawdown penalty
      const pnlScore = Math.max(0, Math.min(100, 50 + metrics.totalPnl / 100));
      const winRateScore = metrics.winRate * 100;
      const sharpeScore = Math.max(0, Math.min(100, 50 + metrics.sharpeRatio * 20));
      const drawdownPenalty = Math.max(0, 100 - metrics.maxDrawdownPercent * 200);

      const score = Math.round(
        pnlScore * 0.4 +
        winRateScore * 0.2 +
        sharpeScore * 0.2 +
        drawdownPenalty * 0.2
      );

      return {
        rank: 0,
        agentId,
        totalPnl: metrics.totalPnl,
        winRate: metrics.winRate,
        totalTrades: metrics.totalTrades,
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.maxDrawdown,
        score,
      };
    });

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, idx) => { entry.rank = idx + 1; });

    logger.info(`[TradingEngine] Leaderboard computed for ${entries.length} agents`);
    return entries;
  }

  // ---- SURGE Integration Points ----

  /**
   * Execute a token transfer via the SURGE API (transferManager pattern).
   * This is an integration stub that would call the SURGE API to move tokens.
   */
  async surgeTransfer(params: {
    walletId: string;
    toAddress: string;
    tokenAddress: string;
    amount: string;
    chainId?: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const url = `${config.surge.apiUrl}/openclaw/transfer`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.surge.apiKey,
        },
        body: JSON.stringify({
          walletId: params.walletId || config.surge.walletId,
          toAddress: params.toAddress,
          tokenAddress: params.tokenAddress,
          amount: params.amount,
          chainId: params.chainId || config.surge.chainId,
        }),
      });

      const data = await response.json() as Record<string, unknown>;
      if (response.ok) {
        logger.info(`[TradingEngine] SURGE transfer successful: ${data.txHash || 'pending'}`);
        return { success: true, txHash: data.txHash as string };
      }
      logger.error(`[TradingEngine] SURGE transfer failed: ${JSON.stringify(data)}`);
      return { success: false, error: JSON.stringify(data) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[TradingEngine] SURGE transfer error: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Launch a token via the SURGE API (tokenLauncher pattern).
   */
  async surgeLaunchToken(params: {
    walletId: string;
    name: string;
    symbol: string;
    initialSupply: string;
  }): Promise<{ success: boolean; tokenAddress?: string; error?: string }> {
    const url = `${config.surge.apiUrl}/openclaw/token/launch`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.surge.apiKey,
        },
        body: JSON.stringify({
          walletId: params.walletId || config.surge.walletId,
          name: params.name,
          symbol: params.symbol,
          initialSupply: params.initialSupply,
          chainId: config.surge.chainId,
        }),
      });

      const data = await response.json() as Record<string, unknown>;
      if (response.ok) {
        logger.info(`[TradingEngine] Token launched: ${params.symbol} at ${data.tokenAddress}`);
        return { success: true, tokenAddress: data.tokenAddress as string };
      }
      logger.error(`[TradingEngine] Token launch failed: ${JSON.stringify(data)}`);
      return { success: false, error: JSON.stringify(data) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[TradingEngine] Token launch error: ${message}`);
      return { success: false, error: message };
    }
  }

  // ---- Utility ----

  getSummary(): {
    totalOrders: number;
    openOrders: number;
    totalTrades: number;
    activePositions: number;
    tradedSymbols: string[];
  } {
    return {
      totalOrders: this.orders.size,
      openOrders: this.getOpenOrders().length,
      totalTrades: this.trades.length,
      activePositions: this.positions.size,
      tradedSymbols: Array.from(this.orderBooks.keys()),
    };
  }
}

export const tradingEngine = new TradingEngine();
export default tradingEngine;
