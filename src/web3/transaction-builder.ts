// ============================================================
// src/web3/transaction-builder.ts — Transaction Builder
// ============================================================
// Constructs, validates, queues, and simulates unsigned EVM
// transactions for multi-chain operations. Provides gas
// estimation, optimization, priority queuing, batching, and
// dry-run simulation via eth_call.
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';
import { multiChainManager } from './multi-chain-manager';
import { contractInteraction } from './contract-interaction';

// ---- Interfaces ----

/** An unsigned EVM transaction ready for signing. */
export interface UnsignedTransaction {
  /** Unique transaction ID (internal, not on-chain) */
  id: string;
  /** Chain key (e.g., 'base', 'ethereum') */
  chain: string;
  /** Chain ID (numeric) */
  chainId: number;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Value in wei (hex) */
  value: string;
  /** Calldata (hex, for contract interactions) */
  data: string;
  /** Gas limit */
  gasLimit: number;
  /** Gas price in wei (hex, for legacy txs) */
  gasPrice?: string;
  /** Max fee per gas (hex, for EIP-1559 txs) */
  maxFeePerGas?: string;
  /** Max priority fee per gas (hex, for EIP-1559 txs) */
  maxPriorityFeePerGas?: string;
  /** Transaction nonce */
  nonce?: number;
  /** Transaction type: 'legacy' | 'eip1559' */
  type: 'legacy' | 'eip1559';
}

/** Parameters for building a native transfer. */
export interface TransferParams {
  /** Chain key */
  chain: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in native currency (decimal string, e.g., "0.1") */
  amount: string;
}

/** Parameters for building an ERC-20 token transfer. */
export interface TokenTransferParams {
  /** Chain key */
  chain: string;
  /** ERC-20 token contract address */
  tokenAddress: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in token units (decimal string, e.g., "100.5") */
  amount: string;
  /** Token decimals (default: 18) */
  decimals?: number;
}

/** Transaction validation result. */
export interface ValidationResult {
  /** Whether the transaction is valid */
  valid: boolean;
  /** Validation errors (empty if valid) */
  errors: string[];
  /** Validation warnings (non-blocking) */
  warnings: string[];
}

/** Queued transaction with priority and status. */
export interface QueuedTransaction {
  /** The unsigned transaction */
  transaction: UnsignedTransaction;
  /** Queue priority (higher = processed first) */
  priority: number;
  /** Current status in the queue */
  status: 'pending' | 'processing' | 'simulated' | 'ready' | 'failed' | 'cancelled';
  /** Simulation result (if dry-run was performed) */
  simulationResult?: SimulationResult;
  /** When the transaction was queued */
  queuedAt: number;
  /** When the transaction was last updated */
  updatedAt: number;
  /** Error message if failed */
  error?: string;
}

/** Result of a transaction simulation (dry-run). */
export interface SimulationResult {
  /** Whether the simulation succeeded (no revert) */
  success: boolean;
  /** Estimated gas used */
  gasUsed: number;
  /** Return data from the simulated call */
  returnData: string;
  /** Revert reason if the simulation failed */
  revertReason?: string;
  /** Estimated cost in native currency */
  estimatedCostWei: string;
  /** Estimated cost formatted */
  estimatedCostFormatted: string;
}

/** Batch transaction group. */
export interface TransactionBatch {
  /** Unique batch ID */
  id: string;
  /** Human-readable batch name */
  name: string;
  /** Transactions in the batch */
  transactions: UnsignedTransaction[];
  /** Batch status */
  status: 'building' | 'ready' | 'simulated' | 'failed';
  /** Total estimated gas for the batch */
  totalEstimatedGas: number;
  /** When the batch was created */
  createdAt: number;
}

/** Gas estimation with optimization suggestions. */
export interface GasEstimate {
  /** Raw estimated gas limit */
  estimatedGas: number;
  /** Recommended gas limit (with safety buffer) */
  recommendedGasLimit: number;
  /** Current gas price in gwei */
  gasPriceGwei: string;
  /** Estimated cost in wei */
  estimatedCostWei: string;
  /** Estimated cost in native currency */
  estimatedCostFormatted: string;
  /** Optimization suggestions */
  suggestions: string[];
}

