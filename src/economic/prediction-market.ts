// ============================================================
// src/economic/prediction-market.ts — Prediction Market Engine
// ============================================================
// Binary prediction markets with AMM (constant product formula),
// oracle-based resolution, liquidity provision, and fee collection.
// Enables agents to create, trade, and settle prediction markets.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import { logger } from '../utils/logger';

// ---- Types ----

export type MarketType = 'price_prediction' | 'event_outcome' | 'governance_decision' | 'risk_assessment';
export type ShareType = 'YES' | 'NO';
export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled';

export interface PredictionMarket {
  id: string;
  title: string;
  description: string;
  type: MarketType;
  creatorId: string;
  status: MarketStatus;
  /** AMM pool: YES shares in the pool */
  poolYes: number;
  /** AMM pool: NO shares in the pool */
  poolNo: number;
  /** Constant product invariant k = poolYes * poolNo */
  k: number;
  /** Total liquidity deposited (in USDC equivalent) */
  totalLiquidity: number;
  /** Collected trading fees */
  feesCollected: number;
  /** Resolution outcome: true = YES wins, false = NO wins */
  resolvedOutcome?: boolean;
  /** Oracle data used for resolution */
  oracleData?: OracleData;
  /** Resolution method */
  resolutionMethod: 'manual' | 'oracle' | 'time_based';
  /** Resolution timestamp (for time_based) */
  resolutionDeadline: number;
  /** Minimum trade size */
  minTradeSize: number;
  createdAt: number;
  resolvedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface MarketPosition {
  marketId: string;
  participantId: string;
  yesShares: number;
  noShares: number;
  totalInvested: number;
  totalReturned: number;
  pnl: number;
  trades: MarketTrade[];
}

export interface MarketTrade {
  id: string;
  marketId: string;
  participantId: string;
  side: ShareType;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  cost: number;
  fee: number;
  timestamp: number;
}

export interface MarketResolution {
  marketId: string;
  outcome: boolean;
  resolvedBy: string;
  oracleData?: OracleData;
  totalPayouts: number;
  winnerCount: number;
  loserCount: number;
  timestamp: number;
}

export interface OracleData {
  source: string;
  value: number | string | boolean;
  confidence: number;
  fetchedAt: number;
  metadata?: Record<string, unknown>;
}

interface LiquidityProvider {
  providerId: string;
  marketId: string;
  liquidity: number;
  shareOfPool: number;
  depositedAt: number;
}

// ---- Constants ----

const TRADE_FEE_RATE = 0.02; // 2% fee on trades
const INITIAL_POOL_SIZE = 1000; // Initial shares each side
const MIN_TRADE_SIZE = 0.01;
const MAX_PRICE = 0.99;
const MIN_PRICE = 0.01;

// ---- Prediction Market Engine ----

export class PredictionMarketEngine {
  private markets: Map<string, PredictionMarket> = new Map();
  private positions: Map<string, MarketPosition> = new Map(); // key: `${marketId}:${participantId}`
  private tradeHistory: MarketTrade[] = [];
  private resolutions: MarketResolution[] = [];
  private liquidityProviders: Map<string, LiquidityProvider[]> = new Map(); // key: marketId
  private totalFeesCollected: number = 0;

  constructor() {
    logger.info('[PredictionMarket] Engine initialized');
  }

  // ---- Market Creation ----

