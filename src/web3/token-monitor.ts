// ============================================================
// src/web3/token-monitor.ts — Token Monitoring & Portfolio
// ============================================================
// Monitors token balances across multiple chains, tracks price
// changes via CoinGecko, calculates portfolio value, discovers
// new tokens, and fires configurable price alerts.
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';
import { multiChainManager, ChainBalance } from './multi-chain-manager';
import { contractInteraction, TokenInfo } from './contract-interaction';

const fetch = require('node-fetch');

// ---- Interfaces ----

/** A tracked token entry. */
export interface TrackedToken {
  /** Chain key */
  chain: string;
  /** Token contract address */
  address: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** CoinGecko ID for price lookups (if known) */
  coingeckoId?: string;
  /** When the token was added to tracking */
  addedAt: number;
}

/** Token balance snapshot. */
export interface TokenBalanceSnapshot {
  /** Chain key */
  chain: string;
  /** Token contract address */
  tokenAddress: string;
  /** Token symbol */
  symbol: string;
  /** Raw balance (no decimal adjustment) */
  balanceRaw: string;
  /** Formatted balance (decimal-adjusted) */
  balanceFormatted: string;
  /** Timestamp of the snapshot */
  timestamp: number;
}

/** Price data from CoinGecko. */
export interface TokenPrice {
  /** CoinGecko token ID */
  tokenId: string;
  /** Token symbol */
  symbol: string;
  /** Current price in USD */
  priceUsd: number;
  /** 24h price change percentage */
  change24h: number;
  /** Market cap in USD */
  marketCap: number;
  /** 24h trading volume in USD */
  volume24h: number;
  /** When the price was last fetched */
  lastUpdated: number;
}

/** Portfolio entry for a single token position. */
export interface PortfolioEntry {
  /** Chain key */
  chain: string;
  /** Token address (or 'native' for native currency) */
  tokenAddress: string;
  /** Token symbol */
  symbol: string;
  /** Human-readable balance */
  balance: string;
  /** Price in USD (0 if unknown) */
  priceUsd: number;
  /** Total value in USD */
  valueUsd: number;
}

/** Full portfolio summary. */
export interface Portfolio {
  /** Wallet address */
  address: string;
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** Individual token positions */
  entries: PortfolioEntry[];
  /** When the portfolio was last calculated */
  timestamp: number;
}

/** Price alert configuration. */
export interface PriceAlert {
  /** Unique alert ID */
  id: string;
  /** CoinGecko token ID */
  tokenId: string;
  /** Token symbol for display */
  symbol: string;
  /** Alert direction: trigger when price goes above or below threshold */
  direction: 'above' | 'below';
  /** Price threshold in USD */
  thresholdUsd: number;
  /** Whether the alert has already fired */
  triggered: boolean;
  /** Timestamp when the alert was created */
  createdAt: number;
  /** Timestamp when the alert last triggered */
  triggeredAt?: number;
}

/** Historical portfolio value point. */
interface PortfolioHistoryPoint {
  /** Total value in USD */
  totalValueUsd: number;
  /** Number of positions */
  positionCount: number;
  /** Timestamp */
  timestamp: number;
}

// ---- Constants ----

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/** Map of common native currencies to CoinGecko IDs. */
const NATIVE_COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  MATIC: 'matic-network',
  BNB: 'binancecoin',
  SOL: 'solana',
};

/** Rate-limit: min ms between CoinGecko API calls. */
const COINGECKO_RATE_LIMIT_MS = 1500;

// ---- TokenMonitor ----

/**
 * Token monitoring and portfolio tracking across multiple chains.
 * Tracks balances, prices, portfolio value, and price alerts.
 */
export class TokenMonitor {
  /** Tracked tokens by key "chain:address" */
  private tokens: Map<string, TrackedToken> = new Map();

  /** Cached prices by CoinGecko ID */
  private priceCache: Map<string, TokenPrice> = new Map();

  /** Price alert configurations */
  private alerts: Map<string, PriceAlert> = new Map();

  /** Portfolio history (most recent snapshots) */
  private portfolioHistory: PortfolioHistoryPoint[] = [];

  /** Balance history per token, keyed by "chain:address" */
  private balanceHistory: Map<string, TokenBalanceSnapshot[]> = new Map();

  /** Timestamp of last CoinGecko API call (for rate limiting) */
  private lastCoinGeckoCall: number = 0;