// ---- Helpers ----

/** Validate an Ethereum address format. */
function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Convert a decimal amount string to wei (hex). */
function amountToWei(amount: string, decimals: number = 18): string {
  const parts = amount.split('.');
  const wholePart = parts[0] || '0';
  let fracPart = parts[1] || '';

  // Pad or truncate fractional part to match decimals
  if (fracPart.length > decimals) {
    fracPart = fracPart.slice(0, decimals);
  } else {
    fracPart = fracPart.padEnd(decimals, '0');
  }

  const combined = wholePart + fracPart;
  // Remove leading zeros but keep at least one digit
  const trimmed = combined.replace(/^0+/, '') || '0';
  const bn = BigInt(trimmed);
  return '0x' + bn.toString(16);
}

/** Convert wei (hex or decimal) to a formatted native currency string. */
function weiToFormatted(weiHex: string, decimals: number = 18): string {
  const bn = BigInt(weiHex);
  const divisor = BigInt(10 ** decimals);
  const whole = bn / divisor;
  const remainder = bn % divisor;
  const fracStr = remainder.toString().padStart(decimals, '0').slice(0, 8);
  return `${whole}.${fracStr}`;
}

let txIdCounter = 0;
let batchIdCounter = 0;

// ---- TransactionBuilder ----

/**
 * Transaction construction, validation, simulation, and queuing for
 * multi-chain EVM operations. All transactions are built as unsigned
 * objects—actual signing and broadcasting is left to the wallet layer.
 */
export class TransactionBuilder {
  /** Transaction queue, keyed by transaction ID */
  private queue: Map<string, QueuedTransaction> = new Map();

  /** Transaction batches, keyed by batch ID */
  private batches: Map<string, TransactionBatch> = new Map();

  /** Completed transaction history (last N) */
  private history: QueuedTransaction[] = [];

  /** Maximum queue size */
  private readonly maxQueueSize: number = 200;

  /** Maximum history size */
  private readonly maxHistorySize: number = 500;

  /** Default gas limit safety multiplier (e.g., 1.2 = 20% buffer) */
  private readonly gasBufferMultiplier: number = 1.2;

  constructor() {
    logger.info('[TransactionBuilder] Initialized');
  }

  // ---- Transaction Building ----

