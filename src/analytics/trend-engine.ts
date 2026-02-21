// ============================================================
// src/analytics/trend-engine.ts — Market Trend Detection Engine
// ============================================================
// CoinGecko + DeFiLlama integration for real-time market trend
// analysis including momentum indicators, correlation analysis,
// sector rotation detection, and anomaly alerts.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ---- Types ----

export type TrendDirection = 'bullish' | 'bearish' | 'neutral' | 'volatile';
export type TimeFrame = '1h' | '4h' | '1d' | '7d' | '30d';
export type SignalStrength = 'strong' | 'moderate' | 'weak';

export interface MarketTrend {
  id: string;
  asset: string;
  symbol: string;
  direction: TrendDirection;
  strength: SignalStrength;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  volume24h: number;
  volumeChange24h: number;
  marketCap: number;
  marketCapRank: number;
  momentum: MomentumIndicators;
  signals: TrendSignal[];
  analyzedAt: string;
}

export interface MomentumIndicators {
  rsi: number;           // Relative Strength Index (0-100)
  macdSignal: number;    // MACD signal line
  macdHistogram: number; // MACD histogram
  ema20: number;         // 20-period EMA
  ema50: number;         // 50-period EMA
  sma200: number;        // 200-period SMA
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
  atr: number;           // Average True Range (volatility)
  obv: number;           // On-Balance Volume
}

export interface TrendSignal {
  type: string;
  direction: TrendDirection;
  strength: SignalStrength;
  description: string;
  timestamp: string;
}

export interface SectorPerformance {
  sector: string;
  tokens: string[];
  avgPerformance24h: number;
  avgPerformance7d: number;
  avgPerformance30d: number;
  totalVolume24h: number;
  totalMarketCap: number;
  rotation: 'inflow' | 'outflow' | 'stable';
  timestamp: string;
}

export interface CorrelationMatrix {
  assets: string[];
  matrix: number[][]; // Pearson correlation coefficients
  timestamp: string;
}

export interface AnomalyAlert {
  id: string;
  asset: string;
  type: 'price_spike' | 'volume_anomaly' | 'whale_activity' | 'flash_crash' | 'divergence' | 'breakout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface MarketOverview {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  totalCryptos: number;
  fearGreedIndex: number;
  fearGreedLabel: string;
  topGainers: { symbol: string; change: number }[];
  topLosers: { symbol: string; change: number }[];
  trending: string[];
  sectors: SectorPerformance[];
  anomalies: AnomalyAlert[];
  timestamp: string;
}

export interface PriceHistory {
  asset: string;
  prices: { timestamp: number; price: number; volume: number }[];
  startDate: string;
  endDate: string;
}

// ---- Constants ----

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_API = 'https://api.llama.fi';
const RATE_LIMIT_MS = 1500; // CoinGecko free rate limit

// Sector definitions
const SECTORS: Record<string, string[]> = {
  'Layer 1': ['bitcoin', 'ethereum', 'solana', 'avalanche-2', 'cardano'],
  'Layer 2': ['matic-network', 'arbitrum', 'optimism', 'starknet'],
  'DeFi': ['uniswap', 'aave', 'maker', 'compound-governance-token', 'curve-dao-token'],
  'Stablecoins': ['tether', 'usd-coin', 'dai', 'frax'],
  'AI & Agents': ['fetch-ai', 'ocean-protocol', 'singularitynet', 'render-token'],
  'Gaming': ['the-sandbox', 'decentraland', 'axie-infinity', 'immutable-x'],
  'Infrastructure': ['chainlink', 'the-graph', 'filecoin', 'arweave'],
  'Meme': ['dogecoin', 'shiba-inu', 'pepe', 'bonk'],
};

// ---- Engine ----

export class TrendEngine {
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private historyCache: Map<string, PriceHistory> = new Map();
  private trends: Map<string, MarketTrend> = new Map();
  private anomalies: AnomalyAlert[] = [];
  private lastApiCall: number = 0;

  // ── Market Data ──

