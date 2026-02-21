// ============================================================
// src/economic/revenue-sharing.ts — Skill Revenue Sharing Engine
// ============================================================
// Agent-to-agent skill monetization with revenue splits:
//   - 70% to skill creator
//   - 20% to platform/DAO treasury
//   - 10% to referrer / discovery agent
// Tracks earnings, payouts, and royalty streams.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ---- Types ----

export type SkillTier = 'free' | 'basic' | 'pro' | 'enterprise';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type LicenseType = 'per_use' | 'subscription' | 'perpetual' | 'revenue_share';

export interface SkillListing {
  id: string;
  skillId: string;
  name: string;
  description: string;
  creatorId: string;
  tier: SkillTier;
  licenseType: LicenseType;
  pricePerUse: number;       // SURGE tokens
  subscriptionPrice: number;  // monthly
  perpetualPrice: number;
  revenueSharePercent: number;
  category: string;
  tags: string[];
  rating: number;
  totalUses: number;
  totalRevenue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillUsage {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  referrerId?: string;
  amount: number;
  timestamp: string;
  txHash?: string;
  splits: RevenueSplit;
}

export interface RevenueSplit {
  creatorAmount: number;
  creatorPercent: number;
  platformAmount: number;
  platformPercent: number;
  referrerAmount: number;
  referrerPercent: number;
  totalAmount: number;
}

export interface AgentEarnings {
  agentId: string;
  totalEarned: number;
  totalPaid: number;
  pendingBalance: number;
  skillsOwned: number;
  skillsUsed: number;
  topSkill: string;
  topSkillRevenue: number;
  earningsBySkill: Record<string, number>;
  earningsByMonth: Record<string, number>;
  lastPayout: string | null;
}

export interface Payout {
  id: string;
  agentId: string;
  amount: number;
  status: PayoutStatus;
  method: 'surge_transfer' | 'escrow_release' | 'auto_sweep';
  txHash?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Subscription {
  id: string;
  buyerId: string;
  listingId: string;
  startDate: string;
  endDate: string;
  monthlyPrice: number;
  isActive: boolean;
  autoRenew: boolean;
  paymentHistory: { date: string; amount: number; txHash?: string }[];
}

export interface MarketplaceStats {
  totalListings: number;
  activeListings: number;
  totalRevenue: number;
  totalTransactions: number;
  uniqueCreators: number;
  uniqueBuyers: number;
  avgPricePerUse: number;
  topCategories: { category: string; revenue: number; count: number }[];
  dailyVolume: number;
  monthlyVolume: number;
  platformFees: number;
  timestamp: string;
}

// ---- Default Revenue Splits ----

const DEFAULT_SPLITS = {
  creator: 0.70,
  platform: 0.20,
  referrer: 0.10,
};

const TIER_MULTIPLIER: Record<SkillTier, number> = {
  free: 0,
  basic: 1,
  pro: 2.5,
  enterprise: 5,
};

// ---- Engine ----

export class RevenueSharingEngine {
  private listings: Map<string, SkillListing> = new Map();
  private usages: SkillUsage[] = [];
  private payouts: Payout[] = [];
  private subscriptions: Map<string, Subscription> = new Map();
  private agentBalances: Map<string, number> = new Map(); // agentId -> pending balance
  private platformBalance: number = 0;

  // ── Listing Management ──