  /** Maximum number of portfolio history points to retain */
  private readonly maxHistoryPoints: number = 500;

  /** Alert counter for generating IDs */
  private alertIdCounter: number = 0;

  constructor() {
    logger.info('[TokenMonitor] Initialized');
  }

  // ---- Token Management ----

  /**
   * Add a token to the monitoring list.
   * Fetches token info (name, symbol, decimals) from the chain.
   * @param chain - Chain key (e.g., 'base', 'ethereum')
   * @param address - ERC-20 token contract address
   * @param coingeckoId - Optional CoinGecko ID for price tracking
   * @returns The tracked token entry
   */
  async addToken(chain: string, address: string, coingeckoId?: string): Promise<TrackedToken> {
    const key = `${chain}:${address.toLowerCase()}`;

    if (this.tokens.has(key)) {
      logger.info(`[TokenMonitor] Token already tracked: ${key}`);
      return this.tokens.get(key)!;
    }

    logger.info(`[TokenMonitor] Adding token: ${chain}:${address}`);

    let tokenInfo: TokenInfo;
    try {
      tokenInfo = await contractInteraction.getTokenInfo(chain, address);
    } catch (err: any) {
      logger.warn(`[TokenMonitor] Could not fetch token info for ${key}: ${err.message}`);
      tokenInfo = {
        address,
        chain,
        name: 'Unknown Token',
        symbol: '???',
        decimals: 18,
        totalSupply: '0',
      };
    }

    const tracked: TrackedToken = {
      chain,
      address: address.toLowerCase(),
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      decimals: tokenInfo.decimals,
      coingeckoId,
      addedAt: Date.now(),
    };

    this.tokens.set(key, tracked);
    this.balanceHistory.set(key, []);

    logger.info(`[TokenMonitor] Now tracking ${tracked.symbol} (${tracked.name}) on ${chain}`);
    return tracked;
  }

  /**
   * Remove a token from the monitoring list.
   * @param chain - Chain key
   * @param address - Token contract address
   * @returns true if the token was removed
   */
  removeToken(chain: string, address: string): boolean {
    const key = `${chain}:${address.toLowerCase()}`;
    const removed = this.tokens.delete(key);
    if (removed) {
      this.balanceHistory.delete(key);
      logger.info(`[TokenMonitor] Removed token: ${key}`);
    }
    return removed;
  }

  /**
   * Get all currently tracked tokens.
   */
  getTrackedTokens(): TrackedToken[] {
    return Array.from(this.tokens.values());
  }

  // ---- Price Fetching ----

