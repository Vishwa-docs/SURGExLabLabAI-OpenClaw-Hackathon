// ============================================================
// src/economic/procurement-engine.ts — Agent Procurement Workflow
// ============================================================
// AI-powered procurement: vendor discovery, quote comparison,
// approval gating, escrow settlement, invoice reconciliation.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Types ----

export interface ProcurementRequest {
  id: string;
  requestorId: string;
  title: string;
  description: string;
  category: 'compute' | 'api_credits' | 'data' | 'infrastructure' | 'services' | 'tokens' | 'other';
  budgetUsd: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'sourcing' | 'quoted' | 'approved' | 'in_escrow' | 'fulfilled' | 'disputed' | 'cancelled';
  vendors: VendorQuote[];
  selectedVendor?: string;
  approvals: Approval[];
  escrowId?: string;
  invoice?: Invoice;
  compliancePacket?: CompliancePacket;
  createdAt: number;
  updatedAt: number;
}

export interface VendorQuote {
  vendorId: string;
  vendorName: string;
  priceUsd: number;
  deliveryTimeMs: number;
  qualityScore: number;           // 0-100
  terms: string;
  submittedAt: number;
}

export interface Approval {
  approverId: string;
  approved: boolean;
  reason: string;
  timestamp: number;
}

export interface Invoice {
  invoiceId: string;
  vendorId: string;
  amountUsd: number;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  status: 'pending' | 'paid' | 'disputed';
  issuedAt: number;
  paidAt?: number;
}

export interface CompliancePacket {
  requestId: string;
  approvalChain: Approval[];
  vendorVerified: boolean;
  budgetCompliant: boolean;
  riskAssessmentPassed: boolean;
  auditHash: string;
  generatedAt: number;
}

// ---- Procurement Engine ----

export class ProcurementEngine {
  private requests: Map<string, ProcurementRequest> = new Map();

  // Simulated vendor catalog
  private readonly VENDOR_CATALOG: Array<{ id: string; name: string; categories: string[]; baseQuality: number }> = [
    { id: 'v-azure', name: 'Azure OpenAI', categories: ['compute', 'api_credits'], baseQuality: 90 },
    { id: 'v-hf', name: 'HuggingFace Inference', categories: ['compute', 'api_credits'], baseQuality: 75 },
    { id: 'v-aws', name: 'AWS Bedrock', categories: ['compute', 'infrastructure'], baseQuality: 88 },
    { id: 'v-pinecone', name: 'Pinecone', categories: ['data', 'infrastructure'], baseQuality: 82 },
    { id: 'v-surge', name: 'SURGE Platform', categories: ['tokens', 'services'], baseQuality: 85 },
    { id: 'v-chainlink', name: 'Chainlink Oracles', categories: ['data', 'services'], baseQuality: 92 },
  ];

  // ---- Create Request ----

  createRequest(params: {
    requestorId: string;
    title: string;
    description: string;
    category: ProcurementRequest['category'];
    budgetUsd: number;
    priority?: ProcurementRequest['priority'];
  }): ProcurementRequest {
    const request: ProcurementRequest = {
      id: uuidv4(),
      requestorId: params.requestorId,
      title: params.title,
      description: params.description,
      category: params.category,
      budgetUsd: params.budgetUsd,
      priority: params.priority || 'medium',
      status: 'draft',
      vendors: [],
      approvals: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.requests.set(request.id, request);
    logger.info(`[Procurement] Request created: "${params.title}" ($${params.budgetUsd})`);
    return request;
  }

  // ---- Vendor Discovery & Quoting ----

  discoverVendors(requestId: string): VendorQuote[] {
    const request = this.requests.get(requestId);
    if (!request) return [];

    const matchingVendors = this.VENDOR_CATALOG.filter(v =>
      v.categories.includes(request.category) || v.categories.includes('services')
    );

    const quotes: VendorQuote[] = matchingVendors.map(vendor => {
      const priceVariance = 0.7 + Math.random() * 0.6; // 70-130% of budget
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        priceUsd: Math.round(request.budgetUsd * priceVariance * 100) / 100,
        deliveryTimeMs: Math.round((1 + Math.random() * 6) * 3_600_000), // 1-7 hours
        qualityScore: Math.round(vendor.baseQuality + (Math.random() * 10 - 5)),
        terms: `Standard ${vendor.name} service agreement. 30-day payment terms.`,
        submittedAt: Date.now(),
      };
    });

    request.vendors = quotes;
    request.status = 'quoted';
    request.updatedAt = Date.now();

    logger.info(`[Procurement] ${quotes.length} vendors quoted for "${request.title}"`);
    return quotes;
  }

  // ---- AI-Powered Vendor Selection ----

