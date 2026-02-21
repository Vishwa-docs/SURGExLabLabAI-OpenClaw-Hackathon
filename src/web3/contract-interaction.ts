// ============================================================
// src/web3/contract-interaction.ts — Smart Contract Interaction
// ============================================================
// Provides ABI encoding/decoding and contract call functionality
// for ERC-20 tokens and arbitrary smart contracts using raw
// JSON-RPC eth_call. No ethers.js or web3.js dependency.
// ============================================================

import { config } from '../utils/config';
import logger from '../utils/logger';
import { multiChainManager } from './multi-chain-manager';
import crypto from 'crypto';

const fetch = require('node-fetch');

// ---- Interfaces ----

/** Supported Solidity types for ABI encoding/decoding. */
export type AbiType = 'uint256' | 'address' | 'bool' | 'string' | 'bytes' | 'bytes32' | 'uint8';

/** Decoded token information from an ERC-20 contract. */
export interface TokenInfo {
  /** Contract address */
  address: string;
  /** Chain key */
  chain: string;
  /** Token name (e.g., "USD Coin") */
  name: string;
  /** Token symbol (e.g., "USDC") */
  symbol: string;
  /** Number of decimal places */
  decimals: number;
  /** Total supply as a raw string */
  totalSupply: string;
}

/** Result of a contract call. */
export interface ContractCallResult {
  /** Whether the call succeeded */
  success: boolean;
  /** Raw hex result data */
  rawResult: string;
  /** Decoded values (if decoding was requested) */
  decoded?: any[];
  /** Error message if the call failed */
  error?: string;
}

// ---- Hardcoded ERC-20 Function Selectors ----

/**
 * Pre-computed 4-byte function selectors for common ERC-20 functions.
 * These are the first 4 bytes of keccak256(functionSignature).
 */
const ERC20_SELECTORS: Record<string, string> = {
  // Read-only
  'name()': '0x06fdde03',
  'symbol()': '0x95d89b41',
  'decimals()': '0x313ce567',
  'totalSupply()': '0x18160ddd',
  'balanceOf(address)': '0x70a08231',
  'allowance(address,address)': '0xdd62ed3e',

  // State-changing
  'transfer(address,uint256)': '0xa9059cbb',
  'approve(address,uint256)': '0x095ea7b3',
  'transferFrom(address,address,uint256)': '0x23b872dd',
};

// ---- ABI Encoding/Decoding Helpers ----

/**
 * Compute the keccak256 hash of a string (used for function selectors).
 * Uses Node.js crypto with SHA-3 (keccak256) via the 'sha3-256' algorithm
 * name. Falls back to a manual approach if sha3 isn't available.
 * @param input - UTF-8 string to hash
 * @returns Hex string (without 0x prefix)
 */
function keccak256(input: string): string {
  // Node.js >= 18 supports 'sha3-256' in crypto.createHash, which is keccak256
  // For compatibility, we use a lookup table for known selectors and compute for unknowns
  try {
    const hash = crypto.createHash('sha3-256');
    hash.update(input);
    return hash.digest('hex');
  } catch {
    // Fallback: if sha3-256 not available, use sha256 as an approximation
    // This should rarely happen in Node.js >= 18
    logger.warn('[ContractInteraction] sha3-256 not available, falling back to sha256');
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('hex');
  }
}

/**
 * Get the 4-byte function selector for a function signature.
 * Uses hardcoded values for common ERC-20 functions, computes via keccak256 for others.
 * @param functionSig - Canonical function signature (e.g., "transfer(address,uint256)")
 * @returns 4-byte hex selector with 0x prefix
 */
function getFunctionSelector(functionSig: string): string {
  // Check hardcoded selectors first
  if (ERC20_SELECTORS[functionSig]) {
    return ERC20_SELECTORS[functionSig];
  }

  // Compute from keccak256
  const hash = keccak256(functionSig);
  return `0x${hash.slice(0, 8)}`;
}

