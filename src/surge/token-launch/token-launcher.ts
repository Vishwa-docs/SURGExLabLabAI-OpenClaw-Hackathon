// ============================================================
// src/surge/token-launch/token-launcher.ts — Token Launch via SURGE API
// ============================================================
// Launches ERC-20 tokens on Base via the real SURGE API.
// No direct blockchain interaction — SURGE handles deployment.
//
// Endpoint: POST /openclaw/launch
// Auth: X-API-Key header
// Amounts: human-readable strings only (never wei)
// ============================================================

import fetch from 'node-fetch';
import { surgeWallet } from '../wallet/wallet-manager';
import { agentRuntime } from '../../agent/agent-runtime';
import { config } from '../../utils/config';
import logger from '../../utils/logger';
import { ActionReceipt } from '../../agent/types';

export interface TokenLaunchParams {
  name: string;
  ticker: string;
  description: string;
  /** ETH amount to seed liquidity (human-readable, e.g. "0.01") */
  ethAmount: string;
  logoUrl?: string;
  bannerUrl?: string;
  fullDescription?: string;
  category?: string;
  /** Social links */
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
}

export interface TokenLaunchResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  metadataUid?: string;
  tokenInfo?: {
    name: string;
    ticker: string;
  };
  error?: string;
}

export interface LaunchInfo {
  launchFee: string;
  minimumEth: string;
  chains: Array<{ chainId: string; name: string; fee: string }>;
  categories: string[];
}