  /**
   * Fetch current market overview
   */
  async getMarketOverview(): Promise<MarketOverview> {
    try {
      await this.enforceRateLimit();
      const response = await fetch(`${COINGECKO_API}/global`);
      if (!response.ok) throw new Error(`CoinGecko API: ${response.status}`);

      const data = await response.json() as any;
      const global = data.data;

      // Fetch top movers
      await this.enforceRateLimit();
      const marketsResp = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`
      );
      const markets = marketsResp.ok ? await marketsResp.json() as any[] : [];

      const sorted = [...markets].sort((a, b) =>
        (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
      );

      // Fear & Greed approximation from market data
      const avgChange = markets.reduce((s: number, m: any) => s + (m.price_change_percentage_24h || 0), 0) / Math.max(1, markets.length);
      const fearGreed = Math.max(0, Math.min(100, 50 + avgChange * 5));

      return {
        totalMarketCap: global?.total_market_cap?.usd || 0,
        totalVolume24h: global?.total_volume?.usd || 0,
        btcDominance: global?.market_cap_percentage?.btc || 0,
        ethDominance: global?.market_cap_percentage?.eth || 0,
        totalCryptos: global?.active_cryptocurrencies || 0,
        fearGreedIndex: Math.round(fearGreed),
        fearGreedLabel: fearGreed >= 75 ? 'Extreme Greed' : fearGreed >= 55 ? 'Greed' :
          fearGreed >= 45 ? 'Neutral' : fearGreed >= 25 ? 'Fear' : 'Extreme Fear',
        topGainers: sorted.slice(0, 5).map((m: any) => ({
          symbol: m.symbol?.toUpperCase() || '',
          change: m.price_change_percentage_24h || 0,
        })),
        topLosers: sorted.slice(-5).reverse().map((m: any) => ({
          symbol: m.symbol?.toUpperCase() || '',
          change: m.price_change_percentage_24h || 0,
        })),
        trending: markets.slice(0, 10).map((m: any) => m.symbol?.toUpperCase()),
        sectors: await this.getSectorPerformance(),
        anomalies: this.anomalies.slice(-10),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.warn(`[Trends] Failed to fetch market overview: ${error.message}. Using demo data.`);
      return this.getDemoOverview();
    }
  }

  /**
   * Analyze trend for a specific asset
   */
  async analyzeTrend(coinId: string): Promise<MarketTrend> {
    try {
      await this.enforceRateLimit();
      const response = await fetch(
        `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const coin = await response.json() as any;

      // Fetch price history for indicators
      const history = await this.fetchPriceHistory(coinId, 30);
      const prices = history.prices.map(p => p.price);

      // Calculate momentum indicators
      const momentum = this.calculateMomentum(prices);

      // Generate signals
      const signals = this.generateSignals(momentum, coin);

      // Determine overall direction
      const direction = this.determineDirection(momentum, signals);
      const strength = this.determineStrength(momentum, signals);

      const trend: MarketTrend = {
        id: uuidv4(),
        asset: coin.name || coinId,
        symbol: (coin.symbol || coinId).toUpperCase(),
        direction,
        strength,
        price: coin.market_data?.current_price?.usd || 0,
        priceChange24h: coin.market_data?.price_change_percentage_24h || 0,
        priceChange7d: coin.market_data?.price_change_percentage_7d || 0,
        priceChange30d: coin.market_data?.price_change_percentage_30d || 0,
        volume24h: coin.market_data?.total_volume?.usd || 0,
        volumeChange24h: 0,
        marketCap: coin.market_data?.market_cap?.usd || 0,
        marketCapRank: coin.market_cap_rank || 0,
        momentum,
        signals,
        analyzedAt: new Date().toISOString(),
      };

      this.trends.set(coinId, trend);

      // Check for anomalies
      this.checkAnomalies(trend);

      logger.info(`[Trends] ${trend.symbol}: ${trend.direction} (${trend.strength}) — RSI: ${momentum.rsi.toFixed(1)}, Price 24h: ${trend.priceChange24h.toFixed(2)}%`);
      return trend;
    } catch (error: any) {
      logger.warn(`[Trends] Failed to analyze ${coinId}: ${error.message}. Using demo.`);
      return this.getDemoTrend(coinId);
    }
  }

