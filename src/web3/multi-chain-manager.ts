// ============================================================
// src/web3/multi-chain-manager.ts — Multi-Chain Management
// ============================================================
// Supports multiple EVM-compatible chains via raw JSON-RPC
// calls. Provides balance queries, transaction lookups, block
// numbers, gas estimation, and ERC-20 token balance reads
// across Base, Ethereum, Polygon, Arbitrum, BSC, and Solana
// (read-only).
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';

const fetch = require('node-fetch');

// ---- Interfaces ----

/** Configuration for a supported blockchain network. */
export interface ChainConfig {
  /** Human-readable chain name */
  name: string;
  /** EVM chain ID (0 for non-EVM chains like Solana) */
  chainId: number;
  /** Public JSON-RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Native currency symbol and decimals */
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  /** Whether this is a testnet */
  isTestnet: boolean;
  /** Whether the chain is EVM-compatible */
  isEvm: boolean;
}

/** Balance information for a single chain. */
export interface ChainBalance {
  /** Chain identifier key */
  chain: string;
  /** Chain display name */
  chainName: string;
  /** Wallet address queried */
  address: string;
  /** Raw balance in wei (hex string) */
  balanceWei: string;
  /** Human-readable balance in native currency */
  balanceFormatted: string;
  /** Native currency symbol */
  symbol: string;
  /** Timestamp of the query */
  timestamp: number;
  /** Whether the query succeeded */
  success: boolean;
  /** Error message if query failed */
  error?: string;
}

/** Transaction receipt information. */
export interface TransactionInfo {
  /** Transaction hash */
  txHash: string;
  /** Chain the transaction belongs to */
  chain: string;
  /** Block number the tx was included in */
  blockNumber: number | null;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string | null;
  /** Value in wei (hex) */
  value: string;
  /** Gas used (hex) */
  gasUsed: string;
  /** Transaction status: 1 = success, 0 = revert */
  status: number;
  /** Contract address if this was a deployment */
  contractAddress: string | null;
  /** Block explorer URL for this transaction */
  explorerUrl: string;
  /** Timestamp of the query */
  timestamp: number;
}

/** Result of a JSON-RPC call. */
interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

// ---- Default Chain Registry ----

const DEFAULT_CHAINS: Record<string, ChainConfig> = {
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
    isEvm: true,
  },
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
    isEvm: true,
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: false,
    isEvm: true,
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
    isEvm: true,
  },
  bsc: {
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: false,
    isEvm: true,
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: true,
    isEvm: true,
  },
  solana: {
    name: 'Solana',
    chainId: 0,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: { name: 'SOL', symbol: 'SOL', decimals: 9 },
    isTestnet: false,
    isEvm: false,
  },
};

// ---- Helpers ----

/** Convert a hex wei value to a human-readable ETH string. */
function weiToEther(weiHex: string, decimals: number = 18): string {
  const weiBigInt = BigInt(weiHex);
  const divisor = BigInt(10 ** decimals);
  const whole = weiBigInt / divisor;
  const remainder = weiBigInt % divisor;
  const remainderStr = remainder.toString().padStart(decimals, '0').slice(0, 6);
  return `${whole}.${remainderStr}`;
}

/** Convert a lamports value to SOL string. */
function lamportsToSol(lamports: number): string {
  return (lamports / 1e9).toFixed(6);
}

let rpcIdCounter = 1;

// ---- MultiChainManager ----

/**
 * Multi-chain management system for reading balances, transactions,
 * and token data across multiple EVM-compatible blockchains.
 */
export class MultiChainManager {
  private chains: Map<string, ChainConfig> = new Map();

  constructor() {
    // Load default chains
    for (const [key, chain] of Object.entries(DEFAULT_CHAINS)) {
      this.chains.set(key, { ...chain });
    }
    logger.info(`[MultiChainManager] Initialized with ${this.chains.size} chains`);
  }

