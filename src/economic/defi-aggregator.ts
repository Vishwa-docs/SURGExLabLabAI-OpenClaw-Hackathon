// ============================================================
// src/economic/defi-aggregator.ts — DeFi Protocol Aggregator
// ============================================================
// Multi-protocol yield tracking via DeFiLlama, pool comparison,
// auto-rebalancing strategies, and cross-chain yield farming.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ---- Types ----

export type ProtocolCategory = 'dex' | 'lending' | 'yield' | 'liquid_staking' | 'bridge' | 'derivatives';
export type ChainName = 'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'bsc' | 'optimism' | 'solana';
export type StrategyType = 'single_pool' | 'farm_and_dump' | 'stable_yield' | 'delta_neutral' | 'leveraged_yield';

export interface DeFiProtocol {
  id: string;
  name: string;
  slug: string;
  category: ProtocolCategory;
  chains: ChainName[];
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  apy: number;
  url: string;
  audited: boolean;
  riskScore: number; // 0-100, higher = riskier
  lastUpdated: string;
}

export interface YieldPool {
  id: string;
  protocolId: string;
  protocolName: string;
  chain: ChainName;
  pool: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apyTotal: number;
  apyMean30d: number;
  volumeUsd24h: number;
  ilRisk: 'none' | 'low' | 'medium' | 'high';
  stablecoin: boolean;
  exposure: string[];
  lastUpdated: string;
}

export interface YieldStrategy {
  id: string;
  name: string;
  type: StrategyType;
  agentId: string;
  pools: YieldAllocation[];
  totalAllocated: number;
  currentApy: number;
  projectedYield30d: number;
  riskScore: number;
  isActive: boolean;
  createdAt: string;
  lastRebalanced: string;
  rebalanceThreshold: number; // % change triggering rebalance
  minApy: number;
  maxRisk: number;
}

export interface YieldAllocation {
  poolId: string;
  protocolName: string;
  chain: ChainName;
  symbol: string;
  amount: number;
  share: number; // 0-1
  currentApy: number;
  entryApy: number;
  pnl: number;
}

export interface RebalanceSuggestion {
  strategyId: string;
  reason: string;
  current: YieldAllocation[];
  suggested: YieldAllocation[];
  estimatedApyImprovement: number;
  estimatedRiskChange: number;
  timestamp: string;
}

export interface DeFiSnapshot {
  totalTvl: number;
  protocolCount: number;
  avgApy: number;
  topProtocols: DeFiProtocol[];
  topPools: YieldPool[];
  activeStrategies: number;
  totalAllocated: number;
  projectedYield: number;
  timestamp: string;
}

// ---- DeFi Aggregator Engine ----

const DEFILLAMA_API = 'https://yields.llama.fi';

export class DeFiAggregator {
  private protocols: Map<string, DeFiProtocol> = new Map();
  private pools: Map<string, YieldPool> = new Map();
  private strategies: Map<string, YieldStrategy> = new Map();
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 300_000; // 5 minutes

  // ── Data Fetching ──