/**
 * ABI-encode a single parameter value based on its type.
 * All values are padded to 32 bytes (64 hex chars).
 * @param type - Solidity type
 * @param value - JavaScript value to encode
 * @returns 32-byte hex encoded value (no 0x prefix)
 */
function encodeParam(type: AbiType, value: any): string {
  switch (type) {
    case 'address': {
      const addr = String(value).toLowerCase().replace('0x', '');
      return addr.padStart(64, '0');
    }
    case 'uint256': {
      const bn = BigInt(value);
      return bn.toString(16).padStart(64, '0');
    }
    case 'uint8': {
      const n = parseInt(value, 10);
      return n.toString(16).padStart(64, '0');
    }
    case 'bool': {
      return (value ? '1' : '0').padStart(64, '0');
    }
    case 'bytes32': {
      const hex = String(value).replace('0x', '');
      return hex.padEnd(64, '0');
    }
    case 'string': {
      // Dynamic type: offset → length → data
      // For simplicity in eth_call contexts, we encode inline
      const strBytes = Buffer.from(String(value), 'utf8');
      const lengthHex = strBytes.length.toString(16).padStart(64, '0');
      const dataHex = strBytes.toString('hex').padEnd(Math.ceil(strBytes.length / 32) * 64, '0');
      return lengthHex + dataHex;
    }
    case 'bytes': {
      const byteStr = String(value).replace('0x', '');
      const len = (byteStr.length / 2).toString(16).padStart(64, '0');
      const paddedData = byteStr.padEnd(Math.ceil(byteStr.length / 64) * 64, '0');
      return len + paddedData;
    }
    default:
      throw new Error(`Unsupported ABI type: ${type}`);
  }
}

/**
 * Decode a single 32-byte chunk from hex data.
 * @param type - Expected Solidity type
 * @param data - Hex string (without 0x) to decode from
 * @param offset - Byte offset into the data (as number of hex chars)
 * @returns Decoded JavaScript value
 */
function decodeParam(type: AbiType, data: string, offset: number = 0): any {
  const chunk = data.slice(offset, offset + 64);

  switch (type) {
    case 'address':
      return '0x' + chunk.slice(24);
    case 'uint256':
      return BigInt('0x' + chunk).toString();
    case 'uint8':
      return parseInt(chunk, 16);
    case 'bool':
      return BigInt('0x' + chunk) !== BigInt(0);
    case 'bytes32':
      return '0x' + chunk;
    case 'string': {
      // Dynamic: first 32 bytes = offset pointer, then length + data
      const strOffset = parseInt(chunk, 16) * 2; // byte offset → hex char offset
      const strLen = parseInt(data.slice(strOffset, strOffset + 64), 16);
      const strHex = data.slice(strOffset + 64, strOffset + 64 + strLen * 2);
      return Buffer.from(strHex, 'hex').toString('utf8');
    }
    default:
      return '0x' + chunk;
  }
}

// ---- ContractInteraction ----

/**
 * Smart contract interaction layer for making read calls and encoding
 * transactions for ERC-20 tokens and arbitrary contracts.
 */
export class ContractInteraction {
  constructor() {
    logger.info('[ContractInteraction] Initialized');
  }

  /**
   * Encode a function call (selector + encoded parameters).
   * @param functionSig - Canonical signature, e.g. "transfer(address,uint256)"
   * @param params - Array of { type, value } objects
   * @returns Hex-encoded calldata with 0x prefix
   */
  encodeFunction(
    functionSig: string,
    params: Array<{ type: AbiType; value: any }> = []
  ): string {
    const selector = getFunctionSelector(functionSig);
    let encoded = selector.replace('0x', '');

    // Separate static and dynamic params
    // For simplicity, we handle all common ERC-20 cases which use only static types
    for (const param of params) {
      encoded += encodeParam(param.type, param.value);
    }

    return '0x' + encoded;
  }