  /**
   * Enforce CoinGecko rate limiting by sleeping if needed.
   */
  private async rateLimitCoinGecko(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCoinGeckoCall;
    if (elapsed < COINGECKO_RATE_LIMIT_MS) {
      const waitMs = COINGECKO_RATE_LIMIT_MS - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastCoinGeckoCall = Date.now();
  }

  /**
   * Fetch the current price of a token from CoinGecko.
   * @param tokenId - CoinGecko token ID (e.g., 'ethereum', 'usd-coin')
   * @returns TokenPrice with current market data
   */
  async getTokenPrice(tokenId: string): Promise<TokenPrice> {
    // Check cache (valid for 60 seconds)
    const cached = this.priceCache.get(tokenId);
    if (cached && Date.now() - cached.lastUpdated < 60_000) {
      return cached;
    }

    await this.rateLimitCoinGecko();

    try {
      const url = `${COINGECKO_BASE}/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const price: TokenPrice = {
        tokenId,
        symbol: data.symbol?.toUpperCase() || tokenId,
        priceUsd: data.market_data?.current_price?.usd || 0,
        change24h: data.market_data?.price_change_percentage_24h || 0,
        marketCap: data.market_data?.market_cap?.usd || 0,
        volume24h: data.market_data?.total_volume?.usd || 0,
        lastUpdated: Date.now(),
      };

      this.priceCache.set(tokenId, price);
      logger.debug(`[TokenMonitor] Price for ${tokenId}: $${price.priceUsd}`);

      // Check alerts after price update
      this.checkAlerts(price);

      return price;
    } catch (err: any) {
      logger.error(`[TokenMonitor] Failed to fetch price for ${tokenId}`, {
        error: err.message,
      });

      // Return cached data if available (even if stale)
      if (cached) {
        logger.warn(`[TokenMonitor] Using stale cache for ${tokenId}`);
        return cached;
      }

      return {
        tokenId,
        symbol: tokenId.toUpperCase(),
        priceUsd: 0,
        change24h: 0,
        marketCap: 0,
        volume24h: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Fetch prices for multiple tokens in a single CoinGecko request.
   * @param tokenIds - Array of CoinGecko token IDs
   * @returns Map of tokenId → TokenPrice
   */
  async getMultipleTokenPrices(tokenIds: string[]): Promise<Map<string, TokenPrice>> {
    if (tokenIds.length === 0) {
      return new Map();
    }

    await this.rateLimitCoinGecko();

    const results = new Map<string, TokenPrice>();

    try {
      const idsParam = tokenIds.join(',');
      const url = `${COINGECKO_BASE}/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      for (const tokenId of tokenIds) {
        const entry = data[tokenId];
        if (entry) {
          const price: TokenPrice = {
            tokenId,
            symbol: tokenId.toUpperCase(),
            priceUsd: entry.usd || 0,
            change24h: entry.usd_24h_change || 0,
            marketCap: entry.usd_market_cap || 0,
            volume24h: entry.usd_24h_vol || 0,
            lastUpdated: Date.now(),
          };
          this.priceCache.set(tokenId, price);
          results.set(tokenId, price);

          // Check alerts
          this.checkAlerts(price);
        }
      }

      logger.debug(`[TokenMonitor] Fetched prices for ${results.size}/${tokenIds.length} tokens`);
    } catch (err: any) {
      logger.error('[TokenMonitor] Failed to fetch multiple token prices', {
        error: err.message,
      });

      // Fall back to cached values
      for (const tokenId of tokenIds) {
        const cached = this.priceCache.get(tokenId);
        if (cached) {
          results.set(tokenId, cached);
        }
      }
    }

    return results;
  }

  // ---- Portfolio ----

  /**
   * Build a full portfolio for a wallet address across all tracked chains and tokens.
   * Includes native currency balances and all tracked ERC-20 tokens.
   * @param address - Wallet address
   * @returns Portfolio with all positions and total value
   */
  async getPortfolio(address: string): Promise<Portfolio> {
    logger.info(`[TokenMonitor] Building portfolio for ${address}`);

    const entries: PortfolioEntry[] = [];

    // 1. Fetch native balances across all EVM chains
    const nativeBalances = await multiChainManager.getAllBalances(address);

    // 2. Collect CoinGecko IDs to batch-fetch prices
    const coingeckoIds = new Set<string>();
    for (const balance of nativeBalances) {
      const nativeId = NATIVE_COINGECKO_IDS[balance.symbol];
      if (nativeId) coingeckoIds.add(nativeId);
    }
    for (const token of this.tokens.values()) {
      if (token.coingeckoId) coingeckoIds.add(token.coingeckoId);
    }

    // 3. Fetch all prices in one batch
    const prices = await this.getMultipleTokenPrices(Array.from(coingeckoIds));

    // 4. Build native currency entries
    for (const balance of nativeBalances) {
      if (!balance.success) continue;

      const balanceNum = parseFloat(balance.balanceFormatted);
      const nativeId = NATIVE_COINGECKO_IDS[balance.symbol];
      const price = nativeId ? prices.get(nativeId) : undefined;
      const priceUsd = price?.priceUsd || 0;

      entries.push({
        chain: balance.chain,
        tokenAddress: 'native',
        symbol: balance.symbol,
        balance: balance.balanceFormatted,
        priceUsd,
        valueUsd: balanceNum * priceUsd,
      });
    }

    // 5. Build ERC-20 token entries
    const tokenFetches = Array.from(this.tokens.values()).map(async (token) => {
      try {
        const balanceResult = await contractInteraction.getTokenBalanceOf(
          token.chain,
          token.address,
          address
        );

        const balanceBigInt = BigInt(balanceResult);
        const divisor = BigInt(10 ** token.decimals);
        const whole = balanceBigInt / divisor;
        const remainder = balanceBigInt % divisor;
        const decimalStr = remainder.toString().padStart(token.decimals, '0').slice(0, 6);
        const formatted = `${whole}.${decimalStr}`;
        const balanceNum = parseFloat(formatted);

        const price = token.coingeckoId ? prices.get(token.coingeckoId) : undefined;
        const priceUsd = price?.priceUsd || 0;

        // Record balance snapshot
        const key = `${token.chain}:${token.address}`;
        const history = this.balanceHistory.get(key) || [];
        history.push({
          chain: token.chain,
          tokenAddress: token.address,
          symbol: token.symbol,
          balanceRaw: balanceResult,
          balanceFormatted: formatted,
          timestamp: Date.now(),
        });
        // Keep last 100 snapshots per token
        if (history.length > 100) history.splice(0, history.length - 100);
        this.balanceHistory.set(key, history);

        entries.push({
          chain: token.chain,
          tokenAddress: token.address,
          symbol: token.symbol,
          balance: formatted,
          priceUsd,
          valueUsd: balanceNum * priceUsd,
        });
      } catch (err: any) {
        logger.warn(
          `[TokenMonitor] Failed to get balance for ${token.symbol} on ${token.chain}: ${err.message}`
        );
      }
    });

    await Promise.allSettled(tokenFetches);

    // 6. Calculate total
    const totalValueUsd = entries.reduce((sum, e) => sum + e.valueUsd, 0);

    const portfolio: Portfolio = {
      address,
      totalValueUsd,
      entries: entries.sort((a, b) => b.valueUsd - a.valueUsd),
      timestamp: Date.now(),
    };

    // Record history
    this.portfolioHistory.push({
      totalValueUsd,
      positionCount: entries.length,
      timestamp: Date.now(),
    });
    if (this.portfolioHistory.length > this.maxHistoryPoints) {
      this.portfolioHistory.splice(0, this.portfolioHistory.length - this.maxHistoryPoints);
    }

    logger.info(
      `[TokenMonitor] Portfolio: ${entries.length} positions, total $${totalValueUsd.toFixed(2)}`
    );

    return portfolio;
  }

  /**
   * Get portfolio value history.
   * @param limit - Maximum number of history points to return
   */
  getPortfolioHistory(limit: number = 50): PortfolioHistoryPoint[] {
    return this.portfolioHistory.slice(-limit);
  }

  /**
   * Get balance history for a specific token.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @param limit - Maximum snapshots to return
   */
  getTokenBalanceHistory(
    chain: string,
    tokenAddress: string,
    limit: number = 50
  ): TokenBalanceSnapshot[] {
    const key = `${chain}:${tokenAddress.toLowerCase()}`;
    const history = this.balanceHistory.get(key) || [];
    return history.slice(-limit);
  }

  // ---- Token Discovery ----

  /**
   * Attempt to discover new tokens in a wallet by checking a list of well-known
   * token addresses. This checks if the wallet holds any balance of these tokens.
   * @param chain - Chain key
   * @param walletAddress - Wallet to scan
   * @param knownTokens - Array of { address, coingeckoId? } to check
   * @returns Array of newly discovered tokens with non-zero balances
   */
  async discoverTokens(
    chain: string,
    walletAddress: string,
    knownTokens: Array<{ address: string; coingeckoId?: string }>
  ): Promise<TrackedToken[]> {
    logger.info(
      `[TokenMonitor] Discovering tokens on ${chain} for ${walletAddress} (${knownTokens.length} candidates)`
    );

    const discovered: TrackedToken[] = [];

    const checks = knownTokens.map(async (candidate) => {
      const key = `${chain}:${candidate.address.toLowerCase()}`;
      if (this.tokens.has(key)) return; // Already tracked

      try {
        const balance = await contractInteraction.getTokenBalanceOf(
          chain,
          candidate.address,
          walletAddress
        );

        if (BigInt(balance) > BigInt(0)) {
          const tracked = await this.addToken(chain, candidate.address, candidate.coingeckoId);
          discovered.push(tracked);
          logger.info(
            `[TokenMonitor] Discovered token with balance: ${tracked.symbol} on ${chain}`
          );
        }
      } catch {
        // Ignore failures for individual token checks
      }
    });

    await Promise.allSettled(checks);

    logger.info(`[TokenMonitor] Discovery complete: found ${discovered.length} new tokens`);
    return discovered;
  }

  // ---- Price Alerts ----

  /**
   * Add a price alert for a token.
   * @param tokenId - CoinGecko token ID
   * @param symbol - Token symbol for display
   * @param direction - 'above' or 'below'
   * @param thresholdUsd - Price threshold in USD
   * @returns The created PriceAlert
   */
  addPriceAlert(
    tokenId: string,
    symbol: string,
    direction: 'above' | 'below',
    thresholdUsd: number
  ): PriceAlert {
    const id = `alert-${++this.alertIdCounter}-${Date.now()}`;

    const alert: PriceAlert = {
      id,
      tokenId,
      symbol,
      direction,
      thresholdUsd,
      triggered: false,
      createdAt: Date.now(),
    };

    this.alerts.set(id, alert);
    logger.info(
      `[TokenMonitor] Alert created: ${symbol} ${direction} $${thresholdUsd} (${id})`
    );
    return alert;
  }

  /**
   * Remove a price alert by ID.
   * @param alertId - Alert ID to remove
   */
  removePriceAlert(alertId: string): boolean {
    const removed = this.alerts.delete(alertId);
    if (removed) {
      logger.info(`[TokenMonitor] Alert removed: ${alertId}`);
    }
    return removed;
  }

  /**
   * Get all configured price alerts.
   * @param includeTriggered - Whether to include already-triggered alerts
   */
  getPriceAlerts(includeTriggered: boolean = true): PriceAlert[] {
    const all = Array.from(this.alerts.values());
    if (includeTriggered) return all;
    return all.filter((a) => !a.triggered);
  }

  /**
   * Check if any alerts should be triggered based on a new price update.
   * @param price - The latest price data
   * @returns Array of alerts that were triggered
   */
  private checkAlerts(price: TokenPrice): PriceAlert[] {
    const triggered: PriceAlert[] = [];

    for (const alert of this.alerts.values()) {
      if (alert.triggered) continue;
      if (alert.tokenId !== price.tokenId) continue;

      let shouldTrigger = false;
      if (alert.direction === 'above' && price.priceUsd >= alert.thresholdUsd) {
        shouldTrigger = true;
      } else if (alert.direction === 'below' && price.priceUsd <= alert.thresholdUsd) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        triggered.push(alert);

        logger.info(
          `[TokenMonitor] 🔔 ALERT TRIGGERED: ${alert.symbol} is ${alert.direction} $${alert.thresholdUsd} (current: $${price.priceUsd})`
        );
      }
    }

    return triggered;
  }