  /**
   * Fetch top yield pools from DeFiLlama
   */
  async fetchPools(chain?: ChainName): Promise<YieldPool[]> {
    const now = Date.now();
    if (now - this.lastFetch < this.CACHE_TTL && this.pools.size > 0) {
      return this.getPoolsList(chain);
    }

    try {
      const response = await fetch(`${DEFILLAMA_API}/pools`);
      if (!response.ok) throw new Error(`DeFiLlama API error: ${response.status}`);

      const data = await response.json() as any;
      const rawPools: any[] = data.data || data || [];

      let filtered = rawPools
        .filter((p: any) => p.tvlUsd > 100_000 && p.apy > 0.1)
        .slice(0, 500);

      if (chain) {
        filtered = filtered.filter((p: any) =>
          p.chain?.toLowerCase() === chain.toLowerCase()
        );
      }

      for (const raw of filtered) {
        const pool: YieldPool = {
          id: raw.pool || uuidv4(),
          protocolId: raw.project || '',
          protocolName: raw.project || 'Unknown',
          chain: this.normalizeChain(raw.chain),
          pool: raw.pool || '',
          symbol: raw.symbol || '',
          tvlUsd: raw.tvlUsd || 0,
          apyBase: raw.apyBase || 0,
          apyReward: raw.apyReward || 0,
          apyTotal: raw.apy || 0,
          apyMean30d: raw.apyMean30d || raw.apy || 0,
          volumeUsd24h: raw.volumeUsd1d || 0,
          ilRisk: this.assessILRisk(raw),
          stablecoin: raw.stablecoin === true,
          exposure: raw.underlyingTokens || [],
          lastUpdated: new Date().toISOString(),
        };
        this.pools.set(pool.id, pool);
      }

      this.lastFetch = now;
      logger.info(`[DeFi] Fetched ${this.pools.size} yield pools from DeFiLlama`);
      return this.getPoolsList(chain);
    } catch (error: any) {
      logger.warn(`[DeFi] Failed to fetch from DeFiLlama: ${error.message}. Using seed data.`);
      this.seedDemoData();
      return this.getPoolsList(chain);
    }
  }

  /**
   * Fetch protocol TVL data
   */
  async fetchProtocols(): Promise<DeFiProtocol[]> {
    try {
      const response = await fetch('https://api.llama.fi/protocols');
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json() as any[];
      const top = data.slice(0, 100);

      for (const raw of top) {
        const protocol: DeFiProtocol = {
          id: raw.id?.toString() || uuidv4(),
          name: raw.name || 'Unknown',
          slug: raw.slug || '',
          category: this.normalizeCategory(raw.category),
          chains: (raw.chains || []).map((c: string) => this.normalizeChain(c)),
          tvl: raw.tvl || 0,
          tvlChange24h: raw.change_1d || 0,
          tvlChange7d: raw.change_7d || 0,
          apy: 0,
          url: raw.url || '',
          audited: raw.audits === '1' || raw.audit_links?.length > 0,
          riskScore: this.calculateProtocolRisk(raw),
          lastUpdated: new Date().toISOString(),
        };
        this.protocols.set(protocol.id, protocol);
      }

      logger.info(`[DeFi] Fetched ${this.protocols.size} protocols`);
      return Array.from(this.protocols.values());
    } catch (error: any) {
      logger.warn(`[DeFi] Failed to fetch protocols: ${error.message}. Using seed data.`);
      this.seedDemoProtocols();
      return Array.from(this.protocols.values());
    }
  }

  // ── Strategy Management ──

  /**
   * Create a yield farming strategy
   */
  createStrategy(params: {
    name: string;
    type: StrategyType;
    agentId: string;
    totalAllocation: number;
    minApy?: number;
    maxRisk?: number;
    rebalanceThreshold?: number;
  }): YieldStrategy {
    const strategy: YieldStrategy = {
      id: uuidv4(),
      name: params.name,
      type: params.type,
      agentId: params.agentId,
      pools: [],
      totalAllocated: params.totalAllocation,
      currentApy: 0,
      projectedYield30d: 0,
      riskScore: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastRebalanced: new Date().toISOString(),
      rebalanceThreshold: params.rebalanceThreshold || 5,
      minApy: params.minApy || 3,
      maxRisk: params.maxRisk || 50,
    };

    this.strategies.set(strategy.id, strategy);
    logger.info(`[DeFi] Created strategy '${strategy.name}' with $${strategy.totalAllocated} allocation`);
    return strategy;
  }

  /**
   * Auto-allocate strategy to best pools
   */
  async autoAllocate(strategyId: string): Promise<YieldStrategy> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

    await this.fetchPools();

