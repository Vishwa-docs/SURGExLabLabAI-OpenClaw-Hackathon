# SURGE Skill API Reference — RIDHWAN

> Source: SURGE OpenClaw Skill v8.0.0 (github.com/SURGE-xyz/skills)

## Base URL
```
https://back.surge.xyz
```

## Authentication
```
X-API-Key: sk-surge-...
```
Get key at: app.surge.xyz → Profile → API Keys. Max 5 active keys.

---

## Endpoints Quick Reference

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/openclaw/launch-info` | Live config: fees, chains, categories |
| `POST` | `/openclaw/wallet/create` | Create EVM wallet |
| `POST` | `/openclaw/wallet/create-solana` | Create Solana wallet |
| `GET` | `/openclaw/wallet/:walletId` | Wallet info |
| `GET` | `/openclaw/wallet/:walletId/balance` | On-chain native balance |
| `POST` | `/openclaw/wallet/:walletId/token-balance` | ERC-20/SPL token balance |
| `POST` | `/openclaw/wallet/:walletId/fund` | One-time free funding |
| `GET` | `/openclaw/wallet/:walletId/history` | Trade history (paginated) |
| `POST` | `/openclaw/tx-status` | Check transaction status |
| `POST` | `/openclaw/launch` | Launch EVM token |
| `POST` | `/openclaw/launch-solana` | Launch Solana token |
| `POST` | `/openclaw/token-status` | Check token phase |
| `POST` | `/openclaw/quote` | Price quote (post-DEX only) |
| `POST` | `/openclaw/buy` | Buy EVM tokens |
| `POST` | `/openclaw/sell` | Sell EVM tokens |
| `POST` | `/openclaw/buy-solana` | Buy Solana tokens |
| `POST` | `/openclaw/sell-solana` | Sell Solana tokens |
| `POST` | `/openclaw/transfer/native-evm` | Transfer ETH/BNB |
| `POST` | `/openclaw/transfer/erc20` | Transfer ERC-20 tokens |
| `POST` | `/openclaw/transfer/solana` | Transfer SOL/SPL tokens |
| `POST` | `/openclaw/erc20/transfer-ownership` | Transfer contract ownership |
| `POST` | `/openclaw/erc20/renounce-ownership` | Renounce ownership (irreversible!) |

---

## Key Flows

### Step 0: Load Config
```
GET /openclaw/launch-info
```
Returns live fees, chains (Base chainId "1", Solana chainId "3"), categories, file limits.

### Step 1: Create Wallet
```
POST /openclaw/wallet/create         (EVM)
POST /openclaw/wallet/create-solana  (Solana)
```
Response: `{walletId, address, chainType, needsFunding, isNew}`

### Step 2: Fund Wallet (ONE TIME FREE)
```
POST /openclaw/wallet/{walletId}/fund
```

### Step 3: Check Balance
```
GET /openclaw/wallet/{walletId}/balance
```
Response: `{balance, sufficient, minRequired}`

### Step 4: Launch Token
**EVM:**
```json
POST /openclaw/launch
{
  "name": "Token Name",
  "ticker": "TKN",
  "description": "What it does",
  "logoUrl": "https://direct-image-link.png",
  "chainId": "1",
  "walletId": "YOUR_WALLET_ID",
  "ethAmount": "0.01"
}
```
Optional: `bannerUrl`, `fullDescription`, `category`, `pitchDeckUrl`, `whitepaperUrl`, `websiteLink`, `githubLink`, `telegramLink`, `discordLink`, `xLink`, `teamShortDescription`

**Solana:**
```json
POST /openclaw/launch-solana
{
  "name": "...", "ticker": "...", "description": "...",
  "logoUrl": "...", "chainId": "3", "walletId": "...",
  "preBuyAmount": "0.5"
}
```
Optional: `fundraisingMint` ("SOL" or "USD1", default "SOL")

### Trading (Auto-Routes Pre/Post DEX)
```
POST /openclaw/buy           {chainId, walletId, tokenAddress, ethAmount, amountOutMin: "0"}
POST /openclaw/sell          {chainId, walletId, tokenAddress, tokenAmount, amountOutMin: "0"}
POST /openclaw/buy-solana    {chainId, walletId, mintAddress, solAmount}
POST /openclaw/sell-solana   {chainId, walletId, mintAddress, tokenAmount}
POST /openclaw/token-status  {chainId, tokenAddress}  → phase: bonding_curve|migrated_to_dex
POST /openclaw/quote         {chainId, tokenAddress, amount, side}  → post-DEX only
```

### Transfers
```
POST /openclaw/transfer/native-evm  {chainId, walletId, toAddress, nativeAmount}
POST /openclaw/transfer/erc20       {chainId, walletId, tokenAddress, toAddress, tokenAmount}
POST /openclaw/transfer/solana      {chainId, walletId, toAddress, amount, mintAddress?}
```

### Ownership Management (EVM Only)
```
POST /openclaw/erc20/transfer-ownership  {chainId, walletId, tokenAddress, newOwner}
POST /openclaw/erc20/renounce-ownership  {chainId, walletId, tokenAddress}  ⚠️ IRREVERSIBLE
```

---

## Amount Format Rules (CRITICAL)
- **Always human-readable strings**: `"0.01"`, `"1000"`, `"500.5"`
- **NEVER wei/lamports/raw**: ❌ `"1000000000000000000"`
- Pattern: `^(0|[1-9]\d*)(\.\d+)?$`
- Max length: 30 characters

## Error Handling
| Status | Meaning | Action |
|--------|---------|--------|
| 200/201 | Success | Parse response |
| 400 | Bad request | Check error code |
| 401 | Bad API key | Re-generate key |
| 403 | Banned | DO NOT RETRY |
| 429 | Rate limited | Back off 10-30s |
| 500 | Server error | Retry once after 30s |

Key error codes: `INSUFFICIENT_BALANCE`, `CONTRACT_REVERT`, `GAS_ESTIMATION_FAILED`, `NONCE_ERROR`, `SIMULATION_FAILED`, `TX_EXPIRED`, `NO_ROUTE`

## Rate Limits
| Endpoint | Limit/min |
|----------|-----------|
| launch-info | 30 |
| launch | 5 |
| wallet/create | 5 |
| balance | 10 |
| buy/sell | 10 |
| transfers | 10 |

**Progressive auto-ban:** 10 violations in 5 min → Strike 1: 1h ban → Strike 2: 24h → Strike 3+: permanent

---

*Last updated: February 2026*
