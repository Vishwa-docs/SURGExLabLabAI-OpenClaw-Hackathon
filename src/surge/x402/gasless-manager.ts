// ============================================================
// src/surge/x402/gasless-manager.ts — x402 Gasless Transactions
// ============================================================
// Enables gasless transactions via the x402 protocol.
// Agent-sponsored gas with credit pool funding and auto-retry.
// ============================================================

import fetch from 'node-fetch';
import { config } from '../../utils/config';
import logger from '../../utils/logger';

export interface GaslessTransactionRequest {
  to: string;
  data: string;
  value?: string;
  chainId?: number;
}

export interface GaslessTransactionResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  gasSponsored?: boolean;
  error?: string;
}

export interface CreditPool {
  balance: number;
  currency: string;
  lastTopUp: number;
}

export class GaslessManager {
  private creditPool: CreditPool = {
    balance: 0,
    currency: 'USD',
    lastTopUp: 0,
  };
  private maxRetries: number = 3;

  /**
   * Submit a gasless transaction via x402 protocol.
   */
  async submitGasless(request: GaslessTransactionRequest): Promise<GaslessTransactionResult> {
    const { endpoint, apiKey } = config.x402;

    if (!apiKey) {
      logger.warn('[x402] No API key configured — falling back to standard gas');
      return { success: false, error: 'x402 not configured', gasSponsored: false };
    }

    let lastError = '';
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`[x402] Submitting gasless tx (attempt ${attempt}/${this.maxRetries})`);

        const response = await fetch(`${endpoint}/v1/transactions/sponsor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-402-Payment': 'credit-pool',
          },
          body: JSON.stringify({
            to: request.to,
            data: request.data,
            value: request.value || '0',
            chainId: request.chainId || 8453, // Base mainnet
          }),
        });

        if (response.status === 402) {
          // Payment required — need to top up credit pool
          logger.warn('[x402] Credit pool depleted — needs top-up');
          return {
            success: false,
            error: 'x402 credit pool depleted',
            gasSponsored: false,
          };
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `x402 error: ${response.status} ${errText}`;
          logger.warn(`[x402] Attempt ${attempt} failed: ${lastError}`);
          continue;
        }

        const data = (await response.json()) as {
          txHash: string;
          gasSponsored: boolean;
        };

        const explorerUrl = `https://basescan.org/tx/${data.txHash}`;

        logger.info(`[x402] Gasless tx successful: ${data.txHash}`);
        return {
          success: true,
          txHash: data.txHash,
          explorerUrl,
          gasSponsored: data.gasSponsored,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(`[x402] Attempt ${attempt} error: ${lastError}`);
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    return {
      success: false,
      error: `All ${this.maxRetries} attempts failed: ${lastError}`,
      gasSponsored: false,
    };
  }

  /**
   * Encode a transfer as a gasless transaction.
   * Amount is human-readable ETH string (e.g. "0.01").
   */
  async sponsoredTransfer(to: string, amountEth: string): Promise<GaslessTransactionResult> {
    return this.submitGasless({
      to,
      data: '0x',
      value: amountEth,
    });
  }

  /**
   * Encode an ERC-20 transfer as gasless.
   * Note: x402 protocol handles encoding — we pass the intent.
   */
  async sponsoredTokenTransfer(
    tokenAddress: string,
    to: string,
    amount: string,
    _decimals: number = 18
  ): Promise<GaslessTransactionResult> {
    // x402 protocol handles the encoding server-side
    return this.submitGasless({
      to: tokenAddress,
      data: JSON.stringify({ method: 'transfer', params: { to, amount } }),
    });
  }

  /**
   * Check credit pool balance.
   */
  async getCreditPoolBalance(): Promise<CreditPool> {
    const { endpoint, apiKey } = config.x402;
    if (!apiKey) return this.creditPool;

    try {
      const response = await fetch(`${endpoint}/v1/credit-pool/balance`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) {
        const data = (await response.json()) as CreditPool;
        this.creditPool = data;
      }
    } catch {
      // Use cached value
    }

    return this.creditPool;
  }

  /**
   * Top up the credit pool.
   */
  async topUpCreditPool(amountUsd: number): Promise<boolean> {
    const { endpoint, apiKey } = config.x402;
    if (!apiKey) return false;

    try {
      const response = await fetch(`${endpoint}/v1/credit-pool/top-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ amount: amountUsd, currency: 'USD' }),
      });

      if (response.ok) {
        this.creditPool.balance += amountUsd;
        this.creditPool.lastTopUp = Date.now();
        logger.info(`[x402] Credit pool topped up by $${amountUsd}`);
        return true;
      }
    } catch {
      // fail silently
    }

    return false;
  }

  /**
   * Check if gasless mode is available.
   */
  isAvailable(): boolean {
    return !!config.x402.apiKey;
  }
}

export const gaslessManager = new GaslessManager();
export default gaslessManager;