    // Filter pools matching criteria
    const candidates = Array.from(this.pools.values())
      .filter(p => p.apyTotal >= strategy.minApy)
      .filter(p => {
        const risk = this.poolRiskScore(p);
        return risk <= strategy.maxRisk;
      })
      .sort((a, b) => {
        // Sort by risk-adjusted return (Sharpe-like)
        const aScore = a.apyTotal / Math.max(1, this.poolRiskScore(a));
        const bScore = b.apyTotal / Math.max(1, this.poolRiskScore(b));
        return bScore - aScore;
      });

    // Allocate to top pools based on strategy type
    const maxPools = strategy.type === 'single_pool' ? 1
      : strategy.type === 'stable_yield' ? 3
      : strategy.type === 'delta_neutral' ? 4
      : 5;

    const selected = candidates.slice(0, maxPools);
    if (selected.length === 0) {
      logger.warn(`[DeFi] No suitable pools found for strategy ${strategyId}`);
      return strategy;
    }

    // Equal weight for now, sophisticated weighting later
    const weights = this.calculateOptimalWeights(selected);
    strategy.pools = selected.map((pool, i) => ({
      poolId: pool.id,
      protocolName: pool.protocolName,
      chain: pool.chain,
      symbol: pool.symbol,
      amount: strategy.totalAllocated * weights[i],
      share: weights[i],
      currentApy: pool.apyTotal,
      entryApy: pool.apyTotal,
      pnl: 0,
    }));

    // Update strategy metrics
    strategy.currentApy = strategy.pools.reduce((s, p) => s + (p.currentApy * p.share), 0);
    strategy.projectedYield30d = (strategy.totalAllocated * strategy.currentApy / 100) / 12;
    strategy.riskScore = this.calculateStrategyRisk(strategy);
    strategy.lastRebalanced = new Date().toISOString();