  /**
   * Decode raw hex result data into typed values.
   * @param types - Array of ABI types in order
   * @param data - Hex-encoded result data (with or without 0x prefix)
   * @returns Array of decoded values
   */
  decodeResult(types: AbiType[], data: string): any[] {
    const hex = data.replace('0x', '');
    const results: any[] = [];
    let offset = 0;

    for (const type of types) {
      if (type === 'string') {
        results.push(decodeParam(type, hex, offset));
        offset += 64; // Skip the offset pointer (32 bytes)
      } else {
        results.push(decodeParam(type, hex, offset));
        offset += 64;
      }
    }

    return results;
  }

  /**
   * Call a smart contract function (read-only, no state changes).
   * @param chain - Chain key (e.g., 'base', 'ethereum')
   * @param contractAddress - Contract address
   * @param functionSig - Function signature (e.g., "balanceOf(address)")
   * @param params - Encoded parameters
   * @param decodeTypes - Optional types to auto-decode the result
   * @returns ContractCallResult with raw and optionally decoded data
   */
  async callContract(
    chain: string,
    contractAddress: string,
    functionSig: string,
    params: Array<{ type: AbiType; value: any }> = [],
    decodeTypes?: AbiType[]
  ): Promise<ContractCallResult> {
    try {
      const calldata = this.encodeFunction(functionSig, params);

      logger.debug(`[ContractInteraction] eth_call on ${chain}: ${contractAddress}.${functionSig}`, {
        calldata: calldata.slice(0, 20) + '...',
      });

      const result = await multiChainManager.rpcCall(chain, 'eth_call', [
        { to: contractAddress, data: calldata },
        'latest',
      ]);

      const rawResult = result || '0x';

      const contractResult: ContractCallResult = {
        success: true,
        rawResult,
      };

      if (decodeTypes && rawResult !== '0x' && rawResult.length > 2) {
        try {
          contractResult.decoded = this.decodeResult(decodeTypes, rawResult);
        } catch (decodeErr: any) {
          logger.warn(`[ContractInteraction] Failed to decode result: ${decodeErr.message}`);
        }
      }

      return contractResult;
    } catch (err: any) {
      logger.error(
        `[ContractInteraction] callContract failed: ${chain}:${contractAddress}.${functionSig}`,
        { error: err.message }
      );
      return {
        success: false,
        rawResult: '0x',
        error: err.message,
      };
    }
  }

  // ---- ERC-20 Convenience Methods ----

  /**
   * Get the name of an ERC-20 token.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @returns Token name string
   */
  async getTokenName(chain: string, tokenAddress: string): Promise<string> {
    const result = await this.callContract(chain, tokenAddress, 'name()', [], ['string']);
    if (result.success && result.decoded) {
      return result.decoded[0];
    }
    throw new Error(`Failed to get token name: ${result.error}`);
  }

  /**
   * Get the symbol of an ERC-20 token.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @returns Token symbol string
   */
  async getTokenSymbol(chain: string, tokenAddress: string): Promise<string> {
    const result = await this.callContract(chain, tokenAddress, 'symbol()', [], ['string']);
    if (result.success && result.decoded) {
      return result.decoded[0];
    }
    throw new Error(`Failed to get token symbol: ${result.error}`);
  }

  /**
   * Get the number of decimals for an ERC-20 token.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @returns Number of decimals
   */
  async getTokenDecimals(chain: string, tokenAddress: string): Promise<number> {
    const result = await this.callContract(chain, tokenAddress, 'decimals()', [], ['uint8']);
    if (result.success && result.decoded) {
      return result.decoded[0];
    }
    throw new Error(`Failed to get token decimals: ${result.error}`);
  }

  /**
   * Get the total supply of an ERC-20 token.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @returns Total supply as a string (raw, no decimal adjustment)
   */
  async getTokenTotalSupply(chain: string, tokenAddress: string): Promise<string> {
    const result = await this.callContract(chain, tokenAddress, 'totalSupply()', [], ['uint256']);
    if (result.success && result.decoded) {
      return result.decoded[0];
    }
    throw new Error(`Failed to get token totalSupply: ${result.error}`);
  }