  createMarket(params: {
    title: string;
    description: string;
    type: MarketType;
    creatorId: string;
    resolutionMethod?: 'manual' | 'oracle' | 'time_based';
    resolutionDeadline?: number;
    initialLiquidity?: number;
    metadata?: Record<string, unknown>;
  }): PredictionMarket {
    const initialLiquidity = params.initialLiquidity || INITIAL_POOL_SIZE;
    const poolSize = initialLiquidity / 2; // Split evenly between YES and NO

    const market: PredictionMarket = {
      id: uuidv4(),
      title: params.title,
      description: params.description,
      type: params.type,
      creatorId: params.creatorId,
      status: 'open',
      poolYes: poolSize,
      poolNo: poolSize,
      k: poolSize * poolSize,
      totalLiquidity: initialLiquidity,
      feesCollected: 0,
      resolutionMethod: params.resolutionMethod || 'manual',
      resolutionDeadline: params.resolutionDeadline || Date.now() + 7 * 24 * 60 * 60 * 1000, // default: 7 days
      minTradeSize: MIN_TRADE_SIZE,
      createdAt: Date.now(),
      metadata: params.metadata,
    };

    this.markets.set(market.id, market);

    // Register creator as initial liquidity provider
    this.liquidityProviders.set(market.id, [{
      providerId: params.creatorId,
      marketId: market.id,
      liquidity: initialLiquidity,
      shareOfPool: 1.0,
      depositedAt: Date.now(),
    }]);

    logger.info(`[PredictionMarket] Market created: "${params.title}" (${market.id}) by ${params.creatorId}`);
    return market;
  }

  // ---- AMM Price Calculation ----