  /**
   * Build an unsigned native currency transfer transaction.
   * @param params - Transfer parameters (chain, from, to, amount)
   * @returns UnsignedTransaction ready for signing
   */
  async buildTransfer(params: TransferParams): Promise<UnsignedTransaction> {
    const { chain, from, to, amount } = params;

    logger.info(`[TransactionBuilder] Building transfer: ${amount} on ${chain} from ${from} to ${to}`);

    // Validate
    const validation = this.validateTransferParams(from, to, amount);
    if (!validation.valid) {
      throw new Error(`Invalid transfer params: ${validation.errors.join('; ')}`);
    }

    const chainConfig = multiChainManager.getChain(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    if (!chainConfig.isEvm) {
      throw new Error(`buildTransfer only supports EVM chains (got: ${chain})`);
    }

    const valueWei = amountToWei(amount, chainConfig.nativeCurrency.decimals);

    // Estimate gas
    let gasLimit: number;
    try {
      const estimated = await multiChainManager.estimateGas(chain, {
        from,
        to,
        value: valueWei,
      });
      gasLimit = Math.ceil(estimated * this.gasBufferMultiplier);
    } catch {
      // Default gas for simple transfer
      gasLimit = 21000;
    }

    // Get gas price
    let gasPrice: string | undefined;
    let maxFeePerGas: string | undefined;
    let maxPriorityFeePerGas: string | undefined;
    let txType: 'legacy' | 'eip1559' = 'legacy';

    try {
      const gasPriceResult = await multiChainManager.getGasPrice(chain);
      gasPrice = gasPriceResult.gasPriceWei;

      // Use EIP-1559 for chains that support it (Ethereum, Base, Polygon, Arbitrum)
      const eip1559Chains = ['ethereum', 'base', 'polygon', 'arbitrum', 'base-sepolia'];
      if (eip1559Chains.includes(chain)) {
        txType = 'eip1559';
        const baseFee = BigInt(gasPrice);
        // Tip: 1.5 gwei default
        const tip = BigInt('1500000000');
        maxPriorityFeePerGas = '0x' + tip.toString(16);
        // Max fee: 2x base fee + tip
        maxFeePerGas = '0x' + (baseFee * BigInt(2) + tip).toString(16);
        gasPrice = undefined;
      }
    } catch {
      // Fallback gas price: 20 gwei
      gasPrice = '0x' + BigInt('20000000000').toString(16);
    }

    const txId = `tx-${++txIdCounter}-${Date.now()}`;

    const tx: UnsignedTransaction = {
      id: txId,
      chain,
      chainId: chainConfig.chainId,
      from,
      to,
      value: valueWei,
      data: '0x',
      gasLimit,
      type: txType,
    };

    if (txType === 'eip1559') {
      tx.maxFeePerGas = maxFeePerGas;
      tx.maxPriorityFeePerGas = maxPriorityFeePerGas;
    } else {
      tx.gasPrice = gasPrice;
    }

    logger.info(`[TransactionBuilder] Built transfer ${txId}: ${amount} ${chainConfig.nativeCurrency.symbol} on ${chain}`);
    return tx;
  }

  /**
   * Build an unsigned ERC-20 token transfer transaction.
   * @param params - Token transfer parameters
   * @returns UnsignedTransaction with encoded ERC-20 transfer calldata
   */
  async buildTokenTransfer(params: TokenTransferParams): Promise<UnsignedTransaction> {
    const { chain, tokenAddress, from, to, amount, decimals = 18 } = params;

    logger.info(
      `[TransactionBuilder] Building token transfer: ${amount} of ${tokenAddress} on ${chain}`
    );

    // Validate addresses
    const validation = this.validateTransferParams(from, to, amount);
    if (!validation.valid) {
      throw new Error(`Invalid token transfer params: ${validation.errors.join('; ')}`);
    }
    if (!isValidAddress(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }

    const chainConfig = multiChainManager.getChain(chain);
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    if (!chainConfig.isEvm) {
      throw new Error(`buildTokenTransfer only supports EVM chains (got: ${chain})`);
    }

    // Convert amount to raw token units
    const rawAmount = amountToWei(amount, decimals);
    const rawAmountDecimal = BigInt(rawAmount).toString();

    // Encode transfer(address,uint256) calldata
    const calldata = contractInteraction.encodeTransfer(to, rawAmountDecimal);

    // Estimate gas for the token transfer
    let gasLimit: number;
    try {
      const estimated = await multiChainManager.estimateGas(chain, {
        from,
        to: tokenAddress,
        data: calldata,
      });
      gasLimit = Math.ceil(estimated * this.gasBufferMultiplier);
    } catch {
      // Default gas for ERC-20 transfer
      gasLimit = 65000;
    }

    // Get gas price
    let gasPrice: string | undefined;
    let maxFeePerGas: string | undefined;
    let maxPriorityFeePerGas: string | undefined;
    let txType: 'legacy' | 'eip1559' = 'legacy';

    try {
      const gasPriceResult = await multiChainManager.getGasPrice(chain);
      gasPrice = gasPriceResult.gasPriceWei;

      const eip1559Chains = ['ethereum', 'base', 'polygon', 'arbitrum', 'base-sepolia'];
      if (eip1559Chains.includes(chain)) {
        txType = 'eip1559';
        const baseFee = BigInt(gasPrice);
        const tip = BigInt('1500000000');
        maxPriorityFeePerGas = '0x' + tip.toString(16);
        maxFeePerGas = '0x' + (baseFee * BigInt(2) + tip).toString(16);
        gasPrice = undefined;
      }
    } catch {
      gasPrice = '0x' + BigInt('20000000000').toString(16);
    }

    const txId = `tx-${++txIdCounter}-${Date.now()}`;

    const tx: UnsignedTransaction = {
      id: txId,
      chain,
      chainId: chainConfig.chainId,
      from,
      to: tokenAddress,
      value: '0x0',
      data: calldata,
      gasLimit,
      type: txType,
    };

    if (txType === 'eip1559') {
      tx.maxFeePerGas = maxFeePerGas;
      tx.maxPriorityFeePerGas = maxPriorityFeePerGas;
    } else {
      tx.gasPrice = gasPrice;
    }

    logger.info(`[TransactionBuilder] Built token transfer ${txId}: ${amount} tokens on ${chain}`);
    return tx;
  }

  // ---- Validation ----

  /**
   * Validate transfer parameters (addresses & amount).
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Amount as a decimal string
   * @returns ValidationResult
   */
  validateTransferParams(from: string, to: string, amount: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Address validation
    if (!isValidAddress(from)) {
      errors.push(`Invalid sender address: ${from}`);
    }
    if (!isValidAddress(to)) {
      errors.push(`Invalid recipient address: ${to}`);
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      warnings.push('Sender and recipient are the same address');
    }

    // Amount validation
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) {
      errors.push(`Invalid amount: ${amount} (not a number)`);
    } else if (amountNum <= 0) {
      errors.push(`Amount must be positive, got: ${amount}`);
    } else if (amountNum > 1e12) {
      warnings.push(`Very large amount: ${amount} — please double-check`);
    }

    // Check for scientific notation in amount
    if (amount.includes('e') || amount.includes('E')) {
      errors.push(`Amount should not use scientific notation: ${amount}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a complete unsigned transaction object.
   * @param tx - UnsignedTransaction to validate
   * @returns ValidationResult
   */
  validateTransaction(tx: UnsignedTransaction): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Chain validation
    const chainConfig = multiChainManager.getChain(tx.chain);
    if (!chainConfig) {
      errors.push(`Unknown chain: ${tx.chain}`);
    } else if (chainConfig.chainId !== tx.chainId) {
      errors.push(`Chain ID mismatch: tx has ${tx.chainId}, chain config has ${chainConfig.chainId}`);
    }

    // Address validation
    if (!isValidAddress(tx.from)) {
      errors.push(`Invalid from address: ${tx.from}`);
    }
    if (!isValidAddress(tx.to)) {
      errors.push(`Invalid to address: ${tx.to}`);
    }

    // Gas validation
    if (tx.gasLimit <= 0) {
      errors.push('Gas limit must be positive');
    }
    if (tx.gasLimit > 30_000_000) {
      warnings.push(`Very high gas limit: ${tx.gasLimit} — may exceed block gas limit`);
    }
    if (tx.gasLimit < 21000) {
      warnings.push(`Gas limit ${tx.gasLimit} is below minimum (21000) for simple transfers`);
    }

    // Value validation
    try {
      const valueBn = BigInt(tx.value);
      if (valueBn < BigInt(0)) {
        errors.push('Transaction value cannot be negative');
      }
    } catch {
      errors.push(`Invalid transaction value: ${tx.value}`);
    }

    // Data validation
    if (tx.data && tx.data !== '0x' && !tx.data.startsWith('0x')) {
      errors.push('Transaction data must be hex-encoded with 0x prefix');
    }

    // Gas price validation
    if (tx.type === 'legacy' && !tx.gasPrice) {
      warnings.push('Legacy transaction without gasPrice set');
    }
    if (tx.type === 'eip1559' && (!tx.maxFeePerGas || !tx.maxPriorityFeePerGas)) {
      warnings.push('EIP-1559 transaction without maxFeePerGas or maxPriorityFeePerGas');
    }

    // Testnet warning
    if (chainConfig?.isTestnet) {
      warnings.push(`Transaction is on testnet: ${chainConfig.name}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ---- Gas Estimation & Optimization ----

  /**
   * Estimate gas for a transaction and provide optimization suggestions.
   * @param tx - UnsignedTransaction to estimate
   * @returns GasEstimate with cost breakdown and suggestions
   */
  async estimateAndOptimize(tx: UnsignedTransaction): Promise<GasEstimate> {
    logger.info(`[TransactionBuilder] Estimating gas for ${tx.id} on ${tx.chain}`);

    const suggestions: string[] = [];

    // Estimate gas
    let estimatedGas: number;
    try {
      estimatedGas = await multiChainManager.estimateGas(tx.chain, {
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data !== '0x' ? tx.data : undefined,
      });
    } catch (err: any) {
      logger.warn(`[TransactionBuilder] Gas estimation failed, using tx gasLimit: ${err.message}`);
      estimatedGas = tx.gasLimit;
      suggestions.push('Gas estimation failed — using provided gas limit');
    }

    const recommendedGasLimit = Math.ceil(estimatedGas * this.gasBufferMultiplier);

    // Get gas price
    let gasPriceWei: bigint;
    let gasPriceGwei: string;
    try {
      const priceResult = await multiChainManager.getGasPrice(tx.chain);
      gasPriceWei = BigInt(priceResult.gasPriceWei);
      gasPriceGwei = priceResult.gasPriceGwei;
    } catch {
      gasPriceWei = BigInt('20000000000'); // 20 gwei fallback
      gasPriceGwei = '20.0000';
    }

    // Calculate estimated cost
    const estimatedCostWei = gasPriceWei * BigInt(recommendedGasLimit);
    const estimatedCostHex = '0x' + estimatedCostWei.toString(16);
    const estimatedCostFormatted = weiToFormatted(estimatedCostHex);

    // Optimization suggestions
    if (tx.gasLimit > recommendedGasLimit * 1.5) {
      suggestions.push(
        `Gas limit (${tx.gasLimit}) is much higher than estimated (${estimatedGas}). Consider reducing to ${recommendedGasLimit}.`
      );
    }

    if (Number(gasPriceGwei) > 50) {
      suggestions.push(
        `Gas price is high (${gasPriceGwei} gwei). Consider waiting for lower gas prices.`
      );
    }

    if (tx.data && tx.data.length > 1000) {
      suggestions.push(
        'Transaction has large calldata. Consider optimizing contract interaction to reduce calldata size.'
      );
    }

    // Chain-specific suggestions
    const l2Chains = ['base', 'arbitrum', 'polygon', 'base-sepolia'];
    if (!l2Chains.includes(tx.chain)) {
      suggestions.push(
        `Consider using an L2 chain (Base, Arbitrum, Polygon) for lower gas costs.`
      );
    }

    const estimate: GasEstimate = {
      estimatedGas,
      recommendedGasLimit,
      gasPriceGwei,
      estimatedCostWei: estimatedCostHex,
      estimatedCostFormatted,
      suggestions,
    };

    logger.info(
      `[TransactionBuilder] Gas estimate for ${tx.id}: ${estimatedGas} gas, ~${estimatedCostFormatted} native`
    );

    return estimate;
  }

  // ---- Simulation (Dry-Run) ----

  /**
   * Simulate a transaction using eth_call (dry-run, no state changes).
   * @param tx - UnsignedTransaction to simulate
   * @returns SimulationResult with success/failure and gas usage
   */
  async simulateTransaction(tx: UnsignedTransaction): Promise<SimulationResult> {
    logger.info(`[TransactionBuilder] Simulating transaction ${tx.id} on ${tx.chain}`);

    try {
      const callObj: Record<string, string> = {
        from: tx.from,
        to: tx.to,
        value: tx.value,
      };
      if (tx.data && tx.data !== '0x') {
        callObj.data = tx.data;
      }

      // eth_call to simulate
      const returnData = await multiChainManager.rpcCall(tx.chain, 'eth_call', [
        callObj,
        'latest',
      ]);

      // Estimate gas for cost calculation
      let gasUsed: number;
      try {
        gasUsed = await multiChainManager.estimateGas(tx.chain, {
          from: tx.from,
          to: tx.to,
          value: tx.value,
          data: tx.data !== '0x' ? tx.data : undefined,
        });
      } catch {
        gasUsed = tx.gasLimit;
      }

      // Calculate cost
      let gasPriceWei: bigint;
      try {
        const priceResult = await multiChainManager.getGasPrice(tx.chain);
        gasPriceWei = BigInt(priceResult.gasPriceWei);
      } catch {
        gasPriceWei = BigInt('20000000000');
      }

      const costWei = gasPriceWei * BigInt(gasUsed);
      const costHex = '0x' + costWei.toString(16);

      return {
        success: true,
        gasUsed,
        returnData: returnData || '0x',
        estimatedCostWei: costHex,
        estimatedCostFormatted: weiToFormatted(costHex),
      };
    } catch (err: any) {
      logger.warn(`[TransactionBuilder] Simulation failed for ${tx.id}: ${err.message}`);

      // Try to extract revert reason
      let revertReason = err.message;
      const revertMatch = err.message.match(/execution reverted:?\s*(.*)/i);
      if (revertMatch) {
        revertReason = revertMatch[1] || 'Unknown revert';
      }

      return {
        success: false,
        gasUsed: 0,
        returnData: '0x',
        revertReason,
        estimatedCostWei: '0x0',
        estimatedCostFormatted: '0.00000000',
      };
    }
  }

  // ---- Transaction Queue ----

  /**
   * Add a transaction to the processing queue with a given priority.
   * @param tx - UnsignedTransaction to queue
   * @param priority - Priority level (higher = processed first, default: 0)
   * @returns The queued transaction entry
   */
  queueTransaction(tx: UnsignedTransaction, priority: number = 0): QueuedTransaction {
    if (this.queue.size >= this.maxQueueSize) {
      throw new Error(
        `Transaction queue is full (${this.maxQueueSize}). Process or clear pending transactions.`
      );
    }

    // Validate before queuing
    const validation = this.validateTransaction(tx);
    if (!validation.valid) {
      throw new Error(`Transaction validation failed: ${validation.errors.join('; ')}`);
    }

    const queued: QueuedTransaction = {
      transaction: tx,
      priority,
      status: 'pending',
      queuedAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.queue.set(tx.id, queued);

    if (validation.warnings.length > 0) {
      logger.warn(`[TransactionBuilder] Queued ${tx.id} with warnings: ${validation.warnings.join('; ')}`);
    } else {
      logger.info(`[TransactionBuilder] Queued transaction ${tx.id} with priority ${priority}`);
    }

    return queued;
  }

  /**
   * Process the transaction queue: simulate each pending transaction and mark as ready.
   * Processes transactions in priority order (highest first).
   * @returns Array of processed queue entries
   */
  async processQueue(): Promise<QueuedTransaction[]> {
    const pending = Array.from(this.queue.values())
      .filter((q) => q.status === 'pending')
      .sort((a, b) => b.priority - a.priority);

    if (pending.length === 0) {
      logger.info('[TransactionBuilder] No pending transactions in queue');
      return [];
    }

    logger.info(`[TransactionBuilder] Processing ${pending.length} queued transactions`);

    const processed: QueuedTransaction[] = [];

    for (const queued of pending) {
      queued.status = 'processing';
      queued.updatedAt = Date.now();

      try {
        // Simulate the transaction
        const simResult = await this.simulateTransaction(queued.transaction);
        queued.simulationResult = simResult;

        if (simResult.success) {
          queued.status = 'simulated';
          logger.info(
            `[TransactionBuilder] Transaction ${queued.transaction.id} simulated successfully (${simResult.gasUsed} gas)`
          );
        } else {
          queued.status = 'failed';
          queued.error = simResult.revertReason || 'Simulation failed';
          logger.warn(
            `[TransactionBuilder] Transaction ${queued.transaction.id} simulation failed: ${queued.error}`
          );
        }
      } catch (err: any) {
        queued.status = 'failed';
        queued.error = err.message;
        logger.error(
          `[TransactionBuilder] Error processing ${queued.transaction.id}: ${err.message}`
        );
      }

      queued.updatedAt = Date.now();
      processed.push(queued);
    }

    logger.info(
      `[TransactionBuilder] Queue processing complete: ${processed.filter((p) => p.status === 'simulated').length}/${processed.length} succeeded`
    );

    return processed;
  }

  /**
   * Mark a queued transaction as ready for signing/broadcasting.
   * Only simulated transactions can be marked as ready.
   * @param txId - Transaction ID
   */
  markAsReady(txId: string): boolean {
    const queued = this.queue.get(txId);
    if (!queued) {
      logger.warn(`[TransactionBuilder] Transaction not found in queue: ${txId}`);
      return false;
    }

    if (queued.status !== 'simulated') {
      logger.warn(
        `[TransactionBuilder] Cannot mark ${txId} as ready — current status: ${queued.status} (must be 'simulated')`
      );
      return false;
    }

    queued.status = 'ready';
    queued.updatedAt = Date.now();
    logger.info(`[TransactionBuilder] Transaction ${txId} marked as ready`);
    return true;
  }

  /**
   * Cancel a queued transaction.
   * @param txId - Transaction ID
   */
  cancelTransaction(txId: string): boolean {
    const queued = this.queue.get(txId);
    if (!queued) return false;

    if (queued.status === 'processing') {
      logger.warn(`[TransactionBuilder] Cannot cancel ${txId} — currently processing`);
      return false;
    }

    queued.status = 'cancelled';
    queued.updatedAt = Date.now();

    // Move to history
    this.history.push(queued);
    if (this.history.length > this.maxHistorySize) {
      this.history.splice(0, this.history.length - this.maxHistorySize);
    }
    this.queue.delete(txId);

    logger.info(`[TransactionBuilder] Transaction ${txId} cancelled`);
    return true;
  }

  /**
   * Get the current state of the transaction queue.
   * @param status - Optional status filter
   */
  getQueue(status?: QueuedTransaction['status']): QueuedTransaction[] {
    const all = Array.from(this.queue.values());
    if (status) {
      return all.filter((q) => q.status === status);
    }
    return all.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a specific queued transaction by ID.
   * @param txId - Transaction ID
   */
  getQueuedTransaction(txId: string): QueuedTransaction | undefined {
    return this.queue.get(txId);
  }

  /**
   * Get transaction history (completed, cancelled, or failed).
   * @param limit - Maximum entries to return
   */
  getTransactionHistory(limit: number = 50): QueuedTransaction[] {
    return this.history.slice(-limit);
  }

  // ---- Batch Operations ----

  /**
   * Create a new transaction batch.
   * @param name - Human-readable batch name
   * @returns The created batch
   */
  createBatch(name: string): TransactionBatch {
    const id = `batch-${++batchIdCounter}-${Date.now()}`;
    const batch: TransactionBatch = {
      id,
      name,
      transactions: [],
      status: 'building',
      totalEstimatedGas: 0,
      createdAt: Date.now(),
    };

    this.batches.set(id, batch);
    logger.info(`[TransactionBuilder] Created batch: ${name} (${id})`);
    return batch;
  }

  /**
   * Add a transaction to a batch.
   * @param batchId - Batch ID
   * @param tx - UnsignedTransaction to add
   */
  addToBatch(batchId: string, tx: UnsignedTransaction): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }
    if (batch.status !== 'building') {
      throw new Error(`Cannot add to batch ${batchId} — status is ${batch.status}`);
    }

    batch.transactions.push(tx);
    batch.totalEstimatedGas += tx.gasLimit;

    logger.info(
      `[TransactionBuilder] Added ${tx.id} to batch ${batchId} (${batch.transactions.length} txs)`
    );
  }

  /**
   * Simulate all transactions in a batch.
   * @param batchId - Batch ID
   * @returns Array of simulation results
   */
  async simulateBatch(batchId: string): Promise<SimulationResult[]> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    logger.info(
      `[TransactionBuilder] Simulating batch ${batchId}: ${batch.transactions.length} transactions`
    );

    const results: SimulationResult[] = [];
    let totalGas = 0;
    let allSuccess = true;

    for (const tx of batch.transactions) {
      const result = await this.simulateTransaction(tx);
      results.push(result);
      totalGas += result.gasUsed;
      if (!result.success) allSuccess = false;
    }

    batch.totalEstimatedGas = totalGas;
    batch.status = allSuccess ? 'simulated' : 'failed';

    logger.info(
      `[TransactionBuilder] Batch ${batchId} simulation: ${allSuccess ? 'ALL PASSED' : 'SOME FAILED'} (total gas: ${totalGas})`
    );

    return results;
  }

  /**
   * Queue all transactions in a batch for processing.
   * @param batchId - Batch ID
   * @param priority - Priority for all transactions in the batch
   * @returns Array of queued transaction entries
   */
  queueBatch(batchId: string, priority: number = 0): QueuedTransaction[] {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const queued: QueuedTransaction[] = [];
    for (const tx of batch.transactions) {
      try {
        const entry = this.queueTransaction(tx, priority);
        queued.push(entry);
      } catch (err: any) {
        logger.warn(`[TransactionBuilder] Failed to queue ${tx.id} from batch: ${err.message}`);
      }
    }

    batch.status = 'ready';
    logger.info(
      `[TransactionBuilder] Queued ${queued.length}/${batch.transactions.length} txs from batch ${batchId}`
    );

    return queued;
  }

  /**
   * Get a batch by ID.
   * @param batchId - Batch ID
   */
  getBatch(batchId: string): TransactionBatch | undefined {
    return this.batches.get(batchId);
  }

  /**
   * List all batches.
   */
  listBatches(): TransactionBatch[] {
    return Array.from(this.batches.values());
  }

  /**
   * Delete a batch.
   * @param batchId - Batch ID
   */
  deleteBatch(batchId: string): boolean {
    const deleted = this.batches.delete(batchId);
    if (deleted) {
      logger.info(`[TransactionBuilder] Deleted batch: ${batchId}`);
    }
    return deleted;
  }

  // ---- Status & Utilities ----

  /**
   * Get a summary of the queue and batches for debugging/display.
   */
  getStatus(): {
    queueSize: number;
    pending: number;
    processing: number;
    simulated: number;
    ready: number;
    failed: number;
    cancelled: number;
    batches: number;
    historySize: number;
  } {
    const all = Array.from(this.queue.values());
    return {
      queueSize: all.length,
      pending: all.filter((q) => q.status === 'pending').length,
      processing: all.filter((q) => q.status === 'processing').length,
      simulated: all.filter((q) => q.status === 'simulated').length,
      ready: all.filter((q) => q.status === 'ready').length,
      failed: all.filter((q) => q.status === 'failed').length,
      cancelled: all.filter((q) => q.status === 'cancelled').length,
      batches: this.batches.size,
      historySize: this.history.length,
    };
  }

  /**
   * Clear all pending/failed transactions from the queue.
   * Moves them to history first.
   */
  clearQueue(): number {
    let cleared = 0;
    for (const [id, queued] of this.queue.entries()) {
      if (queued.status === 'pending' || queued.status === 'failed' || queued.status === 'cancelled') {
        this.history.push(queued);
        this.queue.delete(id);
        cleared++;
      }
    }
    if (this.history.length > this.maxHistorySize) {
      this.history.splice(0, this.history.length - this.maxHistorySize);
    }
    logger.info(`[TransactionBuilder] Cleared ${cleared} transactions from queue`);
    return cleared;
  }

  /**
   * Full reset: clear queue, history, and batches.
   */
  reset(): void {
    this.queue.clear();
    this.batches.clear();
    this.history = [];
    txIdCounter = 0;
    batchIdCounter = 0;
    logger.info('[TransactionBuilder] Reset complete — all data cleared');
  }
}

// ---- Singleton ----

export const transactionBuilder = new TransactionBuilder();
export default transactionBuilder;