  /**
   * List a skill on the marketplace
   */
  listSkill(params: {
    skillId: string;
    name: string;
    description: string;
    creatorId: string;
    tier?: SkillTier;
    licenseType?: LicenseType;
    pricePerUse?: number;
    subscriptionPrice?: number;
    perpetualPrice?: number;
    revenueSharePercent?: number;
    category?: string;
    tags?: string[];
  }): SkillListing {
    const listing: SkillListing = {
      id: uuidv4(),
      skillId: params.skillId,
      name: params.name,
      description: params.description,
      creatorId: params.creatorId,
      tier: params.tier || 'basic',
      licenseType: params.licenseType || 'per_use',
      pricePerUse: params.pricePerUse || 1.0,
      subscriptionPrice: params.subscriptionPrice || 10.0,
      perpetualPrice: params.perpetualPrice || 100.0,
      revenueSharePercent: params.revenueSharePercent || 5,
      category: params.category || 'general',
      tags: params.tags || [],
      rating: 0,
      totalUses: 0,
      totalRevenue: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.listings.set(listing.id, listing);
    logger.info(`[Revenue] Skill listed: ${listing.name} by ${listing.creatorId} at ${listing.pricePerUse} SURGE/use`);
    return listing;
  }

  /**
   * Update a listing
   */
  updateListing(listingId: string, updates: Partial<SkillListing>): SkillListing {
    const listing = this.listings.get(listingId);
    if (!listing) throw new Error(`Listing ${listingId} not found`);

    Object.assign(listing, updates, { updatedAt: new Date().toISOString() });
    logger.info(`[Revenue] Listing updated: ${listing.name}`);
    return listing;
  }

  /**
   * Deactivate a listing
   */
  deactivateListing(listingId: string): void {
    const listing = this.listings.get(listingId);
    if (!listing) throw new Error(`Listing ${listingId} not found`);
    listing.isActive = false;
    listing.updatedAt = new Date().toISOString();
  }

  // ── Usage & Revenue ──

  /**
   * Record a skill usage and calculate revenue split
   */
  recordUsage(params: {
    listingId: string;
    buyerId: string;
    referrerId?: string;
    customAmount?: number;
  }): SkillUsage {
    const listing = this.listings.get(params.listingId);
    if (!listing) throw new Error(`Listing ${params.listingId} not found`);
    if (!listing.isActive) throw new Error(`Listing ${listing.name} is inactive`);

    const amount = params.customAmount || (listing.pricePerUse * TIER_MULTIPLIER[listing.tier]);
    if (amount <= 0 && listing.tier !== 'free') {
      throw new Error('Invalid amount for paid skill');
    }

    // Calculate splits
    const hasReferrer = !!params.referrerId;
    const splits: RevenueSplit = {
      creatorAmount: amount * DEFAULT_SPLITS.creator,
      creatorPercent: DEFAULT_SPLITS.creator * 100,
      platformAmount: amount * (hasReferrer ? DEFAULT_SPLITS.platform : DEFAULT_SPLITS.platform + DEFAULT_SPLITS.referrer),
      platformPercent: (hasReferrer ? DEFAULT_SPLITS.platform : DEFAULT_SPLITS.platform + DEFAULT_SPLITS.referrer) * 100,
      referrerAmount: hasReferrer ? amount * DEFAULT_SPLITS.referrer : 0,
      referrerPercent: hasReferrer ? DEFAULT_SPLITS.referrer * 100 : 0,
      totalAmount: amount,
    };

    const usage: SkillUsage = {
      id: uuidv4(),
      listingId: params.listingId,
      buyerId: params.buyerId,
      sellerId: listing.creatorId,
      referrerId: params.referrerId,
      amount,
      timestamp: new Date().toISOString(),
      splits,
    };

    this.usages.push(usage);

    // Credit balances
    this.creditBalance(listing.creatorId, splits.creatorAmount);
    if (params.referrerId) {
      this.creditBalance(params.referrerId, splits.referrerAmount);
    }
    this.platformBalance += splits.platformAmount;

    // Update listing stats
    listing.totalUses++;
    listing.totalRevenue += amount;
    listing.updatedAt = new Date().toISOString();

    logger.info(
      `[Revenue] Usage recorded: ${listing.name} by ${params.buyerId} — ` +
      `Creator: $${splits.creatorAmount.toFixed(2)}, Platform: $${splits.platformAmount.toFixed(2)}, ` +
      `Referrer: $${splits.referrerAmount.toFixed(2)}`
    );

    return usage;
  }

  // ── Subscriptions ──

  /**
   * Create a subscription
   */
  subscribe(params: {
    buyerId: string;
    listingId: string;
    months?: number;
    autoRenew?: boolean;
  }): Subscription {
    const listing = this.listings.get(params.listingId);
    if (!listing) throw new Error(`Listing ${params.listingId} not found`);

    const months = params.months || 1;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    const subscription: Subscription = {
      id: uuidv4(),
      buyerId: params.buyerId,
      listingId: params.listingId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      monthlyPrice: listing.subscriptionPrice,
      isActive: true,
      autoRenew: params.autoRenew ?? true,
      paymentHistory: [],
    };

    // Process initial payment
    for (let i = 0; i < months; i++) {
      const amount = listing.subscriptionPrice;
      const splits: RevenueSplit = {
        creatorAmount: amount * DEFAULT_SPLITS.creator,
        creatorPercent: DEFAULT_SPLITS.creator * 100,
        platformAmount: amount * DEFAULT_SPLITS.platform,
        platformPercent: DEFAULT_SPLITS.platform * 100,
        referrerAmount: amount * DEFAULT_SPLITS.referrer,
        referrerPercent: DEFAULT_SPLITS.referrer * 100,
        totalAmount: amount,
      };

      this.creditBalance(listing.creatorId, splits.creatorAmount);
      this.platformBalance += splits.platformAmount;

      subscription.paymentHistory.push({
        date: new Date().toISOString(),
        amount,
      });
    }

    this.subscriptions.set(subscription.id, subscription);
    logger.info(`[Revenue] Subscription created: ${params.buyerId} → ${listing.name} for ${months} month(s)`);
    return subscription;
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);
    sub.isActive = false;
    sub.autoRenew = false;
    logger.info(`[Revenue] Subscription ${subscriptionId} cancelled`);
  }