  /**
   * Get current prices for YES and NO shares.
   * Price of YES = poolNo / (poolYes + poolNo)
   * Price of NO  = poolYes / (poolYes + poolNo)
   */
  getMarketPrices(marketId: string): { yes: number; no: number } | null {
    const market = this.markets.get(marketId);
    if (!market) {
      logger.warn(`[PredictionMarket] Market ${marketId} not found`);
      return null;
    }

    const total = market.poolYes + market.poolNo;
    if (total === 0) return { yes: 0.5, no: 0.5 };

    const yesPrice = market.poolNo / total;
    const noPrice = market.poolYes / total;

    return {
      yes: Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(yesPrice * 10000) / 10000)),
      no: Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(noPrice * 10000) / 10000)),
    };
  }

  /**
   * Calculate cost for buying a given number of shares using constant product AMM.
   * For buying YES shares: cost = poolNo - k / (poolYes + shares)
   * But we invert since buying YES removes YES from pool:
   *   New poolYes = poolYes - shares  ->  Not correct for AMM
   *
   * Correct AMM: trader sends USDC to buy shares.
   * cost = amount of USDC to move the price.
   * Using x * y = k where x = one token pool, y = other token pool:
   *   To buy `n` YES shares:
   *     newPoolYes = poolYes - n
   *     newPoolNo = k / newPoolYes
   *     cost = newPoolNo - poolNo (trader pays this difference)
   */
  private calculateBuyCost(market: PredictionMarket, side: ShareType, shares: number): { cost: number; newPoolYes: number; newPoolNo: number } {
    if (side === 'YES') {
      const newPoolYes = market.poolYes - shares;
      if (newPoolYes <= 0) {
        throw new Error(`Insufficient YES liquidity: requested ${shares}, available ${market.poolYes - 1}`);
      }
      const newPoolNo = market.k / newPoolYes;
      const cost = newPoolNo - market.poolNo;
      return { cost, newPoolYes, newPoolNo };
    } else {
      const newPoolNo = market.poolNo - shares;
      if (newPoolNo <= 0) {
        throw new Error(`Insufficient NO liquidity: requested ${shares}, available ${market.poolNo - 1}`);
      }
      const newPoolYes = market.k / newPoolNo;
      const cost = newPoolYes - market.poolYes;
      return { cost, newPoolYes, newPoolNo };
    }
  }

  /**
   * Calculate proceeds from selling shares back to the AMM.
   * Selling YES: add YES back to pool, receive difference from NO pool.
   */
  private calculateSellProceeds(market: PredictionMarket, side: ShareType, shares: number): { proceeds: number; newPoolYes: number; newPoolNo: number } {
    if (side === 'YES') {
      const newPoolYes = market.poolYes + shares;
      const newPoolNo = market.k / newPoolYes;
      const proceeds = market.poolNo - newPoolNo;
      return { proceeds, newPoolYes, newPoolNo };
    } else {
      const newPoolNo = market.poolNo + shares;
      const newPoolYes = market.k / newPoolNo;
      const proceeds = market.poolYes - newPoolYes;
      return { proceeds, newPoolYes, newPoolNo };
    }
  }

  // ---- Buy Shares ----

  buyShares(params: {
    marketId: string;
    participantId: string;
    side: ShareType;
    shares: number;
  }): MarketTrade | null {
    const market = this.markets.get(params.marketId);
    if (!market) {
      logger.warn(`[PredictionMarket] Buy failed: market ${params.marketId} not found`);
      return null;
    }
    if (market.status !== 'open') {
      logger.warn(`[PredictionMarket] Buy failed: market ${params.marketId} is ${market.status}`);
      return null;
    }
    if (params.shares < market.minTradeSize) {
      logger.warn(`[PredictionMarket] Buy failed: shares ${params.shares} below minimum ${market.minTradeSize}`);
      return null;
    }

    try {
      const { cost, newPoolYes, newPoolNo } = this.calculateBuyCost(market, params.side, params.shares);
      const fee = cost * TRADE_FEE_RATE;
      const totalCost = cost + fee;
      const pricePerShare = totalCost / params.shares;

      // Update pool
      market.poolYes = newPoolYes;
      market.poolNo = newPoolNo;
      market.feesCollected += fee;
      this.totalFeesCollected += fee;

      // Record trade
      const trade: MarketTrade = {
        id: uuidv4(),
        marketId: params.marketId,
        participantId: params.participantId,
        side: params.side,
        action: 'buy',
        shares: params.shares,
        price: pricePerShare,
        cost: totalCost,
        fee,
        timestamp: Date.now(),
      };

      this.tradeHistory.push(trade);

      // Update position
      const posKey = `${params.marketId}:${params.participantId}`;
      let position = this.positions.get(posKey);
      if (!position) {
        position = {
          marketId: params.marketId,
          participantId: params.participantId,
          yesShares: 0,
          noShares: 0,
          totalInvested: 0,
          totalReturned: 0,
          pnl: 0,
          trades: [],
        };
        this.positions.set(posKey, position);
      }

      if (params.side === 'YES') {
        position.yesShares += params.shares;
      } else {
        position.noShares += params.shares;
      }
      position.totalInvested += totalCost;
      position.pnl = position.totalReturned - position.totalInvested;
      position.trades.push(trade);

      const prices = this.getMarketPrices(params.marketId);
      logger.info(
        `[PredictionMarket] ${params.participantId} bought ${params.shares} ${params.side} shares in "${market.title}" ` +
        `@ $${pricePerShare.toFixed(4)} (cost: $${totalCost.toFixed(4)}, fee: $${fee.toFixed(4)}) ` +
        `[YES: ${prices?.yes.toFixed(4)}, NO: ${prices?.no.toFixed(4)}]`
      );

      return trade;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[PredictionMarket] Buy error: ${message}`);
      return null;
    }
  }

  // ---- Sell Shares ----

  sellShares(params: {
    marketId: string;
    participantId: string;
    side: ShareType;
    shares: number;
  }): MarketTrade | null {
    const market = this.markets.get(params.marketId);
    if (!market) {
      logger.warn(`[PredictionMarket] Sell failed: market ${params.marketId} not found`);
      return null;
    }
    if (market.status !== 'open') {
      logger.warn(`[PredictionMarket] Sell failed: market ${params.marketId} is ${market.status}`);
      return null;
    }

    // Check position
    const posKey = `${params.marketId}:${params.participantId}`;
    const position = this.positions.get(posKey);
    if (!position) {
      logger.warn(`[PredictionMarket] Sell failed: no position for ${params.participantId} in ${params.marketId}`);
      return null;
    }

    const availableShares = params.side === 'YES' ? position.yesShares : position.noShares;
    if (availableShares < params.shares) {
      logger.warn(`[PredictionMarket] Sell failed: insufficient ${params.side} shares (have ${availableShares}, want ${params.shares})`);
      return null;
    }

    try {
      const { proceeds, newPoolYes, newPoolNo } = this.calculateSellProceeds(market, params.side, params.shares);
      const fee = proceeds * TRADE_FEE_RATE;
      const netProceeds = proceeds - fee;
      const pricePerShare = netProceeds / params.shares;

      // Update pool
      market.poolYes = newPoolYes;
      market.poolNo = newPoolNo;
      market.feesCollected += fee;
      this.totalFeesCollected += fee;

      // Record trade
      const trade: MarketTrade = {
        id: uuidv4(),
        marketId: params.marketId,
        participantId: params.participantId,
        side: params.side,
        action: 'sell',
        shares: params.shares,
        price: pricePerShare,
        cost: netProceeds,
        fee,
        timestamp: Date.now(),
      };

      this.tradeHistory.push(trade);

      // Update position
      if (params.side === 'YES') {
        position.yesShares -= params.shares;
      } else {
        position.noShares -= params.shares;
      }
      position.totalReturned += netProceeds;
      position.pnl = position.totalReturned - position.totalInvested;
      position.trades.push(trade);

      const prices = this.getMarketPrices(params.marketId);
      logger.info(
        `[PredictionMarket] ${params.participantId} sold ${params.shares} ${params.side} shares in "${market.title}" ` +
        `@ $${pricePerShare.toFixed(4)} (proceeds: $${netProceeds.toFixed(4)}, fee: $${fee.toFixed(4)}) ` +
        `[YES: ${prices?.yes.toFixed(4)}, NO: ${prices?.no.toFixed(4)}]`
      );

      return trade;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[PredictionMarket] Sell error: ${message}`);
      return null;
    }
  }

  // ---- Add Liquidity ----

  addLiquidity(params: {
    marketId: string;
    providerId: string;
    amount: number;
  }): { success: boolean; shareOfPool: number } {
    const market = this.markets.get(params.marketId);
    if (!market) {
      logger.warn(`[PredictionMarket] Add liquidity failed: market ${params.marketId} not found`);
      return { success: false, shareOfPool: 0 };
    }
    if (market.status !== 'open') {
      logger.warn(`[PredictionMarket] Add liquidity failed: market ${params.marketId} is ${market.status}`);
      return { success: false, shareOfPool: 0 };
    }

    // Add proportional liquidity to both sides to maintain price
    const prices = this.getMarketPrices(params.marketId)!;
    const yesAdd = (params.amount / 2) / prices.yes;
    const noAdd = (params.amount / 2) / prices.no;

    // Scale to maintain ratio
    const ratio = market.poolYes / market.poolNo;
    const addYes = params.amount / 2;
    const addNo = params.amount / 2;

    market.poolYes += addYes;
    market.poolNo += addNo;
    market.k = market.poolYes * market.poolNo;
    market.totalLiquidity += params.amount;

    // Update LP records
    const providers = this.liquidityProviders.get(params.marketId) || [];
    const existingProvider = providers.find(p => p.providerId === params.providerId);
    if (existingProvider) {
      existingProvider.liquidity += params.amount;
    } else {
      providers.push({
        providerId: params.providerId,
        marketId: params.marketId,
        liquidity: params.amount,
        shareOfPool: 0,
        depositedAt: Date.now(),
      });
    }

    // Recalculate pool shares
    const totalPoolLiquidity = providers.reduce((s, p) => s + p.liquidity, 0);
    for (const p of providers) {
      p.shareOfPool = p.liquidity / totalPoolLiquidity;
    }
    this.liquidityProviders.set(params.marketId, providers);

    const shareOfPool = existingProvider
      ? existingProvider.shareOfPool
      : providers[providers.length - 1].shareOfPool;

    logger.info(`[PredictionMarket] Liquidity added: $${params.amount} by ${params.providerId} to "${market.title}" (share: ${(shareOfPool * 100).toFixed(2)}%)`);
    return { success: true, shareOfPool };
  }

  // ---- Remove Liquidity ----

  removeLiquidity(params: {
    marketId: string;
    providerId: string;
    amount: number;
  }): { success: boolean; returned: number } {
    const market = this.markets.get(params.marketId);
    if (!market) {
      logger.warn(`[PredictionMarket] Remove liquidity failed: market ${params.marketId} not found`);
      return { success: false, returned: 0 };
    }

    const providers = this.liquidityProviders.get(params.marketId) || [];
    const provider = providers.find(p => p.providerId === params.providerId);
    if (!provider) {
      logger.warn(`[PredictionMarket] Remove liquidity failed: ${params.providerId} is not an LP for ${params.marketId}`);
      return { success: false, returned: 0 };
    }

    const removeAmount = Math.min(params.amount, provider.liquidity);
    const proportion = removeAmount / market.totalLiquidity;

    // Remove proportional amounts from both pools
    const yesRemove = market.poolYes * proportion;
    const noRemove = market.poolNo * proportion;

    market.poolYes -= yesRemove;
    market.poolNo -= noRemove;
    market.k = market.poolYes * market.poolNo;
    market.totalLiquidity -= removeAmount;

    // Include proportional share of fees
    const feeShare = market.feesCollected * proportion;
    const totalReturned = removeAmount + feeShare;

    provider.liquidity -= removeAmount;
    if (provider.liquidity <= 0) {
      const idx = providers.indexOf(provider);
      providers.splice(idx, 1);
    }

    // Recalculate pool shares
    const totalPoolLiquidity = providers.reduce((s, p) => s + p.liquidity, 0);
    for (const p of providers) {
      p.shareOfPool = totalPoolLiquidity > 0 ? p.liquidity / totalPoolLiquidity : 0;
    }

    logger.info(`[PredictionMarket] Liquidity removed: $${removeAmount.toFixed(2)} by ${params.providerId} from "${market.title}" (returned: $${totalReturned.toFixed(2)})`);
    return { success: true, returned: totalReturned };
  }

  // ---- Resolve Market ----

  resolveMarket(params: {
    marketId: string;
    outcome: boolean;
    resolvedBy: string;
    oracleData?: OracleData;
  }): MarketResolution | null {
    const market = this.markets.get(params.marketId);
    if (!market) {
      logger.warn(`[PredictionMarket] Resolve failed: market ${params.marketId} not found`);
      return null;
    }
    if (market.status === 'resolved') {
      logger.warn(`[PredictionMarket] Market ${params.marketId} already resolved`);
      return null;
    }

    market.status = 'resolved';
    market.resolvedOutcome = params.outcome;
    market.oracleData = params.oracleData;
    market.resolvedAt = Date.now();

    // Calculate payouts for all participants
    let totalPayouts = 0;
    let winnerCount = 0;
    let loserCount = 0;

    const marketPositions = Array.from(this.positions.entries())
      .filter(([key]) => key.startsWith(params.marketId + ':'));

    for (const [key, position] of marketPositions) {
      const winningShares = params.outcome ? position.yesShares : position.noShares;
      const losingShares = params.outcome ? position.noShares : position.yesShares;

      // Winning shares pay out $1 per share
      const payout = winningShares;
      position.totalReturned += payout;
      position.pnl = position.totalReturned - position.totalInvested;
      totalPayouts += payout;

      if (winningShares > 0) winnerCount++;
      if (losingShares > 0 && winningShares === 0) loserCount++;
    }

    const resolution: MarketResolution = {
      marketId: params.marketId,
      outcome: params.outcome,
      resolvedBy: params.resolvedBy,
      oracleData: params.oracleData,
      totalPayouts,
      winnerCount,
      loserCount,
      timestamp: Date.now(),
    };

    this.resolutions.push(resolution);

    logger.info(
      `[PredictionMarket] Market resolved: "${market.title}" → ${params.outcome ? 'YES' : 'NO'} ` +
      `(payouts: $${totalPayouts.toFixed(2)}, winners: ${winnerCount}, losers: ${loserCount})`
    );

    return resolution;
  }

  // ---- Market Info ----

  getMarketInfo(marketId: string): (PredictionMarket & { prices: { yes: number; no: number } | null }) | null {
    const market = this.markets.get(marketId);
    if (!market) return null;
    const prices = this.getMarketPrices(marketId);
    return { ...market, prices };
  }

  getAllMarkets(status?: MarketStatus): PredictionMarket[] {
    const all = Array.from(this.markets.values());
    if (status) return all.filter(m => m.status === status);
    return all;
  }

  // ---- User Positions ----

  getUserPositions(participantId: string): MarketPosition[] {
    return Array.from(this.positions.values())
      .filter(p => p.participantId === participantId);
  }

  getUserPositionInMarket(marketId: string, participantId: string): MarketPosition | null {
    const posKey = `${marketId}:${participantId}`;
    return this.positions.get(posKey) || null;
  }

  // ---- Market History ----

  getMarketHistory(marketId?: string, limit?: number): MarketTrade[] {
    let result = [...this.tradeHistory];
    if (marketId) result = result.filter(t => t.marketId === marketId);
    result.sort((a, b) => b.timestamp - a.timestamp);
    if (limit) result = result.slice(0, limit);
    return result;
  }

  getResolutions(): MarketResolution[] {
    return [...this.resolutions];
  }

  // ---- Risk Hedging ----

  /**
   * Calculate the cost to hedge a given exposure using a prediction market.
   * E.g., if you hold a long position and want to hedge downside risk,
   * you can buy NO shares in a related price prediction market.
   */
  calculateHedgeCost(params: {
    marketId: string;
    hedgeSide: ShareType;
    notionalAmount: number;
  }): { shares: number; cost: number; effectiveRate: number } | null {
    const market = this.markets.get(params.marketId);
    if (!market || market.status !== 'open') return null;

    const prices = this.getMarketPrices(params.marketId);
    if (!prices) return null;

    const price = params.hedgeSide === 'YES' ? prices.yes : prices.no;
    // How many shares needed to cover the notional amount (each share pays $1 if correct)
    const shares = params.notionalAmount;

    try {
      const { cost } = this.calculateBuyCost(market, params.hedgeSide, shares);
      const fee = cost * TRADE_FEE_RATE;
      const totalCost = cost + fee;
      const effectiveRate = totalCost / params.notionalAmount;

      return { shares, cost: totalCost, effectiveRate };
    } catch {
      // If not enough liquidity, calculate with smaller amount
      const maxShares = (params.hedgeSide === 'YES' ? market.poolYes : market.poolNo) * 0.9;
      if (maxShares <= 0) return null;

      try {
        const { cost } = this.calculateBuyCost(market, params.hedgeSide, maxShares);
        const fee = cost * TRADE_FEE_RATE;
        const totalCost = cost + fee;
        const effectiveRate = totalCost / maxShares;

        return { shares: maxShares, cost: totalCost, effectiveRate };
      } catch {
        return null;
      }
    }
  }

  // ---- Check Expired Markets ----

  checkExpiredMarkets(): PredictionMarket[] {
    const now = Date.now();
    const expired: PredictionMarket[] = [];

    for (const market of this.markets.values()) {
      if (market.status === 'open' && market.resolutionDeadline <= now) {
        market.status = 'closed';
        expired.push(market);
        logger.info(`[PredictionMarket] Market expired: "${market.title}" (${market.id})`);
      }
    }

    return expired;
  }

  // ---- Summary ----

  getSummary(): {
    totalMarkets: number;
    openMarkets: number;
    resolvedMarkets: number;
    totalTradeVolume: number;
    totalFeesCollected: number;
    activeParticipants: number;
  } {
    const markets = Array.from(this.markets.values());
    const totalVolume = this.tradeHistory.reduce((s, t) => s + t.cost, 0);
    const participantIds = new Set(this.tradeHistory.map(t => t.participantId));

    return {
      totalMarkets: markets.length,
      openMarkets: markets.filter(m => m.status === 'open').length,
      resolvedMarkets: markets.filter(m => m.status === 'resolved').length,
      totalTradeVolume: Math.round(totalVolume * 100) / 100,
      totalFeesCollected: Math.round(this.totalFeesCollected * 100) / 100,
      activeParticipants: participantIds.size,
    };
  }
}

export const predictionMarketEngine = new PredictionMarketEngine();
export default predictionMarketEngine;