    logger.info(`[DeFi] Auto-allocated strategy '${strategy.name}': ${strategy.pools.length} pools, ${strategy.currentApy.toFixed(2)}% APY`);
    return strategy;
  }

  /**
   * Check if strategy needs rebalancing
   */
  checkRebalance(strategyId: string): RebalanceSuggestion | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy || !strategy.isActive) return null;

    let needsRebalance = false;
    const reasons: string[] = [];

    for (const alloc of strategy.pools) {
      const pool = this.pools.get(alloc.poolId);
      if (!pool) continue;

      const apyChange = Math.abs(pool.apyTotal - alloc.entryApy);
      const apyChangePercent = alloc.entryApy > 0 ? (apyChange / alloc.entryApy) * 100 : 0;

      if (apyChangePercent > strategy.rebalanceThreshold) {
        needsRebalance = true;
        reasons.push(`${alloc.symbol}: APY changed from ${alloc.entryApy.toFixed(2)}% to ${pool.apyTotal.toFixed(2)}%`);
      }

      if (pool.apyTotal < strategy.minApy) {
        needsRebalance = true;
        reasons.push(`${alloc.symbol}: APY ${pool.apyTotal.toFixed(2)}% below minimum ${strategy.minApy}%`);
      }
    }

    if (!needsRebalance) return null;

    return {
      strategyId,
      reason: reasons.join('; '),
      current: [...strategy.pools],
      suggested: strategy.pools, // Would be recalculated
      estimatedApyImprovement: 0.5, // Placeholder
      estimatedRiskChange: -2,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Queries ──

  /**
   * Search pools by criteria
   */
  searchPools(params: {
    chain?: ChainName;
    minApy?: number;
    maxRisk?: number;
    stablecoinOnly?: boolean;
    protocol?: string;
    minTvl?: number;
    limit?: number;
  }): YieldPool[] {
    let pools = Array.from(this.pools.values());

    if (params.chain) pools = pools.filter(p => p.chain === params.chain);
    if (params.minApy) pools = pools.filter(p => p.apyTotal >= params.minApy!);
    if (params.stablecoinOnly) pools = pools.filter(p => p.stablecoin);
    if (params.protocol) pools = pools.filter(p =>
      p.protocolName.toLowerCase().includes(params.protocol!.toLowerCase())
    );
    if (params.minTvl) pools = pools.filter(p => p.tvlUsd >= params.minTvl!);
    if (params.maxRisk) pools = pools.filter(p => this.poolRiskScore(p) <= params.maxRisk!);

    pools.sort((a, b) => b.apyTotal - a.apyTotal);
    return pools.slice(0, params.limit || 50);
  }

  /**
   * Get best yield across chains for a given amount
   */
  getBestYield(amount: number, options?: {
    chains?: ChainName[];
    stablecoinOnly?: boolean;
    maxRisk?: number;
  }): { pool: YieldPool; projectedYield30d: number; projectedYield365d: number }[] {
    let pools = Array.from(this.pools.values());

    if (options?.chains) pools = pools.filter(p => options.chains!.includes(p.chain));
    if (options?.stablecoinOnly) pools = pools.filter(p => p.stablecoin);
    if (options?.maxRisk) pools = pools.filter(p => this.poolRiskScore(p) <= options.maxRisk!);

    return pools
      .sort((a, b) => b.apyTotal - a.apyTotal)
      .slice(0, 10)
      .map(pool => ({
        pool,
        projectedYield30d: (amount * pool.apyTotal / 100) / 12,
        projectedYield365d: amount * pool.apyTotal / 100,
      }));
  }

  /**
   * Get snapshot of DeFi landscape
   */
  getSnapshot(): DeFiSnapshot {
    const protocols = Array.from(this.protocols.values());
    const pools = Array.from(this.pools.values());
    const strategies = Array.from(this.strategies.values()).filter(s => s.isActive);

    return {
      totalTvl: protocols.reduce((s, p) => s + p.tvl, 0),
      protocolCount: protocols.length,
      avgApy: pools.length > 0 ? pools.reduce((s, p) => s + p.apyTotal, 0) / pools.length : 0,
      topProtocols: protocols.sort((a, b) => b.tvl - a.tvl).slice(0, 10),
      topPools: pools.sort((a, b) => b.apyTotal - a.apyTotal).slice(0, 10),
      activeStrategies: strategies.length,
      totalAllocated: strategies.reduce((s, st) => s + st.totalAllocated, 0),
      projectedYield: strategies.reduce((s, st) => s + st.projectedYield30d, 0),
      timestamp: new Date().toISOString(),
    };
  }

  getStrategies(agentId?: string): YieldStrategy[] {
    let strategies = Array.from(this.strategies.values());
    if (agentId) strategies = strategies.filter(s => s.agentId === agentId);
    return strategies;
  }

  getStrategy(id: string): YieldStrategy | undefined {
    return this.strategies.get(id);
  }

  // ── Helpers ──

  private getPoolsList(chain?: ChainName): YieldPool[] {
    let pools = Array.from(this.pools.values());
    if (chain) pools = pools.filter(p => p.chain === chain);
    return pools;
  }

  private normalizeChain(chain: string): ChainName {
    const map: Record<string, ChainName> = {
      ethereum: 'ethereum', eth: 'ethereum',
      base: 'base',
      polygon: 'polygon', matic: 'polygon',
      arbitrum: 'arbitrum', 'arbitrum one': 'arbitrum',
      bsc: 'bsc', 'binance': 'bsc',
      optimism: 'optimism', op: 'optimism',
      solana: 'solana', sol: 'solana',
    };
    return map[chain?.toLowerCase()] || 'ethereum';
  }

  private normalizeCategory(cat: string): ProtocolCategory {
    const map: Record<string, ProtocolCategory> = {
      dexes: 'dex', dex: 'dex',
      lending: 'lending', cdp: 'lending',
      yield: 'yield', 'yield aggregator': 'yield',
      'liquid staking': 'liquid_staking', staking: 'liquid_staking',
      bridge: 'bridge', cross_chain: 'bridge',
      derivatives: 'derivatives', options: 'derivatives', perps: 'derivatives',
    };
    return map[cat?.toLowerCase()] || 'yield';
  }

  private assessILRisk(raw: any): 'none' | 'low' | 'medium' | 'high' {
    if (raw.stablecoin) return 'none';
    if (raw.ilRisk === 'no') return 'none';
    const tokens = raw.underlyingTokens?.length || 1;
    if (tokens <= 1) return 'none';
    if (tokens === 2 && raw.stablecoin) return 'low';
    if (raw.apy > 100) return 'high';
    return 'medium';
  }

  private poolRiskScore(pool: YieldPool): number {
    let risk = 0;
    // High APY = higher risk
    if (pool.apyTotal > 100) risk += 40;
    else if (pool.apyTotal > 50) risk += 25;
    else if (pool.apyTotal > 20) risk += 10;
    // Low TVL = higher risk
    if (pool.tvlUsd < 1_000_000) risk += 30;
    else if (pool.tvlUsd < 10_000_000) risk += 15;
    // IL risk
    if (pool.ilRisk === 'high') risk += 25;
    else if (pool.ilRisk === 'medium') risk += 15;
    else if (pool.ilRisk === 'low') risk += 5;
    // Stablecoin = lower risk
    if (pool.stablecoin) risk -= 15;
    return Math.max(0, Math.min(100, risk));
  }

  private calculateProtocolRisk(raw: any): number {
    let risk = 50;
    if (raw.tvl > 1_000_000_000) risk -= 20;
    else if (raw.tvl > 100_000_000) risk -= 10;
    if (raw.audits === '1' || raw.audit_links?.length > 0) risk -= 15;
    if (raw.change_1d < -10) risk += 15;
    if (raw.chains?.length > 3) risk -= 5;
    return Math.max(0, Math.min(100, risk));
  }

  private calculateOptimalWeights(pools: YieldPool[]): number[] {
    // Risk-parity inspired: weight inversely proportional to risk
    const risks = pools.map(p => Math.max(1, this.poolRiskScore(p)));
    const invRisks = risks.map(r => 1 / r);
    const total = invRisks.reduce((s, v) => s + v, 0);
    return invRisks.map(v => v / total);
  }

  private calculateStrategyRisk(strategy: YieldStrategy): number {
    if (strategy.pools.length === 0) return 0;
    // Weighted average risk
    let totalRisk = 0;
    for (const alloc of strategy.pools) {
      const pool = this.pools.get(alloc.poolId);
      if (pool) totalRisk += this.poolRiskScore(pool) * alloc.share;
    }
    // Diversification discount
    const diversificationDiscount = Math.min(15, strategy.pools.length * 3);
    return Math.max(0, Math.min(100, totalRisk - diversificationDiscount));
  }

  private seedDemoData(): void {
    const demoPoolsData: Partial<YieldPool>[] = [
      { protocolName: 'Aave V3', chain: 'base', symbol: 'USDC', tvlUsd: 500_000_000, apyBase: 4.2, apyReward: 0.8, apyTotal: 5.0, stablecoin: true, ilRisk: 'none' },
      { protocolName: 'Uniswap V3', chain: 'base', symbol: 'ETH-USDC', tvlUsd: 300_000_000, apyBase: 12.5, apyReward: 3.0, apyTotal: 15.5, stablecoin: false, ilRisk: 'medium' },
      { protocolName: 'Compound V3', chain: 'ethereum', symbol: 'USDC', tvlUsd: 1_200_000_000, apyBase: 3.8, apyReward: 1.2, apyTotal: 5.0, stablecoin: true, ilRisk: 'none' },
      { protocolName: 'Lido', chain: 'ethereum', symbol: 'stETH', tvlUsd: 15_000_000_000, apyBase: 3.5, apyReward: 0, apyTotal: 3.5, stablecoin: false, ilRisk: 'none' },
      { protocolName: 'Curve', chain: 'ethereum', symbol: '3pool', tvlUsd: 800_000_000, apyBase: 2.1, apyReward: 4.0, apyTotal: 6.1, stablecoin: true, ilRisk: 'low' },
      { protocolName: 'Aerodrome', chain: 'base', symbol: 'AERO-USDC', tvlUsd: 150_000_000, apyBase: 25.0, apyReward: 10.0, apyTotal: 35.0, stablecoin: false, ilRisk: 'high' },
      { protocolName: 'Morpho', chain: 'base', symbol: 'WETH', tvlUsd: 400_000_000, apyBase: 5.5, apyReward: 2.0, apyTotal: 7.5, stablecoin: false, ilRisk: 'none' },
      { protocolName: 'Pendle', chain: 'arbitrum', symbol: 'PT-stETH', tvlUsd: 200_000_000, apyBase: 8.0, apyReward: 0, apyTotal: 8.0, stablecoin: false, ilRisk: 'low' },
    ];

    for (const data of demoPoolsData) {
      const pool: YieldPool = {
        id: uuidv4(),
        protocolId: data.protocolName!.toLowerCase().replace(/\s/g, '-'),
        protocolName: data.protocolName!,
        chain: data.chain!,
        pool: `${data.protocolName}-${data.symbol}`,
        symbol: data.symbol!,
        tvlUsd: data.tvlUsd!,
        apyBase: data.apyBase!,
        apyReward: data.apyReward!,
        apyTotal: data.apyTotal!,
        apyMean30d: data.apyTotal!,
        volumeUsd24h: data.tvlUsd! * 0.05,
        ilRisk: data.ilRisk!,
        stablecoin: data.stablecoin!,
        exposure: [],
        lastUpdated: new Date().toISOString(),
      };
      this.pools.set(pool.id, pool);
    }
    logger.info(`[DeFi] Seeded ${demoPoolsData.length} demo pools`);
  }

  private seedDemoProtocols(): void {
    const protocols: Partial<DeFiProtocol>[] = [
      { name: 'Aave V3', slug: 'aave-v3', category: 'lending', chains: ['ethereum', 'base', 'polygon', 'arbitrum'], tvl: 12_000_000_000, audited: true, riskScore: 15 },
      { name: 'Uniswap V3', slug: 'uniswap-v3', category: 'dex', chains: ['ethereum', 'base', 'polygon', 'arbitrum'], tvl: 5_000_000_000, audited: true, riskScore: 20 },
      { name: 'Lido', slug: 'lido', category: 'liquid_staking', chains: ['ethereum'], tvl: 15_000_000_000, audited: true, riskScore: 10 },
      { name: 'Curve Finance', slug: 'curve', category: 'dex', chains: ['ethereum', 'polygon', 'arbitrum'], tvl: 3_000_000_000, audited: true, riskScore: 25 },
      { name: 'Compound V3', slug: 'compound-v3', category: 'lending', chains: ['ethereum', 'base'], tvl: 2_000_000_000, audited: true, riskScore: 15 },
      { name: 'Aerodrome', slug: 'aerodrome', category: 'dex', chains: ['base'], tvl: 600_000_000, audited: true, riskScore: 30 },
    ];

    for (const data of protocols) {
      const protocol: DeFiProtocol = {
        id: uuidv4(),
        name: data.name!,
        slug: data.slug!,
        category: data.category!,
        chains: data.chains!,
        tvl: data.tvl!,
        tvlChange24h: (Math.random() - 0.5) * 5,
        tvlChange7d: (Math.random() - 0.3) * 10,
        apy: 0,
        url: `https://${data.slug}.fi`,
        audited: data.audited!,
        riskScore: data.riskScore!,
        lastUpdated: new Date().toISOString(),
      };
      this.protocols.set(protocol.id, protocol);
    }
  }
}

export const defiAggregator = new DeFiAggregator();