  // ── Payouts ──

  /**
   * Request a payout for an agent
   */
  requestPayout(agentId: string, method: Payout['method'] = 'surge_transfer'): Payout {
    const balance = this.agentBalances.get(agentId) || 0;
    if (balance <= 0) throw new Error(`No pending balance for agent ${agentId}`);

    const payout: Payout = {
      id: uuidv4(),
      agentId,
      amount: balance,
      status: 'pending',
      method,
      createdAt: new Date().toISOString(),
    };

    this.payouts.push(payout);

    // In production, this would initiate a SURGE transfer
    // For now, mark as completed
    payout.status = 'completed';
    payout.completedAt = new Date().toISOString();
    payout.txHash = `0x${uuidv4().replace(/-/g, '')}`;
    this.agentBalances.set(agentId, 0);

    logger.info(`[Revenue] Payout processed: ${agentId} received $${balance.toFixed(2)} via ${method}`);
    return payout;
  }

  // ── Analytics ──

  /**
   * Get earnings for an agent
   */
  getEarnings(agentId: string): AgentEarnings {
    const agentUsages = this.usages.filter(u =>
      u.sellerId === agentId || u.referrerId === agentId
    );

    const earningsBySkill: Record<string, number> = {};
    const earningsByMonth: Record<string, number> = {};

    for (const usage of agentUsages) {
      const listing = this.listings.get(usage.listingId);
      const skillName = listing?.name || 'Unknown';
      const month = usage.timestamp.substring(0, 7);
      const amount = usage.sellerId === agentId
        ? usage.splits.creatorAmount
        : usage.splits.referrerAmount;

      earningsBySkill[skillName] = (earningsBySkill[skillName] || 0) + amount;
      earningsByMonth[month] = (earningsByMonth[month] || 0) + amount;
    }

    const totalEarned = Object.values(earningsBySkill).reduce((s, v) => s + v, 0);
    const totalPaid = this.payouts
      .filter(p => p.agentId === agentId && p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0);

    const skillEntries = Object.entries(earningsBySkill).sort((a, b) => b[1] - a[1]);

    return {
      agentId,
      totalEarned,
      totalPaid,
      pendingBalance: this.agentBalances.get(agentId) || 0,
      skillsOwned: Array.from(this.listings.values()).filter(l => l.creatorId === agentId).length,
      skillsUsed: new Set(agentUsages.map(u => u.listingId)).size,
      topSkill: skillEntries.length > 0 ? skillEntries[0][0] : 'N/A',
      topSkillRevenue: skillEntries.length > 0 ? skillEntries[0][1] : 0,
      earningsBySkill,
      earningsByMonth,
      lastPayout: this.payouts
        .filter(p => p.agentId === agentId && p.status === 'completed')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.completedAt || null,
    };
  }

  /**
   * Get marketplace statistics
   */
  getMarketplaceStats(): MarketplaceStats {
    const listings = Array.from(this.listings.values());
    const activeListings = listings.filter(l => l.isActive);
    const uniqueCreators = new Set(listings.map(l => l.creatorId)).size;
    const uniqueBuyers = new Set(this.usages.map(u => u.buyerId)).size;

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);
    const monthAgo = new Date(now.getTime() - 86400000 * 30);