export class TokenLauncher {
  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': config.surge.apiKey,
    };
  }

  private get baseUrl(): string {
    return config.surge.apiUrl;
  }

  /**
   * Get live launch configuration (fees, chains, categories).
   * Should always be called before launching to get current values.
   */
  async getLaunchInfo(): Promise<LaunchInfo | null> {
    if (!config.surge.apiKey) return null;

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/launch-info`, {
        headers: this.headers,
      });

      if (!response.ok) return null;
      return (await response.json()) as LaunchInfo;
    } catch {
      return null;
    }
  }

  /**
   * Launch a new ERC-20 token through the agent runtime (with policy checks).
   * This is gated as a "token_launch" action which typically requires approval.
   */
  async launchToken(params: TokenLaunchParams): Promise<TokenLaunchResult> {
    const result = await agentRuntime.executeAction(
      'token_launch',
      `Launch token: ${params.name} (${params.ticker}) with ${params.ethAmount} ETH`,
      {
        name: params.name,
        ticker: params.ticker,
        ethAmount: params.ethAmount,
        description: params.description,
      },
      async (): Promise<ActionReceipt> => {
        return await this._launchViaSurgeApi(params);
      }
    );

    if (result.status === 'rejected') {
      return {
        success: false,
        error: result.policyResult?.reason || 'Token launch blocked by policy',
      };
    }

    return {
      success: result.status === 'executed',
      txHash: result.receipt?.txHash,
      explorerUrl: result.receipt?.explorerUrl,
      metadataUid: result.receipt?.metadata?.metadataUid as string,
      tokenInfo: result.receipt?.metadata?.tokenInfo as { name: string; ticker: string },
      error: result.status === 'failed' ? (result.receipt?.metadata?.error as string) : undefined,
    };
  }

  /**
   * Launch token via SURGE API.
   */
  private async _launchViaSurgeApi(params: TokenLaunchParams): Promise<ActionReceipt> {
    const walletId = surgeWallet.getWalletId();

    if (!config.surge.apiKey || walletId === 'dry-run-wallet') {
      logger.warn('[TokenLaunch] Dry-run mode — no SURGE API key');
      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'token_launch',
        description: `[DRY-RUN] Would launch ${params.name} (${params.ticker})`,
        status: 'success',
        timestamp: Date.now(),
        metadata: { dryRun: true, name: params.name, ticker: params.ticker },
      };
    }

    try {
      const body: Record<string, unknown> = {
        name: params.name,
        ticker: params.ticker,
        description: params.description,
        chainId: config.surge.chainId,
        walletId,
        ethAmount: params.ethAmount,
      };

      // Optional fields
      if (params.logoUrl) body.logoUrl = params.logoUrl;
      if (params.bannerUrl) body.bannerUrl = params.bannerUrl;
      if (params.fullDescription) body.fullDescription = params.fullDescription;
      if (params.category) body.category = params.category;
      if (params.websiteUrl) body.websiteLink = params.websiteUrl;
      if (params.twitterUrl) body.xLink = params.twitterUrl;
      if (params.telegramUrl) body.telegramLink = params.telegramUrl;
      if (params.discordUrl) body.discordLink = params.discordUrl;

      logger.info(`[TokenLaunch] Launching ${params.name} (${params.ticker}) via SURGE API...`);

      const response = await fetch(`${this.baseUrl}/openclaw/launch`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SURGE launch failed: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as {
        txHash: string;
        metadataUid: string;
        explorerUrl: string;
        tokenName: string;
        tokenTicker: string;
        summary: string;
      };

      logger.info(`[TokenLaunch] Token launched: ${data.tokenName} (tx: ${data.txHash})`);
      logger.info(`[TokenLaunch] Explorer: ${data.explorerUrl}`);

      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'token_launch',
        description: `Launched ${data.tokenName} (${data.tokenTicker}) via SURGE`,
        status: 'success',
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
        timestamp: Date.now(),
        metadata: {
          metadataUid: data.metadataUid,
          tokenInfo: {
            name: data.tokenName,
            ticker: data.tokenTicker,
          },
          summary: data.summary,
        },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[TokenLaunch] Launch failed: ${errMsg}`);
      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'token_launch',
        description: `Failed to launch ${params.name}`,
        status: 'failure',
        timestamp: Date.now(),
        metadata: { error: errMsg },
      };
    }
  }

  /**
   * Check token phase/status (bonding_curve | migrated_to_dex | not_launched).
   */
  async getTokenStatus(tokenAddress: string): Promise<{ phase: string; details: Record<string, unknown> } | null> {
    if (!config.surge.apiKey) return null;

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/token-status`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          chainId: config.surge.chainId,
          tokenAddress,
        }),
      });

      if (!response.ok) return null;
      return (await response.json()) as { phase: string; details: Record<string, unknown> };
    } catch {
      return null;
    }
  }

  /**
   * Buy tokens via SURGE (auto-routes bonding curve or DEX).
   */
  async buyToken(tokenAddress: string, ethAmount: string): Promise<{ txHash?: string; error?: string }> {
    const walletId = surgeWallet.getWalletId();
    if (!config.surge.apiKey || walletId === 'dry-run-wallet') {
      return { error: 'No SURGE API key' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/buy`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          chainId: config.surge.chainId,
          walletId,
          tokenAddress,
          ethAmount,
          amountOutMin: '0',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { error: `Buy failed: ${response.status} ${errText}` };
      }

      const data = (await response.json()) as { txHash: string };
      return { txHash: data.txHash };
    } catch (err) {
      return { error: String(err) };
    }
  }

  /**
   * Sell tokens via SURGE (auto-routes bonding curve or DEX).
   */
  async sellToken(tokenAddress: string, tokenAmount: string): Promise<{ txHash?: string; error?: string }> {
    const walletId = surgeWallet.getWalletId();
    if (!config.surge.apiKey || walletId === 'dry-run-wallet') {
      return { error: 'No SURGE API key' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/sell`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          chainId: config.surge.chainId,
          walletId,
          tokenAddress,
          tokenAmount,
          amountOutMin: '0',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { error: `Sell failed: ${response.status} ${errText}` };
      }

      const data = (await response.json()) as { txHash: string };
      return { txHash: data.txHash };
    } catch (err) {
      return { error: String(err) };
    }
  }
}

export const tokenLauncher = new TokenLauncher();
export default tokenLauncher;