  selectBestVendor(requestId: string): VendorQuote | null {
    const request = this.requests.get(requestId);
    if (!request || request.vendors.length === 0) return null;

    // Score: 40% price, 40% quality, 20% speed
    const scored = request.vendors.map(v => {
      const priceScore = 100 - ((v.priceUsd / request.budgetUsd) * 50); // Lower = better
      const qualityScore = v.qualityScore;
      const speedScore = 100 - Math.min(100, (v.deliveryTimeMs / 86_400_000) * 100);

      return {
        ...v,
        totalScore: priceScore * 0.4 + qualityScore * 0.4 + speedScore * 0.2,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const best = scored[0];

    request.selectedVendor = best.vendorId;
    request.updatedAt = Date.now();

    logger.info(`[Procurement] Selected vendor: ${best.vendorName} ($${best.priceUsd})`);
    return best;
  }

  // ---- Approval ----

  approveRequest(requestId: string, approverId: string, approved: boolean, reason: string): boolean {
    const request = this.requests.get(requestId);
    if (!request) return false;

    request.approvals.push({
      approverId,
      approved,
      reason,
      timestamp: Date.now(),
    });

    // Auto-advance status if enough approvals
    const approvedCount = request.approvals.filter(a => a.approved).length;
    const requiredApprovals = request.priority === 'critical' ? 3 : request.priority === 'high' ? 2 : 1;

    if (approved && approvedCount >= requiredApprovals) {
      request.status = 'approved';
    } else if (!approved) {
      request.status = 'cancelled';
    }

    request.updatedAt = Date.now();
    logger.info(`[Procurement] ${approverId} ${approved ? 'approved' : 'rejected'} "${request.title}"`);
    return true;
  }

  // ---- Settlement ----

  settleRequest(requestId: string, escrowId: string): Invoice | null {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'approved' || !request.selectedVendor) return null;

    const selectedQuote = request.vendors.find(v => v.vendorId === request.selectedVendor);
    if (!selectedQuote) return null;

    request.escrowId = escrowId;
    request.status = 'in_escrow';

    const invoice: Invoice = {
      invoiceId: uuidv4(),
      vendorId: selectedQuote.vendorId,
      amountUsd: selectedQuote.priceUsd,
      items: [{
        description: request.title,
        quantity: 1,
        unitPrice: selectedQuote.priceUsd,
      }],
      status: 'pending',
      issuedAt: Date.now(),
    };

    request.invoice = invoice;
    request.updatedAt = Date.now();

    logger.info(`[Procurement] Invoice generated: $${invoice.amountUsd} for ${selectedQuote.vendorName}`);
    return invoice;
  }

  fulfillRequest(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'in_escrow') return false;

    request.status = 'fulfilled';
    if (request.invoice) request.invoice.status = 'paid';
    if (request.invoice) request.invoice.paidAt = Date.now();
    request.updatedAt = Date.now();

    // Generate compliance packet
    request.compliancePacket = this.generateCompliancePacket(requestId);

    logger.info(`[Procurement] Request fulfilled: "${request.title}"`);
    return true;
  }

  // ---- Compliance ----

  private generateCompliancePacket(requestId: string): CompliancePacket {
    const request = this.requests.get(requestId)!;
    const selectedQuote = request.vendors.find(v => v.vendorId === request.selectedVendor);

    return {
      requestId,
      approvalChain: request.approvals,
      vendorVerified: !!selectedQuote && selectedQuote.qualityScore > 50,
      budgetCompliant: selectedQuote ? selectedQuote.priceUsd <= request.budgetUsd * 1.1 : false,
      riskAssessmentPassed: true,
      auditHash: require('crypto').createHash('sha256')
        .update(JSON.stringify(request))
        .digest('hex'),
      generatedAt: Date.now(),
    };
  }

  // ---- Query ----

  getRequest(id: string): ProcurementRequest | undefined {
    return this.requests.get(id);
  }

  listRequests(status?: ProcurementRequest['status']): ProcurementRequest[] {
    const all = Array.from(this.requests.values());
    if (status) return all.filter(r => r.status === status);
    return all;
  }

  getStats(): {
    totalRequests: number;
    byStatus: Record<string, number>;
    totalSpend: number;
    avgQuotesPerRequest: number;
  } {
    const requests = Array.from(this.requests.values());
    const byStatus: Record<string, number> = {};
    let totalSpend = 0;
    let totalQuotes = 0;

    for (const r of requests) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      totalQuotes += r.vendors.length;
      if (r.invoice?.status === 'paid') {
        totalSpend += r.invoice.amountUsd;
      }
    }

    return {
      totalRequests: requests.length,
      byStatus,
      totalSpend: Math.round(totalSpend * 100) / 100,
      avgQuotesPerRequest: requests.length > 0 ? Math.round(totalQuotes / requests.length) : 0,
    };
  }

  // ---- Demo ----

  runDemoProcurement(): ProcurementRequest {
    const req = this.createRequest({
      requestorId: 'ridhwan-agent',
      title: 'GPU Compute for GNN Risk Model',
      description: 'Procure 100 GPU-hours for training graph neural network fraud detection model',
      category: 'compute',
      budgetUsd: 250,
      priority: 'high',
    });

    this.discoverVendors(req.id);
    this.selectBestVendor(req.id);
    this.approveRequest(req.id, 'governance-admin', true, 'Within budget, critical for Week 3');
    this.approveRequest(req.id, 'risk-engine', true, 'Low risk procurement');
    this.settleRequest(req.id, `escrow-${uuidv4().slice(0, 8)}`);
    this.fulfillRequest(req.id);

    return this.requests.get(req.id)!;
  }
}

export const procurementEngine = new ProcurementEngine();
export default procurementEngine;