    const dailyUsages = this.usages.filter(u => new Date(u.timestamp) > dayAgo);
    const monthlyUsages = this.usages.filter(u => new Date(u.timestamp) > monthAgo);

    // Category breakdowns
    const categoryMap: Record<string, { revenue: number; count: number }> = {};
    for (const listing of listings) {
      if (!categoryMap[listing.category]) {
        categoryMap[listing.category] = { revenue: 0, count: 0 };
      }
      categoryMap[listing.category].revenue += listing.totalRevenue;
      categoryMap[listing.category].count++;
    }

    return {
      totalListings: listings.length,
      activeListings: activeListings.length,
      totalRevenue: this.usages.reduce((s, u) => s + u.amount, 0),
      totalTransactions: this.usages.length,
      uniqueCreators,
      uniqueBuyers,
      avgPricePerUse: activeListings.length > 0
        ? activeListings.reduce((s, l) => s + l.pricePerUse, 0) / activeListings.length : 0,
      topCategories: Object.entries(categoryMap)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
      dailyVolume: dailyUsages.reduce((s, u) => s + u.amount, 0),
      monthlyVolume: monthlyUsages.reduce((s, u) => s + u.amount, 0),
      platformFees: this.platformBalance,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all listings, optionally filtered
   */
  getListings(params?: { creatorId?: string; category?: string; tier?: SkillTier; activeOnly?: boolean }): SkillListing[] {
    let listings = Array.from(this.listings.values());
    if (params?.creatorId) listings = listings.filter(l => l.creatorId === params.creatorId);
    if (params?.category) listings = listings.filter(l => l.category === params.category);
    if (params?.tier) listings = listings.filter(l => l.tier === params.tier);
    if (params?.activeOnly !== false) listings = listings.filter(l => l.isActive);
    return listings.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Get payout history
   */
  getPayouts(agentId?: string): Payout[] {
    let payouts = this.payouts;
    if (agentId) payouts = payouts.filter(p => p.agentId === agentId);
    return payouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Run demo scenario
   */
  runDemo(): { listings: SkillListing[]; usages: SkillUsage[]; earnings: AgentEarnings; stats: MarketplaceStats } {
    // Create skill listings
    const l1 = this.listSkill({
      skillId: 'fraud-detection-v2',
      name: 'GNN Fraud Detection',
      description: 'Graph neural network-based fraud detection for on-chain transactions',
      creatorId: 'agent-alpha',
      tier: 'pro',
      pricePerUse: 5.0,
      category: 'security',
      tags: ['fraud', 'gnn', 'security'],
    });

    const l2 = this.listSkill({
      skillId: 'yield-optimizer',
      name: 'DeFi Yield Optimizer',
      description: 'Cross-protocol yield optimization with auto-compounding',
      creatorId: 'agent-alpha',
      tier: 'enterprise',
      pricePerUse: 10.0,
      category: 'defi',
      tags: ['yield', 'defi', 'optimization'],
    });

    const l3 = this.listSkill({
      skillId: 'compliance-check',
      name: 'Regulatory Compliance Scanner',
      description: 'MiCA/SEC compliance verification for token launches',
      creatorId: 'agent-beta',
      tier: 'pro',
      pricePerUse: 8.0,
      category: 'compliance',
      tags: ['compliance', 'regulation', 'tokens'],
    });

    // Simulate usages
    const usages: SkillUsage[] = [];
    const agents = ['agent-gamma', 'agent-delta', 'agent-epsilon', 'agent-zeta'];

    for (const buyer of agents) {
      usages.push(this.recordUsage({ listingId: l1.id, buyerId: buyer, referrerId: 'agent-beta' }));
      usages.push(this.recordUsage({ listingId: l2.id, buyerId: buyer }));
    }
    usages.push(this.recordUsage({ listingId: l3.id, buyerId: 'agent-alpha', referrerId: 'agent-alpha' }));

    return {
      listings: [l1, l2, l3],
      usages,
      earnings: this.getEarnings('agent-alpha'),
      stats: this.getMarketplaceStats(),
    };
  }

  // ── Internals ──

  private creditBalance(agentId: string, amount: number): void {
    const current = this.agentBalances.get(agentId) || 0;
    this.agentBalances.set(agentId, current + amount);
  }
}

export const revenueSharingEngine = new RevenueSharingEngine();
