// ============================================================
// src/surge/transfers/transfer-manager.ts — SURGE Transfers
// ============================================================
// Handles native ETH/BNB and ERC-20 token transfers via the
// real SURGE API. No direct blockchain interaction — SURGE
// manages wallets and signing server-side.
//
// Endpoints:
//   POST /openclaw/transfer/native-evm  — ETH/BNB
//   POST /openclaw/transfer/erc20       — ERC-20 tokens
// ============================================================

import fetch from 'node-fetch';
import { surgeWallet } from '../wallet/wallet-manager';
import { agentRuntime } from '../../agent/agent-runtime';
import { budgetTracker } from '../../policy-engine/budget-tracker';
import { config } from '../../utils/config';
import logger from '../../utils/logger';
import { ActionReceipt } from '../../agent/types';

export interface TransferParams {
  to: string;
  /** Human-readable amount string (e.g. "0.01") — NEVER wei/lamports */
  amount: string;
  tokenAddress?: string; // If undefined, transfer native ETH
  amountUsd?: number;    // For budget tracking
}

export interface TransferResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

export class TransferManager {
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
   * Execute a native ETH transfer through the agent runtime (with policy checks).
   */
  async transferETH(params: TransferParams): Promise<TransferResult> {
    const result = await agentRuntime.executeAction(
      'transfer',
      `Transfer ${params.amount} ETH to ${params.to}`,
      {
        to: params.to,
        amount: params.amount,
        amountUsd: params.amountUsd || 0,
        type: 'ETH',
      },
      async (): Promise<ActionReceipt> => {
        return await this._executeNativeTransfer(params);
      }
    );

    if (result.status === 'rejected') {
      return {
        success: false,
        error: result.policyResult?.reason || 'Blocked by policy',
      };
    }

    if (params.amountUsd && params.amountUsd > 0) {
      budgetTracker.recordSpend(
        config.agent.id,
        result.id,
        params.amountUsd,
        'transfer'
      );
    }

    return {
      success: result.status === 'executed',
      txHash: result.receipt?.txHash,
      explorerUrl: result.receipt?.explorerUrl,
      error: result.status === 'failed' ? (result.receipt?.metadata?.error as string) : undefined,
    };
  }

  /**
   * Execute an ERC-20 token transfer through the agent runtime.
   */
  async transferToken(params: TransferParams): Promise<TransferResult> {
    if (!params.tokenAddress) {
      return { success: false, error: 'Token address required for ERC-20 transfer' };
    }

    const result = await agentRuntime.executeAction(
      'transfer',
      `Transfer ${params.amount} tokens (${params.tokenAddress}) to ${params.to}`,
      {
        to: params.to,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        amountUsd: params.amountUsd || 0,
        type: 'ERC20',
      },
      async (): Promise<ActionReceipt> => {
        return await this._executeTokenTransfer(params);
      }
    );

    if (result.status === 'rejected') {
      return {
        success: false,
        error: result.policyResult?.reason || 'Blocked by policy',
      };
    }

    if (params.amountUsd && params.amountUsd > 0) {
      budgetTracker.recordSpend(config.agent.id, result.id, params.amountUsd, 'transfer');
    }

    return {
      success: result.status === 'executed',
      txHash: result.receipt?.txHash,
      explorerUrl: result.receipt?.explorerUrl,
    };
  }

  /**
   * Internal: execute native ETH transfer via SURGE API.
   */
  private async _executeNativeTransfer(params: TransferParams): Promise<ActionReceipt> {
    const walletId = surgeWallet.getWalletId();

    if (!config.surge.apiKey || walletId === 'dry-run-wallet') {
      logger.warn('[Transfer] Dry-run mode — no SURGE API key');
      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'transfer',
        description: `[DRY-RUN] Would transfer ${params.amount} ETH to ${params.to}`,
        status: 'success',
        timestamp: Date.now(),
        metadata: { dryRun: true, to: params.to, amount: params.amount },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/transfer/native-evm`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          chainId: config.surge.chainId,
          walletId,
          toAddress: params.to,
          nativeAmount: params.amount, // Human-readable string
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SURGE transfer failed: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as {
        txHash: string;
        explorerUrl: string;
        summary: string;
      };

      logger.info(`[Transfer] ETH transfer successful: ${data.txHash}`);

      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'transfer',
        description: `Transferred ${params.amount} ETH to ${params.to}`,
        status: 'success',
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
        timestamp: Date.now(),
        metadata: { to: params.to, amount: params.amount, summary: data.summary },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[Transfer] Native transfer failed: ${errMsg}`);
      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'transfer',
        description: `Failed ETH transfer to ${params.to}`,
        status: 'failure',
        timestamp: Date.now(),
        metadata: { error: errMsg },
      };
    }
  }

  /**
   * Internal: execute ERC-20 transfer via SURGE API.
   */
  private async _executeTokenTransfer(params: TransferParams): Promise<ActionReceipt> {
    const walletId = surgeWallet.getWalletId();

    if (!config.surge.apiKey || walletId === 'dry-run-wallet') {
      logger.warn('[Transfer] Dry-run mode — no SURGE API key');
      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'transfer',
        description: `[DRY-RUN] Would transfer ${params.amount} tokens to ${params.to}`,
        status: 'success',
        timestamp: Date.now(),
        metadata: { dryRun: true, to: params.to, amount: params.amount, tokenAddress: params.tokenAddress },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/transfer/erc20`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          chainId: config.surge.chainId,
          walletId,
          tokenAddress: params.tokenAddress,
          toAddress: params.to,
          tokenAmount: params.amount, // Human-readable string
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SURGE ERC-20 transfer failed: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as {
        txHash: string;
        explorerUrl: string;
        summary: string;
      };

      logger.info(`[Transfer] ERC-20 transfer successful: ${data.txHash}`);

      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'transfer',
        description: `Transferred ${params.amount} tokens to ${params.to}`,
        status: 'success',
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
        timestamp: Date.now(),
        metadata: { to: params.to, amount: params.amount, tokenAddress: params.tokenAddress },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[Transfer] Token transfer failed: ${errMsg}`);
      return {
        actionId: '',
        agentId: config.agent.id,
        actionClass: 'transfer',
        description: `Failed token transfer to ${params.to}`,
        status: 'failure',
        timestamp: Date.now(),
        metadata: { error: errMsg },
      };
    }
  }

  /**
   * Get ERC-20 token balance via SURGE API.
   */
  async getTokenBalance(tokenAddress: string): Promise<{ balance: string; symbol: string }> {
    return surgeWallet.getTokenBalance(tokenAddress);
  }
}

export const transferManager = new TransferManager();
export default transferManager;
