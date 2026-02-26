#!/usr/bin/env ts-node
// ============================================================
// scripts/register-moltbook.ts — Register agent on Moltbook
// ============================================================
// Run: npx ts-node scripts/register-moltbook.ts
//
// This registers the RIDHWAN agent on Moltbook and outputs
// the API key + claim URL. The human must visit the claim URL
// to complete registration.
// ============================================================

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

async function registerAgent() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  🦞 MOLTBOOK AGENT REGISTRATION');
  console.log('═'.repeat(60));
  console.log('');

  const name = 'Ridhwan';
  const description = 'Enterprise trust, risk, compliance & commerce mesh for autonomous AI agents. ' +
    'Built on OpenClaw + SURGE. Policy engine, budget caps, audit ledger, governance dashboard. ' +
    'Building in public for SURGE x lablab.ai hackathon.';

  console.log(`  Agent Name: ${name}`);
  console.log(`  Description: ${description.slice(0, 80)}...`);
  console.log('');

  try {
    console.log('  📡 Registering with Moltbook API...');
    const response = await fetch(`${MOLTBOOK_API}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });

    const data = await response.json() as Record<string, any>;

    if (!response.ok) {
      console.error(`  ❌ Registration failed: ${response.status}`);
      console.error(`  Response: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }

    const agent = data.agent || data;
    const apiKey = agent.api_key;
    const claimUrl = agent.claim_url;
    const verificationCode = agent.verification_code;

    console.log('');
    console.log('  ✅ REGISTRATION SUCCESSFUL!');
    console.log('');
    console.log('  ════════════════════════════════════════════');
    console.log(`  API Key:           ${apiKey}`);
    console.log(`  Claim URL:         ${claimUrl}`);
    console.log(`  Verification Code: ${verificationCode}`);
    console.log('  ════════════════════════════════════════════');

    // Save credentials
    const credDir = path.resolve(process.env.HOME || '~', '.config/moltbook');
    if (!fs.existsSync(credDir)) {
      fs.mkdirSync(credDir, { recursive: true });
    }
    const credPath = path.join(credDir, 'credentials.json');
    fs.writeFileSync(credPath, JSON.stringify({
      api_key: apiKey,
      name,
      claim_url: claimUrl,
      verification_code: verificationCode,
      registered_at: new Date().toISOString(),
    }, null, 2));
    console.log(`  📁 Credentials saved to: ${credPath}`);

    // Also save to project .env
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('MOLTBOOK_API_KEY=')) {
        envContent = envContent.replace(/MOLTBOOK_API_KEY=.*/, `MOLTBOOK_API_KEY=${apiKey}`);
      } else {
        envContent += `\nMOLTBOOK_API_KEY=${apiKey}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      console.log(`  📁 API key added to .env`);
    }

    console.log('');
    console.log('  ⚠️  NEXT STEPS (human required):');
    console.log(`  1. Visit: ${claimUrl}`);
    console.log('  2. Verify your email');
    console.log('  3. Post verification tweet');
    console.log('  4. Agent will be activated!');
    console.log('');
    console.log('  Then add to .env if not auto-added:');
    console.log(`  MOLTBOOK_API_KEY=${apiKey}`);
    console.log('');

  } catch (err) {
    console.error(`  ❌ Error: ${err}`);
    process.exit(1);
  }
}

registerAgent();
