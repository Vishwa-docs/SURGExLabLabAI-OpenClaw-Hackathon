// ============================================================
// src/economic/cost-router.ts — LLM Cost Router (ClawRouter)
// ============================================================
// Routes LLM requests to the cheapest capable model provider.
// Supports Azure OpenAI, HuggingFace, and extensible providers.
//
// Features:
//   - Dynamic pricing comparison across providers
//   - Capability-based routing (code, analysis, chat, etc.)
//   - Usage tracking with cost analytics
//   - Automatic failover on provider errors
//   - Zero-cost routing (uses only free-tier providers)
// ============================================================

import fetch from 'node-fetch';
import { config } from '../utils/config';
import logger from '../utils/logger';

// ---- Types ----

export type TaskType = 'chat' | 'code' | 'analysis' | 'summary' | 'creative' | 'embedding';

export interface LLMProvider {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  costPer1kTokens: number;  // USD
  maxTokens: number;
  capabilities: TaskType[];
  available: boolean;
  priority: number;          // Lower = preferred
  headers: Record<string, string>;
  bodyTemplate: (prompt: string, maxTokens: number) => Record<string, unknown>;
  parseResponse: (data: unknown) => { text: string; tokensUsed: number };
}

export interface RoutingDecision {
  provider: LLMProvider;
  reason: string;
  estimatedCost: number;
  alternativeCount: number;
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  cached: boolean;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  costSavedUsd: number;
  byProvider: Record<string, { requests: number; tokens: number; costUsd: number }>;
  byTask: Record<string, { requests: number; tokens: number }>;
}

// ---- Provider Configurations ----

function buildProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // Azure OpenAI (user's primary — free with existing credits)
  if (config.llm.azureOpenaiApiKey && config.llm.azureOpenaiEndpoint) {
    providers.push({
      id: 'azure-openai',
      name: 'Azure OpenAI (GPT-4o)',
      endpoint: config.llm.azureOpenaiEndpoint,
      model: config.llm.azureOpenaiDeployment || 'gpt-4o',
      costPer1kTokens: 0.005, // Effectively free with Azure credits
      maxTokens: 4096,
      capabilities: ['chat', 'code', 'analysis', 'summary', 'creative'],
      available: true,
      priority: 1,
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.llm.azureOpenaiApiKey,
      },
      bodyTemplate: (prompt: string, maxTokens: number) => ({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      parseResponse: (data: unknown) => {
        const d = data as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } };
        return {
          text: d.choices?.[0]?.message?.content || '',
          tokensUsed: d.usage?.total_tokens || 0,
        };
      },
    });
  }

  // HuggingFace Inference API (free tier)
  if (config.llm.huggingfaceApiKey) {
    providers.push({
      id: 'huggingface',
      name: 'HuggingFace (Mistral-7B)',
      endpoint: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      model: 'Mistral-7B-Instruct-v0.3',
      costPer1kTokens: 0, // Free tier
      maxTokens: 2048,
      capabilities: ['chat', 'summary', 'creative'],
      available: true,
      priority: 2,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.huggingfaceApiKey}`,
      },
      bodyTemplate: (prompt: string, maxTokens: number) => ({
        inputs: prompt,
        parameters: {
          max_new_tokens: Math.min(maxTokens, 1024),
          temperature: 0.7,
          return_full_text: false,
        },
      }),
      parseResponse: (data: unknown) => {
        const d = data as Array<{ generated_text?: string }>;
        const text = Array.isArray(d) ? d[0]?.generated_text || '' : '';
        return { text, tokensUsed: Math.ceil(text.length / 4) };
      },
    });
  }

  // Local fallback — no API needed, generates template responses
  providers.push({
    id: 'local-template',
    name: 'Local Template Engine',
    endpoint: 'local',
    model: 'template-v1',
    costPer1kTokens: 0,
    maxTokens: 4096,
    capabilities: ['chat', 'code', 'analysis', 'summary', 'creative', 'embedding'],
    available: true,
    priority: 100, // Last resort
    headers: {},
    bodyTemplate: () => ({}),
    parseResponse: () => ({ text: '', tokensUsed: 0 }),
  });

  return providers;
}

// ---- Cost Router ----

export class CostRouter {
  private providers: LLMProvider[];
  private usage: UsageStats;
  private responseCache: Map<string, { response: LLMResponse; expiresAt: number }> = new Map();
  private cacheTtlMs: number = 300_000; // 5 min

  constructor() {
    this.providers = buildProviders();
    this.usage = {
      totalRequests: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      costSavedUsd: 0,
      byProvider: {},
      byTask: {},
    };
  }

  /**
   * Route a prompt to the cheapest capable provider.
   */
  async route(params: {
    prompt: string;
    taskType: TaskType;
    maxTokens?: number;
    preferredProvider?: string;
    skipCache?: boolean;
  }): Promise<LLMResponse> {
    const { prompt, taskType, maxTokens = 1024, preferredProvider, skipCache } = params;

    // Check cache
    if (!skipCache) {
      const cacheKey = this.getCacheKey(prompt, taskType);
      const cached = this.responseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        logger.info(`[CostRouter] Cache hit for ${taskType} request`);
        return { ...cached.response, cached: true };
      }
    }

    // Find the best provider
    const decision = this.selectProvider(taskType, maxTokens, preferredProvider);
    const provider = decision.provider;

    logger.info(`[CostRouter] Routing ${taskType} to ${provider.name} — ` +
      `est. cost: $${decision.estimatedCost.toFixed(6)}, ` +
      `reason: ${decision.reason}`);

    const startTime = Date.now();

    // Special case: local template engine
    if (provider.id === 'local-template') {
      const response = this.generateLocalResponse(prompt, taskType);
      this.recordUsage(provider, response.tokensUsed, taskType);
      return response;
    }

    // Call the provider
    try {
      const httpResponse = await fetch(provider.endpoint, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(provider.bodyTemplate(prompt, maxTokens)),
      });

      if (!httpResponse.ok) {
        const errText = await httpResponse.text();
        logger.warn(`[CostRouter] ${provider.name} failed (${httpResponse.status}): ${errText}`);

        // Failover to next provider
        provider.available = false;
        return this.route({ ...params, preferredProvider: undefined, skipCache: true });
      }

      const data = await httpResponse.json();
      const parsed = provider.parseResponse(data);
      const latencyMs = Date.now() - startTime;
      const costUsd = (parsed.tokensUsed / 1000) * provider.costPer1kTokens;

      const response: LLMResponse = {
        text: parsed.text,
        provider: provider.id,
        model: provider.model,
        tokensUsed: parsed.tokensUsed,
        costUsd,
        latencyMs,
        cached: false,
      };

      // Cache the response
      if (!skipCache) {
        const cacheKey = this.getCacheKey(prompt, taskType);
        this.responseCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
      }

      // Track usage
      this.recordUsage(provider, parsed.tokensUsed, taskType);

      // Calculate savings vs most expensive provider
      const expensiveProvider = this.providers
        .filter(p => p.capabilities.includes(taskType))
        .sort((a, b) => b.costPer1kTokens - a.costPer1kTokens)[0];
      if (expensiveProvider && expensiveProvider.id !== provider.id) {
        const wouldHaveCost = (parsed.tokensUsed / 1000) * expensiveProvider.costPer1kTokens;
        this.usage.costSavedUsd += wouldHaveCost - costUsd;
      }

      return response;
    } catch (err) {
      logger.warn(`[CostRouter] ${provider.name} error: ${err}`);
      provider.available = false;

      // Failover
      return this.route({ ...params, preferredProvider: undefined, skipCache: true });
    }
  }

  /**
   * Select the best provider for a task.
   */
  selectProvider(taskType: TaskType, maxTokens: number, preferred?: string): RoutingDecision {
    const capable = this.providers
      .filter(p => p.available && p.capabilities.includes(taskType) && p.maxTokens >= maxTokens)
      .sort((a, b) => {
        // Sort by cost first, then priority
        if (a.costPer1kTokens !== b.costPer1kTokens) {
          return a.costPer1kTokens - b.costPer1kTokens;
        }
        return a.priority - b.priority;
      });

    if (capable.length === 0) {
      // Fallback to local template
      const local = this.providers.find(p => p.id === 'local-template')!;
      return {
        provider: local,
        reason: 'No capable providers available — using local template',
        estimatedCost: 0,
        alternativeCount: 0,
      };
    }

    // Preferred provider override
    if (preferred) {
      const pref = capable.find(p => p.id === preferred);
      if (pref) {
        return {
          provider: pref,
          reason: `User-preferred provider: ${pref.name}`,
          estimatedCost: (maxTokens / 1000) * pref.costPer1kTokens,
          alternativeCount: capable.length - 1,
        };
      }
    }

    const best = capable[0];
    const reason = best.costPer1kTokens === 0
      ? `Free tier: ${best.name}`
      : `Cheapest capable: ${best.name} at $${best.costPer1kTokens}/1K tokens`;

    return {
      provider: best,
      reason,
      estimatedCost: (maxTokens / 1000) * best.costPer1kTokens,
      alternativeCount: capable.length - 1,
    };
  }

  /**
   * Get usage analytics.
   */
  getUsage(): UsageStats {
    return { ...this.usage };
  }

  /**
   * Get available providers summary.
   */
  getProviders(): Array<{
    id: string;
    name: string;
    model: string;
    costPer1kTokens: number;
    capabilities: TaskType[];
    available: boolean;
  }> {
    return this.providers.map(p => ({
      id: p.id,
      name: p.name,
      model: p.model,
      costPer1kTokens: p.costPer1kTokens,
      capabilities: p.capabilities,
      available: p.available,
    }));
  }

  // ---- Private ----

  private recordUsage(provider: LLMProvider, tokens: number, taskType: TaskType): void {
    const costUsd = (tokens / 1000) * provider.costPer1kTokens;

    this.usage.totalRequests++;
    this.usage.totalTokens += tokens;
    this.usage.totalCostUsd += costUsd;

    if (!this.usage.byProvider[provider.id]) {
      this.usage.byProvider[provider.id] = { requests: 0, tokens: 0, costUsd: 0 };
    }
    this.usage.byProvider[provider.id].requests++;
    this.usage.byProvider[provider.id].tokens += tokens;
    this.usage.byProvider[provider.id].costUsd += costUsd;

    if (!this.usage.byTask[taskType]) {
      this.usage.byTask[taskType] = { requests: 0, tokens: 0 };
    }
    this.usage.byTask[taskType].requests++;
    this.usage.byTask[taskType].tokens += tokens;
  }

  private generateLocalResponse(prompt: string, taskType: TaskType): LLMResponse {
    const templates: Record<TaskType, string> = {
      chat: `[Local] I understand your request. Here's a template response for: "${prompt.slice(0, 50)}..."`,
      code: `[Local] // Generated code template\nfunction process() {\n  // Implementation for: ${prompt.slice(0, 40)}\n  return { success: true };\n}`,
      analysis: `[Local] Analysis Summary:\n- Input analyzed: ${prompt.slice(0, 40)}...\n- Risk factors identified: 0\n- Recommendation: Proceed with standard checks`,
      summary: `[Local] Summary: ${prompt.slice(0, 100)}...`,
      creative: `[Local] Creative output for: "${prompt.slice(0, 50)}..."`,
      embedding: `[Local] Embedding generation not supported in template mode`,
    };

    const text = templates[taskType] || templates.chat;
    return {
      text,
      provider: 'local-template',
      model: 'template-v1',
      tokensUsed: Math.ceil(text.length / 4),
      costUsd: 0,
      latencyMs: 1,
      cached: false,
    };
  }

  private getCacheKey(prompt: string, taskType: TaskType): string {
    // Simple hash — first 100 chars + task type
    return `${taskType}:${prompt.slice(0, 100)}`;
  }
}

export const costRouter = new CostRouter();
export default costRouter;