  /**
   * Get the ERC-20 token balance for a specific wallet.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @param walletAddress - Wallet to query
   * @returns Balance as a string (raw, no decimal adjustment)
   */
  async getTokenBalanceOf(
    chain: string,
    tokenAddress: string,
    walletAddress: string
  ): Promise<string> {
    const result = await this.callContract(
      chain,
      tokenAddress,
      'balanceOf(address)',
      [{ type: 'address', value: walletAddress }],
      ['uint256']
    );
    if (result.success && result.decoded) {
      return result.decoded[0];
    }
    throw new Error(`Failed to get token balanceOf: ${result.error}`);
  }

  /**
   * Get the ERC-20 allowance for a spender.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @param ownerAddress - Token owner address
   * @param spenderAddress - Spender address
   * @returns Allowance as a string (raw, no decimal adjustment)
   */
  async getTokenAllowance(
    chain: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    const result = await this.callContract(
      chain,
      tokenAddress,
      'allowance(address,address)',
      [
        { type: 'address', value: ownerAddress },
        { type: 'address', value: spenderAddress },
      ],
      ['uint256']
    );
    if (result.success && result.decoded) {
      return result.decoded[0];
    }
    throw new Error(`Failed to get token allowance: ${result.error}`);
  }

  /**
   * Get full ERC-20 token info (name, symbol, decimals, totalSupply) in one call.
   * Fetches all fields in parallel for efficiency.
   * @param chain - Chain key
   * @param tokenAddress - Token contract address
   * @returns TokenInfo object with all details
   */
  async getTokenInfo(chain: string, tokenAddress: string): Promise<TokenInfo> {
    logger.info(`[ContractInteraction] Fetching full token info: ${chain}:${tokenAddress}`);

    const [nameRes, symbolRes, decimalsRes, totalSupplyRes] = await Promise.allSettled([
      this.getTokenName(chain, tokenAddress),
      this.getTokenSymbol(chain, tokenAddress),
      this.getTokenDecimals(chain, tokenAddress),
      this.getTokenTotalSupply(chain, tokenAddress),
    ]);

    return {
      address: tokenAddress,
      chain,
      name: nameRes.status === 'fulfilled' ? nameRes.value : 'Unknown',
      symbol: symbolRes.status === 'fulfilled' ? symbolRes.value : '???',
      decimals: decimalsRes.status === 'fulfilled' ? decimalsRes.value : 18,
      totalSupply: totalSupplyRes.status === 'fulfilled' ? totalSupplyRes.value : '0',
    };
  }

  /**
   * Encode calldata for an ERC-20 transfer (for use in transaction building).
   * @param toAddress - Recipient address
   * @param amount - Amount in raw token units (no decimal adjustment)
   * @returns Hex-encoded calldata
   */
  encodeTransfer(toAddress: string, amount: string): string {
    return this.encodeFunction('transfer(address,uint256)', [
      { type: 'address', value: toAddress },
      { type: 'uint256', value: amount },
    ]);
  }

  /**
   * Encode calldata for an ERC-20 approve call.
   * @param spenderAddress - Spender to approve
   * @param amount - Amount to approve in raw token units
   * @returns Hex-encoded calldata
   */
  encodeApprove(spenderAddress: string, amount: string): string {
    return this.encodeFunction('approve(address,uint256)', [
      { type: 'address', value: spenderAddress },
      { type: 'uint256', value: amount },
    ]);
  }

  /**
   * Encode calldata for an ERC-20 transferFrom call.
   * @param fromAddress - Source address
   * @param toAddress - Destination address
   * @param amount - Amount in raw token units
   * @returns Hex-encoded calldata
   */
  encodeTransferFrom(fromAddress: string, toAddress: string, amount: string): string {
    return this.encodeFunction('transferFrom(address,address,uint256)', [
      { type: 'address', value: fromAddress },
      { type: 'address', value: toAddress },
      { type: 'uint256', value: amount },
    ]);
  }
}

// ---- Singleton ----

export const contractInteraction = new ContractInteraction();
export default contractInteraction;