  /**
   * Fetch price history
   */
  async fetchPriceHistory(coinId: string, days: number = 30): Promise<PriceHistory> {
    const cacheKey = `${coinId}:${days}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached && Date.now() - new Date(cached.endDate).getTime() < 3600000) {
      return cached;
    }

    try {
      await this.enforceRateLimit();
      const response = await fetch(
        `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json() as any;
      const history: PriceHistory = {
        asset: coinId,
        prices: (data.prices || []).map(([ts, price]: [number, number], i: number) => ({
          timestamp: ts,
          price,
          volume: data.total_volumes?.[i]?.[1] || 0,
        })),
        startDate: new Date(Date.now() - days * 86400000).toISOString(),
        endDate: new Date().toISOString(),
      };

      this.historyCache.set(cacheKey, history);
      return history;
    } catch {
      // Return synthetic data
      return this.generateSyntheticHistory(coinId, days);
    }
  }

  /**
   * Calculate correlation between assets
   */
  async getCorrelationMatrix(coinIds: string[]): Promise<CorrelationMatrix> {
    const histories: number[][] = [];

    for (const coinId of coinIds) {
      const history = await this.fetchPriceHistory(coinId, 30);
      histories.push(history.prices.map(p => p.price));
    }

    // Normalize all arrays to same length
    const minLen = Math.min(...histories.map(h => h.length));
    const normalized = histories.map(h => h.slice(-minLen));

    // Calculate returns
    const returns = normalized.map(prices => {
      const ret: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        ret.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      return ret;
    });

    // Pearson correlation
    const matrix: number[][] = [];
    for (let i = 0; i < returns.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < returns.length; j++) {
        matrix[i][j] = i === j ? 1.0 : this.pearsonCorrelation(returns[i], returns[j]);
      }
    }

    return {
      assets: coinIds,
      matrix,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get DeFi TVL trends
   */
  async getDeFiTrends(): Promise<{
    totalTvl: number;
    tvlChange24h: number;
    topProtocols: { name: string; tvl: number; change24h: number }[];
    chainBreakdown: { chain: string; tvl: number; change24h: number }[];
    timestamp: string;
  }> {
    try {
      const [protocolsResp, chainsResp] = await Promise.all([
        fetch(`${DEFILLAMA_API}/protocols`),
        fetch(`${DEFILLAMA_API}/v2/chains`),
      ]);

      const protocols = protocolsResp.ok ? await protocolsResp.json() as any[] : [];
      const chains = chainsResp.ok ? await chainsResp.json() as any[] : [];

      return {
        totalTvl: protocols.reduce((s: number, p: any) => s + (p.tvl || 0), 0),
        tvlChange24h: protocols.reduce((s: number, p: any) => s + (p.change_1d || 0), 0) / Math.max(1, protocols.length),
        topProtocols: protocols.slice(0, 20).map((p: any) => ({
          name: p.name,
          tvl: p.tvl || 0,
          change24h: p.change_1d || 0,
        })),
        chainBreakdown: (chains as any[]).slice(0, 15).map((c: any) => ({
          chain: c.name || c.gecko_id,
          tvl: c.tvl || 0,
          change24h: c.tokenSymbol ? 0 : 0, // Chain data doesn't include 24h change
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.warn(`[Trends] Failed to fetch DeFi trends: ${error.message}`);
      return {
        totalTvl: 95_000_000_000,
        tvlChange24h: 1.2,
        topProtocols: [
          { name: 'Lido', tvl: 15_000_000_000, change24h: 0.5 },
          { name: 'Aave V3', tvl: 12_000_000_000, change24h: 1.1 },
          { name: 'EigenLayer', tvl: 10_000_000_000, change24h: 2.3 },
          { name: 'Uniswap V3', tvl: 5_000_000_000, change24h: -0.3 },
          { name: 'Maker', tvl: 4_500_000_000, change24h: 0.8 },
        ],
        chainBreakdown: [
          { chain: 'Ethereum', tvl: 55_000_000_000, change24h: 0.5 },
          { chain: 'Tron', tvl: 8_000_000_000, change24h: -0.2 },
          { chain: 'BSC', tvl: 5_000_000_000, change24h: 0.3 },
          { chain: 'Arbitrum', tvl: 3_000_000_000, change24h: 1.5 },
          { chain: 'Base', tvl: 2_500_000_000, change24h: 3.0 },
          { chain: 'Solana', tvl: 4_000_000_000, change24h: 2.1 },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get sector performance
   */
  async getSectorPerformance(): Promise<SectorPerformance[]> {
    const sectors: SectorPerformance[] = [];

    for (const [name, tokens] of Object.entries(SECTORS)) {
      const trendData: MarketTrend[] = [];
      for (const token of tokens.slice(0, 3)) { // Limit API calls
        const trend = this.trends.get(token);
        if (trend) trendData.push(trend);
      }

      if (trendData.length === 0) {
        // Use synthetic data
        sectors.push({
          sector: name,
          tokens,
          avgPerformance24h: (Math.random() - 0.3) * 10,
          avgPerformance7d: (Math.random() - 0.3) * 20,
          avgPerformance30d: (Math.random() - 0.2) * 40,
          totalVolume24h: Math.random() * 5_000_000_000,
          totalMarketCap: Math.random() * 100_000_000_000,
          rotation: Math.random() > 0.5 ? 'inflow' : 'outflow',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const avg24h = trendData.reduce((s, t) => s + t.priceChange24h, 0) / trendData.length;
      const avg7d = trendData.reduce((s, t) => s + t.priceChange7d, 0) / trendData.length;
      const avg30d = trendData.reduce((s, t) => s + t.priceChange30d, 0) / trendData.length;

      sectors.push({
        sector: name,
        tokens,
        avgPerformance24h: avg24h,
        avgPerformance7d: avg7d,
        avgPerformance30d: avg30d,
        totalVolume24h: trendData.reduce((s, t) => s + t.volume24h, 0),
        totalMarketCap: trendData.reduce((s, t) => s + t.marketCap, 0),
        rotation: avg24h > 2 ? 'inflow' : avg24h < -2 ? 'outflow' : 'stable',
        timestamp: new Date().toISOString(),
      });
    }

    return sectors.sort((a, b) => b.avgPerformance24h - a.avgPerformance24h);
  }

  /**
   * Get active anomalies
   */
  getAnomalies(limit: number = 20): AnomalyAlert[] {
    return this.anomalies.slice(-limit);
  }

  /**
   * Get all cached trends
   */
  getTrends(): MarketTrend[] {
    return Array.from(this.trends.values());
  }

  // ── Private Methods ──

  private calculateMomentum(prices: number[]): MomentumIndicators {
    if (prices.length < 3) {
      return this.defaultMomentum(prices[prices.length - 1] || 0);
    }

    const rsi = this.calculateRSI(prices, 14);
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    const sma200 = this.calculateSMA(prices, Math.min(200, prices.length));
    const { signal, histogram } = this.calculateMACD(prices);
    const atr = this.calculateATR(prices, 14);
    const { upper, lower, middle } = this.calculateBollinger(prices, 20, 2);

    return {
      rsi,
      macdSignal: signal,
      macdHistogram: histogram,
      ema20,
      ema50,
      sma200,
      bollingerUpper: upper,
      bollingerLower: lower,
      bollingerMiddle: middle,
      atr,
      obv: this.calculateOBV(prices),
    };
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;
    const slice = prices.slice(-period - 1);

    for (let i = 1; i < slice.length; i++) {
      const change = slice[i] - slice[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calculateSMA(prices: number[], period: number): number {
    const slice = prices.slice(-period);
    return slice.reduce((s, p) => s + p, 0) / slice.length;
  }

  private calculateMACD(prices: number[]): { signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;

    // Signal line (9-period EMA of MACD)
    // Simplified: just use the MACD line as a proxy
    const signal = macdLine * 0.8; // Approximate
    const histogram = macdLine - signal;

    return { signal, histogram };
  }

  private calculateATR(prices: number[], period: number): number {
    if (prices.length < 2) return 0;

    let atr = 0;
    const slice = prices.slice(-period - 1);
    for (let i = 1; i < slice.length; i++) {
      atr += Math.abs(slice[i] - slice[i - 1]);
    }
    return atr / Math.max(1, slice.length - 1);
  }

  private calculateBollinger(prices: number[], period: number, multiplier: number): {
    upper: number; lower: number; middle: number;
  } {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    const variance = slice.reduce((s, p) => s + (p - sma) ** 2, 0) / slice.length;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + stdDev * multiplier,
      lower: sma - stdDev * multiplier,
      middle: sma,
    };
  }

  private calculateOBV(prices: number[]): number {
    let obv = 0;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) obv += 1;
      else if (prices[i] < prices[i - 1]) obv -= 1;
    }
    return obv;
  }

  private generateSignals(momentum: MomentumIndicators, coin: any): TrendSignal[] {
    const signals: TrendSignal[] = [];
    const now = new Date().toISOString();

    // RSI signals
    if (momentum.rsi > 70) {
      signals.push({
        type: 'RSI Overbought',
        direction: 'bearish',
        strength: momentum.rsi > 80 ? 'strong' : 'moderate',
        description: `RSI at ${momentum.rsi.toFixed(1)} — overbought territory`,
        timestamp: now,
      });
    } else if (momentum.rsi < 30) {
      signals.push({
        type: 'RSI Oversold',
        direction: 'bullish',
        strength: momentum.rsi < 20 ? 'strong' : 'moderate',
        description: `RSI at ${momentum.rsi.toFixed(1)} — oversold territory`,
        timestamp: now,
      });
    }

    // EMA crossover
    if (momentum.ema20 > momentum.ema50) {
      signals.push({
        type: 'Golden Cross (EMA)',
        direction: 'bullish',
        strength: 'moderate',
        description: 'EMA20 above EMA50 — bullish crossover',
        timestamp: now,
      });
    } else if (momentum.ema20 < momentum.ema50) {
      signals.push({
        type: 'Death Cross (EMA)',
        direction: 'bearish',
        strength: 'moderate',
        description: 'EMA20 below EMA50 — bearish crossover',
        timestamp: now,
      });
    }

    // MACD
    if (momentum.macdHistogram > 0) {
      signals.push({
        type: 'MACD Bullish',
        direction: 'bullish',
        strength: momentum.macdHistogram > 1 ? 'strong' : 'weak',
        description: 'MACD histogram positive — bullish momentum',
        timestamp: now,
      });
    } else {
      signals.push({
        type: 'MACD Bearish',
        direction: 'bearish',
        strength: momentum.macdHistogram < -1 ? 'strong' : 'weak',
        description: 'MACD histogram negative — bearish momentum',
        timestamp: now,
      });
    }

    // Bollinger Bands
    const currentPrice = coin?.market_data?.current_price?.usd || momentum.bollingerMiddle;
    if (currentPrice > momentum.bollingerUpper) {
      signals.push({
        type: 'Bollinger Upper Break',
        direction: 'volatile',
        strength: 'strong',
        description: 'Price above upper Bollinger Band — potential reversal or breakout',
        timestamp: now,
      });
    } else if (currentPrice < momentum.bollingerLower) {
      signals.push({
        type: 'Bollinger Lower Break',
        direction: 'volatile',
        strength: 'strong',
        description: 'Price below lower Bollinger Band — potential bounce or continuation down',
        timestamp: now,
      });
    }

    return signals;
  }

  private determineDirection(momentum: MomentumIndicators, signals: TrendSignal[]): TrendDirection {
    const bullish = signals.filter(s => s.direction === 'bullish').length;
    const bearish = signals.filter(s => s.direction === 'bearish').length;
    const volatile = signals.filter(s => s.direction === 'volatile').length;

    if (volatile >= 2) return 'volatile';
    if (bullish > bearish + 1) return 'bullish';
    if (bearish > bullish + 1) return 'bearish';
    return 'neutral';
  }

  private determineStrength(momentum: MomentumIndicators, signals: TrendSignal[]): SignalStrength {
    const strongCount = signals.filter(s => s.strength === 'strong').length;
    if (strongCount >= 2) return 'strong';
    if (strongCount >= 1) return 'moderate';
    return 'weak';
  }

  private checkAnomalies(trend: MarketTrend): void {
    // Price spike detection
    if (Math.abs(trend.priceChange24h) > 20) {
      this.anomalies.push({
        id: uuidv4(),
        asset: trend.symbol,
        type: trend.priceChange24h > 0 ? 'price_spike' : 'flash_crash',
        severity: Math.abs(trend.priceChange24h) > 50 ? 'critical' : 'high',
        description: `${trend.symbol} moved ${trend.priceChange24h.toFixed(1)}% in 24h`,
        value: trend.priceChange24h,
        threshold: 20,
        timestamp: new Date().toISOString(),
      });
    }

    // RSI extremes
    if (trend.momentum.rsi > 85 || trend.momentum.rsi < 15) {
      this.anomalies.push({
        id: uuidv4(),
        asset: trend.symbol,
        type: 'divergence',
        severity: 'medium',
        description: `${trend.symbol} RSI at extreme: ${trend.momentum.rsi.toFixed(1)}`,
        value: trend.momentum.rsi,
        threshold: trend.momentum.rsi > 85 ? 85 : 15,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;

    const xSlice = x.slice(-n);
    const ySlice = y.slice(-n);

    const meanX = xSlice.reduce((s, v) => s + v, 0) / n;
    const meanY = ySlice.reduce((s, v) => s + v, 0) / n;

    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xSlice[i] - meanX;
      const dy = ySlice[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den > 0 ? num / den : 0;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastApiCall;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    this.lastApiCall = Date.now();
  }

  private defaultMomentum(price: number): MomentumIndicators {
    return {
      rsi: 50,
      macdSignal: 0,
      macdHistogram: 0,
      ema20: price,
      ema50: price,
      sma200: price,
      bollingerUpper: price * 1.05,
      bollingerLower: price * 0.95,
      bollingerMiddle: price,
      atr: price * 0.02,
      obv: 0,
    };
  }

  private generateSyntheticHistory(coinId: string, days: number): PriceHistory {
    const basePrice = coinId === 'bitcoin' ? 65000 : coinId === 'ethereum' ? 3500 : 1;
    const prices: { timestamp: number; price: number; volume: number }[] = [];
    let price = basePrice;

    for (let i = days; i >= 0; i--) {
      const t = Date.now() - i * 86400000;
      price *= 1 + (Math.random() - 0.48) * 0.05; // Slight upward bias
      prices.push({
        timestamp: t,
        price,
        volume: Math.random() * 1_000_000_000,
      });
    }

    return {
      asset: coinId,
      prices,
      startDate: new Date(Date.now() - days * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    };
  }

  private getDemoOverview(): MarketOverview {
    return {
      totalMarketCap: 2_450_000_000_000,
      totalVolume24h: 95_000_000_000,
      btcDominance: 52.3,
      ethDominance: 17.8,
      totalCryptos: 14520,
      fearGreedIndex: 62,
      fearGreedLabel: 'Greed',
      topGainers: [
        { symbol: 'SOL', change: 8.5 },
        { symbol: 'LINK', change: 6.2 },
        { symbol: 'AVAX', change: 5.8 },
        { symbol: 'ARB', change: 4.3 },
        { symbol: 'UNI', change: 3.9 },
      ],
      topLosers: [
        { symbol: 'DOGE', change: -3.2 },
        { symbol: 'SHIB', change: -2.8 },
        { symbol: 'ADA', change: -1.5 },
        { symbol: 'DOT', change: -1.2 },
        { symbol: 'XRP', change: -0.8 },
      ],
      trending: ['BTC', 'ETH', 'SOL', 'LINK', 'AVAX', 'ARB', 'OP', 'UNI', 'AAVE', 'MKR'],
      sectors: [],
      anomalies: [],
      timestamp: new Date().toISOString(),
    };
  }

  private getDemoTrend(coinId: string): MarketTrend {
    const demoData: Record<string, Partial<MarketTrend>> = {
      bitcoin: { asset: 'Bitcoin', symbol: 'BTC', price: 65000, priceChange24h: 2.1, priceChange7d: 5.3, marketCap: 1_270_000_000_000, marketCapRank: 1 },
      ethereum: { asset: 'Ethereum', symbol: 'ETH', price: 3500, priceChange24h: 1.5, priceChange7d: 3.8, marketCap: 420_000_000_000, marketCapRank: 2 },
      solana: { asset: 'Solana', symbol: 'SOL', price: 180, priceChange24h: 8.5, priceChange7d: 12.0, marketCap: 80_000_000_000, marketCapRank: 5 },
    };

    const data = demoData[coinId] || { asset: coinId, symbol: coinId.toUpperCase(), price: 1.0, priceChange24h: 0, marketCap: 0, marketCapRank: 999 };

    return {
      id: uuidv4(),
      asset: data.asset!,
      symbol: data.symbol!,
      direction: (data.priceChange24h || 0) > 2 ? 'bullish' : (data.priceChange24h || 0) < -2 ? 'bearish' : 'neutral',
      strength: 'moderate',
      price: data.price!,
      priceChange24h: data.priceChange24h || 0,
      priceChange7d: data.priceChange7d || 0,
      priceChange30d: (data.priceChange7d || 0) * 2,
      volume24h: data.marketCap! * 0.03,
      volumeChange24h: 5.0,
      marketCap: data.marketCap!,
      marketCapRank: data.marketCapRank!,
      momentum: this.defaultMomentum(data.price!),
      signals: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}

export const trendEngine = new TrendEngine();