  /**
   * Manually check all active (non-triggered) alerts against current prices.
   * Fetches fresh prices from CoinGecko and evaluates each alert.
   * @returns Array of newly triggered alerts
   */
  async checkAllAlerts(): Promise<PriceAlert[]> {
    const activeAlerts = this.getPriceAlerts(false);
    if (activeAlerts.length === 0) return [];

    // Collect unique token IDs
    const tokenIds = [...new Set(activeAlerts.map((a) => a.tokenId))];

    // Fetch prices
    const prices = await this.getMultipleTokenPrices(tokenIds);

    // checkAlerts is called internally by getMultipleTokenPrices via price cache update
    // Collect all triggered alerts
    return activeAlerts.filter((a) => a.triggered);
  }

  /**
   * Reset a triggered alert so it can fire again.
   * @param alertId - Alert ID to reset
   */
  resetAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.triggered = false;
      alert.triggeredAt = undefined;
      logger.info(`[TokenMonitor] Alert reset: ${alertId}`);
      return true;
    }
    return false;
  }

  // ---- Utility ----

  /**
   * Get a summary of the monitor's current state for debugging/display.
   */
  getSummary(): {
    trackedTokens: number;
    cachedPrices: number;
    activeAlerts: number;
    triggeredAlerts: number;
    historyPoints: number;
  } {
    const alerts = Array.from(this.alerts.values());
    return {
      trackedTokens: this.tokens.size,
      cachedPrices: this.priceCache.size,
      activeAlerts: alerts.filter((a) => !a.triggered).length,
      triggeredAlerts: alerts.filter((a) => a.triggered).length,
      historyPoints: this.portfolioHistory.length,
    };
  }

  /**
   * Clear all tracked tokens, history, and alerts.
   */
  reset(): void {
    this.tokens.clear();
    this.priceCache.clear();
    this.alerts.clear();
    this.portfolioHistory = [];
    this.balanceHistory.clear();
    this.alertIdCounter = 0;
    logger.info('[TokenMonitor] Reset complete — all data cleared');
  }
}

// ---- Singleton ----

export const tokenMonitor = new TokenMonitor();
export default tokenMonitor;
