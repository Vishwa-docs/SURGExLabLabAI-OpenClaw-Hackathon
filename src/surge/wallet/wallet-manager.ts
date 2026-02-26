// ============================================================
// src/surge/wallet/wallet-manager.ts — SURGE Wallet (API-managed)
// ============================================================
// Uses the SURGE API to create and manage server-side wallets.
// No private keys needed — SURGE handles all signing server-side.
//
// Real API: https://back.surge.xyz
// Auth: X-API-Key: sk-surge-...
// ============================================================

import { config } from '../../utils/config';
import logger from '../../utils/logger';
import fetch from 'node-fetch';

export interface WalletInfo {
  walletId: string;
  address: string;
  balance: string;
  network: string;
  needsFunding: boolean;
  createdAt: number;
}

export interface SurgeApiError {
  error: string;
  code?: string;
  details?: string;
}

export class SurgeWalletManager {
  private walletId: string = '';
  private walletAddress: string = '';
  private createdAt: number = 0;

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
   * Initialize wallet — load existing or create new via SURGE API.
   */
  async setup(): Promise<WalletInfo> {
    // If walletId already configured, use it
    if (config.surge.walletId) {
      this.walletId = config.surge.walletId;
      logger.info(`[SurgeWallet] Using existing wallet: ${this.walletId}`);
      return this.getInfo();
    }

    const isPlaceholder = !config.surge.apiKey ||
      config.surge.apiKey.includes('your-') ||
      config.surge.apiKey === 'sk-surge-' ||
      config.surge.apiKey.length < 20;

    if (isPlaceholder) {
      logger.warn('[SurgeWallet] No valid SURGE_API_KEY — running in dry-run mode');
      this.walletId = 'dry-run-wallet';
      this.walletAddress = '0x0000000000000000000000000000000000000000';
      this.createdAt = Date.now();
      return {
        walletId: this.walletId,
        address: this.walletAddress,
        balance: '0',
        network: 'base (dry-run)',
        needsFunding: true,
        createdAt: this.createdAt,
      };
    }

    // Create new wallet via SURGE API
    logger.info('[SurgeWallet] Creating new wallet via SURGE API...');
    const response = await fetch(`${this.baseUrl}/openclaw/wallet/create`, {
      method: 'POST',
      headers: this.headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SURGE wallet creation failed: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as {
      walletId: string;
      address: string;
      chainType: string;
      needsFunding: boolean;
      isNew: boolean;
    };

    this.walletId = data.walletId;
    this.walletAddress = data.address;
    this.createdAt = Date.now();

    logger.info(`[SurgeWallet] Wallet created: ${data.address}`);
    logger.info(`[SurgeWallet] Wallet ID: ${data.walletId} (save as SURGE_WALLET_ID in .env)`);

    if (data.needsFunding) {
      logger.info('[SurgeWallet] Wallet needs funding — requesting one-time free funding...');
      await this.fund();
    }

    return this.getInfo();
  }

  /**
   * Request one-time free funding from SURGE.
   */
  async fund(): Promise<void> {
    if (!config.surge.apiKey || this.walletId === 'dry-run-wallet') return;

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/wallet/${this.walletId}/fund`, {
        method: 'POST',
        headers: this.headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn(`[SurgeWallet] Funding failed: ${response.status} ${errText}`);
        return;
      }

      const data = (await response.json()) as {
        walletId: string;
        needsFunding: boolean;
        funding: Array<{ chain: string; amount: string; txHash: string }>;
      };

      for (const f of data.funding) {
        logger.info(`[SurgeWallet] Funded: ${f.amount} on ${f.chain} (tx: ${f.txHash})`);
      }
    } catch (err) {
      logger.warn(`[SurgeWallet] Funding request failed: ${err}`);
    }
  }

  /**
   * Get wallet balance from SURGE API.
   */
  async getBalance(): Promise<string> {
    if (!config.surge.apiKey || this.walletId === 'dry-run-wallet') {
      return '0';
    }

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/wallet/${this.walletId}/balance`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) return '0';

      const data = (await response.json()) as {
        balance: string;
        sufficient: boolean;
        minRequired: string;
      };
      return data.balance;
    } catch {
      return '0';
    }
  }

  /**
   * Get token balance for an ERC-20/SPL token.
   */
  async getTokenBalance(tokenAddress: string): Promise<{ balance: string; symbol: string }> {
    if (!config.surge.apiKey || this.walletId === 'dry-run-wallet') {
      return { balance: '0', symbol: 'UNKNOWN' };
    }

    const response = await fetch(`${this.baseUrl}/openclaw/wallet/${this.walletId}/token-balance`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        chainId: config.surge.chainId,
        tokenAddress,
      }),
    });

    if (!response.ok) {
      return { balance: '0', symbol: 'UNKNOWN' };
    }

    const data = (await response.json()) as {
      balance: string;
      tokenSymbol: string;
      tokenName: string;
      decimals: number;
    };

    return { balance: data.balance, symbol: data.tokenSymbol || '' };
  }

  /**
   * Get wallet address.
   */
  getAddress(): string {
    return this.walletAddress || '0x0000000000000000000000000000000000000000';
  }

  /**
   * Get wallet ID.
   */
  getWalletId(): string {
    return this.walletId;
  }

  /**
   * Get wallet info summary.
   */
  async getInfo(): Promise<WalletInfo> {
    const balance = await this.getBalance();
    return {
      walletId: this.walletId,
      address: this.walletAddress || this.getAddress(),
      balance,
      network: 'base',
      needsFunding: parseFloat(balance) === 0,
      createdAt: this.createdAt,
    };
  }

  /**
   * Check if wallet has minimum balance for operations.
   */
  async hasMinBalance(minEth: string = '0.001'): Promise<boolean> {
    const balance = await this.getBalance();
    return parseFloat(balance) >= parseFloat(minEth);
  }

  /**
   * Get trade history from SURGE API.
   */
  async getTradeHistory(limit: number = 10): Promise<Array<{
    type: string;
    tokenAddress: string;
    amount: string;
    txHash: string;
    timestamp: number;
  }>> {
    if (!config.surge.apiKey || this.walletId === 'dry-run-wallet') return [];

    try {
      const response = await fetch(
        `${this.baseUrl}/openclaw/wallet/${this.walletId}/history?limit=${limit}`,
        { headers: this.headers }
      );

      if (!response.ok) return [];
      const data = (await response.json()) as { trades: Array<{
        type: string;
        tokenAddress: string;
        amount: string;
        txHash: string;
        timestamp: number;
      }> };
      return data.trades || [];
    } catch {
      return [];
    }
  }

  /**
   * Check transaction status on SURGE.
   */
  async checkTxStatus(txHash: string): Promise<{ status: string; confirmed: boolean }> {
    if (!config.surge.apiKey) return { status: 'unknown', confirmed: false };

    try {
      const response = await fetch(`${this.baseUrl}/openclaw/tx-status`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ txHash, chainId: config.surge.chainId }),
      });

      if (!response.ok) return { status: 'unknown', confirmed: false };
      const data = (await response.json()) as { status: string; confirmed: boolean };
      return data;
    } catch {
      return { status: 'unknown', confirmed: false };
    }
  }
}

// Singleton
export const surgeWallet = new SurgeWalletManager();
export default surgeWallet;
