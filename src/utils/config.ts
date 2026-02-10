// ============================================================
// src/utils/config.ts — Centralized configuration loader
// ============================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  agent: {
    name: process.env.AGENT_NAME || 'ridhwan-agent-01',
    id: process.env.AGENT_ID || `agent-${Date.now()}`,
  },

  surge: {
    /** SURGE API base URL — always https://back.surge.xyz */
    apiUrl: process.env.SURGE_API_URL || 'https://back.surge.xyz',
    /** SURGE API key (sk-surge-...) — get at app.surge.xyz → Profile → API Keys */
    apiKey: process.env.SURGE_API_KEY || '',
    /** Wallet ID returned by POST /openclaw/wallet/create */
    walletId: process.env.SURGE_WALLET_ID || '',
    /** Default chain ID: "1" = Base */
    chainId: process.env.SURGE_CHAIN_ID || '1',
  },

  x402: {
    endpoint: process.env.X402_ENDPOINT || 'https://x402.org/api',
    apiKey: process.env.X402_API_KEY || '',
  },

  moltbook: {
    /** Moltbook API — MUST use www subdomain */
    apiUrl: process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1',
    apiKey: process.env.MOLTBOOK_API_KEY || '',
    submolt: process.env.MOLTBOOK_SUBMOLT || 'lablab',
  },

  social: {
    twitterApiKey: process.env.TWITTER_API_KEY || '',
    twitterApiSecret: process.env.TWITTER_API_SECRET || '',
    twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || '',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  },

  llm: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    azureOpenaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    azureOpenaiApiKey: process.env.AZURE_OPENAI_API_KEY || '',
    azureOpenaiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
    azureOpenaiApiVersion: process.env.AZURE_OPENAI_API_VERSION || '',
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY || '',
  },

  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey: process.env.LANGFUSE_SECRET_KEY || '',
    host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
  },

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  db: {
    path: process.env.DB_PATH || './data/ridhwan.db',
  },
};

export default config;