  // ---- Chain Registry ----

  /**
   * Register a custom chain in the registry.
   * @param key - Unique identifier for the chain
   * @param chainConfig - Full chain configuration
   */
  addChain(key: string, chainConfig: ChainConfig): void {
    this.chains.set(key, { ...chainConfig });
    logger.info(`[MultiChainManager] Added chain: ${chainConfig.name} (${key})`);
  }

  /**
   * Remove a chain from the registry.
   * @param key - Chain identifier to remove
   */
  removeChain(key: string): boolean {
    const removed = this.chains.delete(key);
    if (removed) {
      logger.info(`[MultiChainManager] Removed chain: ${key}`);
    }
    return removed;
  }

  /**
   * Get a chain configuration by key.
   * @param key - Chain identifier
   */
  getChain(key: string): ChainConfig | undefined {
    return this.chains.get(key);
  }

  /**
   * List all registered chain keys.
   */
  listChains(): string[] {
    return Array.from(this.chains.keys());
  }

  /**
   * List all registered chain configurations.
   */
  listChainConfigs(): Array<{ key: string; config: ChainConfig }> {
    return Array.from(this.chains.entries()).map(([key, cfg]) => ({ key, config: cfg }));
  }

  // ---- JSON-RPC Helpers ----

  /**
   * Execute a raw JSON-RPC call against a chain's RPC endpoint.
   * @param chain - Chain key
   * @param method - JSON-RPC method name
   * @param params - Method parameters
   * @returns The 'result' field from the JSON-RPC response
   */
  async rpcCall(chain: string, method: string, params: any[] = []): Promise<any> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}. Available: ${this.listChains().join(', ')}`);
    }

    const id = rpcIdCounter++;
    const body = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    const response = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP error for ${chain}: ${response.status} ${response.statusText}`);
    }

    const json: JsonRpcResponse = await response.json();

    if (json.error) {
      throw new Error(`RPC error on ${chain}: [${json.error.code}] ${json.error.message}`);
    }

    return json.result;
  }

  /**
   * Execute a Solana JSON-RPC call.
   * @param method - Solana RPC method
   * @param params - Method parameters
   */
  private async solanaRpcCall(method: string, params: any[] = []): Promise<any> {
    const chainConfig = this.chains.get('solana');
    if (!chainConfig) {
      throw new Error('Solana chain not configured');
    }

    const id = rpcIdCounter++;
    const body = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const response = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`Solana RPC HTTP error: ${response.status} ${response.statusText}`);
    }

    const json: JsonRpcResponse = await response.json();

    if (json.error) {
      throw new Error(`Solana RPC error: [${json.error.code}] ${json.error.message}`);
    }

    return json.result;
  }

  // ---- Core Methods ----

  /**
   * Get the native currency balance for an address on a specific chain.
   * @param chain - Chain key (e.g., 'base', 'ethereum')
   * @param address - Wallet address (hex for EVM, base58 for Solana)
   * @returns ChainBalance with balance info
   */
  async getBalance(chain: string, address: string): Promise<ChainBalance> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      return {
        chain,
        chainName: chain,
        address,
        balanceWei: '0x0',
        balanceFormatted: '0.000000',
        symbol: 'UNKNOWN',
        timestamp: Date.now(),
        success: false,
        error: `Unknown chain: ${chain}`,
      };
    }

    try {
      if (chain === 'solana') {
        const result = await this.solanaRpcCall('getBalance', [address]);
        const lamports: number = result?.value ?? 0;
        return {
          chain,
          chainName: chainConfig.name,
          address,
          balanceWei: `0x${lamports.toString(16)}`,
          balanceFormatted: lamportsToSol(lamports),
          symbol: chainConfig.nativeCurrency.symbol,
          timestamp: Date.now(),
          success: true,
        };
      }

      // EVM chains: eth_getBalance
      const balanceHex = await this.rpcCall(chain, 'eth_getBalance', [address, 'latest']);
      const formatted = weiToEther(balanceHex, chainConfig.nativeCurrency.decimals);

      return {
        chain,
        chainName: chainConfig.name,
        address,
        balanceWei: balanceHex,
        balanceFormatted: formatted,
        symbol: chainConfig.nativeCurrency.symbol,
        timestamp: Date.now(),
        success: true,
      };
    } catch (err: any) {
      logger.error(`[MultiChainManager] getBalance failed for ${chain}:${address}`, {
        error: err.message,
      });
      return {
        chain,
        chainName: chainConfig.name,
        address,
        balanceWei: '0x0',
        balanceFormatted: '0.000000',
        symbol: chainConfig.nativeCurrency.symbol,
        timestamp: Date.now(),
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Get a transaction receipt by hash on a specific chain.
   * @param chain - Chain key
   * @param txHash - Transaction hash (0x-prefixed)
   * @returns TransactionInfo with receipt details
   */
  async getTransactionReceipt(chain: string, txHash: string): Promise<TransactionInfo> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    if (!chainConfig.isEvm) {
      throw new Error(`getTransactionReceipt is only supported on EVM chains (got: ${chain})`);
    }

    try {
      // Fetch both receipt and transaction in parallel for full info
      const [receipt, tx] = await Promise.all([
        this.rpcCall(chain, 'eth_getTransactionReceipt', [txHash]),
        this.rpcCall(chain, 'eth_getTransactionByHash', [txHash]),
      ]);

      if (!receipt) {
        throw new Error(`Transaction receipt not found: ${txHash}`);
      }

      return {
        txHash,
        chain,
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber, 16) : null,
        from: receipt.from || tx?.from || '',
        to: receipt.to || tx?.to || null,
        value: tx?.value || '0x0',
        gasUsed: receipt.gasUsed || '0x0',
        status: receipt.status ? parseInt(receipt.status, 16) : 0,
        contractAddress: receipt.contractAddress || null,
        explorerUrl: `${chainConfig.explorerUrl}/tx/${txHash}`,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      logger.error(`[MultiChainManager] getTransactionReceipt failed for ${chain}:${txHash}`, {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get the latest block number on a specific chain.
   * @param chain - Chain key
   * @returns The current block number
   */
  async getBlockNumber(chain: string): Promise<number> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    try {
      if (chain === 'solana') {
        const slot = await this.solanaRpcCall('getSlot');
        return slot as number;
      }

      const blockHex = await this.rpcCall(chain, 'eth_blockNumber', []);
      return parseInt(blockHex, 16);
    } catch (err: any) {
      logger.error(`[MultiChainManager] getBlockNumber failed for ${chain}`, {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Estimate gas for a transaction on a specific chain.
   * @param chain - Chain key
   * @param tx - Transaction object with from, to, value, data fields
   * @returns Estimated gas as a number
   */
  async estimateGas(
    chain: string,
    tx: { from?: string; to: string; value?: string; data?: string }
  ): Promise<number> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    if (!chainConfig.isEvm) {
      throw new Error(`estimateGas is only supported on EVM chains (got: ${chain})`);
    }

    try {
      const txObj: Record<string, string> = { to: tx.to };
      if (tx.from) txObj.from = tx.from;
      if (tx.value) txObj.value = tx.value;
      if (tx.data) txObj.data = tx.data;

      const gasHex = await this.rpcCall(chain, 'eth_estimateGas', [txObj]);
      return parseInt(gasHex, 16);
    } catch (err: any) {
      logger.error(`[MultiChainManager] estimateGas failed for ${chain}`, {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get an ERC-20 token balance for a wallet on a specific chain.
   * Uses the balanceOf(address) function selector: 0x70a08231
   * @param chain - Chain key
   * @param tokenAddress - ERC-20 contract address
   * @param walletAddress - Wallet address to query
   * @returns Token balance as a hex string (raw, no decimal conversion)
   */
  async getTokenBalance(
    chain: string,
    tokenAddress: string,
    walletAddress: string
  ): Promise<{ balance: string; balanceRaw: string }> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    if (!chainConfig.isEvm) {
      throw new Error(`getTokenBalance is only supported on EVM chains (got: ${chain})`);
    }

    try {
      // balanceOf(address) selector = 0x70a08231
      // ABI-encode the address: pad to 32 bytes
      const paddedAddress = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
      const data = `0x70a08231${paddedAddress}`;

      const result = await this.rpcCall(chain, 'eth_call', [
        { to: tokenAddress, data },
        'latest',
      ]);

      // Result is a 32-byte hex-encoded uint256
      const balanceHex = result || '0x0';
      const balanceBigInt = BigInt(balanceHex);

      return {
        balance: balanceBigInt.toString(),
        balanceRaw: balanceHex,
      };
    } catch (err: any) {
      logger.error(
        `[MultiChainManager] getTokenBalance failed for ${chain}:${tokenAddress}:${walletAddress}`,
        { error: err.message }
      );
      throw err;
    }
  }

  /**
   * Fetch native currency balances from ALL registered chains in parallel.
   * Non-EVM chains are handled appropriately per chain type.
   * @param address - Wallet address (should be valid for all queried chains)
   * @returns Array of ChainBalance results, one per chain
   */
  async getAllBalances(address: string): Promise<ChainBalance[]> {
    const chainKeys = this.listChains();
    logger.info(`[MultiChainManager] Fetching balances across ${chainKeys.length} chains for ${address}`);

    const results = await Promise.allSettled(
      chainKeys.map((chain) => this.getBalance(chain, address))
    );

    const balances: ChainBalance[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const chainKey = chainKeys[index];
      const chainConfig = this.chains.get(chainKey);
      return {
        chain: chainKey,
        chainName: chainConfig?.name || chainKey,
        address,
        balanceWei: '0x0',
        balanceFormatted: '0.000000',
        symbol: chainConfig?.nativeCurrency.symbol || 'UNKNOWN',
        timestamp: Date.now(),
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    });

    const successCount = balances.filter((b) => b.success).length;
    logger.info(
      `[MultiChainManager] Balance fetch complete: ${successCount}/${balances.length} succeeded`
    );

    return balances;
  }

  /**
   * Get the current gas price on a specific EVM chain.
   * @param chain - Chain key
   * @returns Gas price in wei as a hex string and a formatted gwei string
   */
  async getGasPrice(chain: string): Promise<{ gasPriceWei: string; gasPriceGwei: string }> {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    if (!chainConfig.isEvm) {
      throw new Error(`getGasPrice is only supported on EVM chains (got: ${chain})`);
    }

    try {
      const gasPriceHex = await this.rpcCall(chain, 'eth_gasPrice', []);
      const gasPriceBigInt = BigInt(gasPriceHex);
      const gweiValue = Number(gasPriceBigInt) / 1e9;

      return {
        gasPriceWei: gasPriceHex,
        gasPriceGwei: gweiValue.toFixed(4),
      };
    } catch (err: any) {
      logger.error(`[MultiChainManager] getGasPrice failed for ${chain}`, {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get the explorer URL for a transaction or address on a chain.
   * @param chain - Chain key
   * @param hashOrAddress - Transaction hash or address
   * @param type - 'tx' or 'address'
   */
  getExplorerUrl(chain: string, hashOrAddress: string, type: 'tx' | 'address' = 'tx'): string {
    const chainConfig = this.chains.get(chain);
    if (!chainConfig) {
      return `https://etherscan.io/${type}/${hashOrAddress}`;
    }
    return `${chainConfig.explorerUrl}/${type}/${hashOrAddress}`;
  }
}

// ---- Singleton ----

export const multiChainManager = new MultiChainManager();
export default multiChainManager;
