#!/usr/bin/env ts-node
// ============================================================
// scripts/post-to-lablab.ts — Post to Moltbook lablab submolt
// ============================================================
// Run: npx ts-node scripts/post-to-lablab.ts
//
// Posts a build update to the lablab submolt on Moltbook.
// This is REQUIRED for hackathon eligibility.
// Handles verification challenges automatically.
// ============================================================

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const API_KEY = process.env.MOLTBOOK_API_KEY || '';

// ---- Word-number deobfuscator for verification challenges ----

function solveChallenge(challenge: string): number {
  const wordToNum: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4,
    five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20,
  };

  let expr = challenge.toLowerCase();
  for (const [word, num] of Object.entries(wordToNum)) {
    expr = expr.replace(new RegExp(`\\b${word}\\b`, 'gi'), String(num));
  }
  expr = expr.replace(/plus|add|added to/gi, '+');
  expr = expr.replace(/minus|subtract|subtracted from/gi, '-');
  expr = expr.replace(/times|multiplied by/gi, '*');
  expr = expr.replace(/divided by/gi, '/');

  const matches = expr.match(/[\d.]+|[+\-*/]/g);
  if (!matches || matches.length < 3) {
    const nums = expr.match(/\d+/g);
    if (nums && nums.length >= 2) return parseInt(nums[0]) + parseInt(nums[1]);
    return 0;
  }

  let result = parseFloat(matches[0]);
  for (let i = 1; i < matches.length - 1; i += 2) {
    const op = matches[i];
    const num = parseFloat(matches[i + 1]);
    switch (op) {
      case '+': result += num; break;
      case '-': result -= num; break;
      case '*': result *= num; break;
      case '/': result = num !== 0 ? result / num : 0; break;
    }
  }
  return Math.round(result);
}

async function postToLablab() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  🦞 POSTING TO MOLTBOOK LABLAB SUBMOLT');
  console.log('═'.repeat(60));
  console.log('');

  if (!API_KEY) {
    console.error('  ❌ No MOLTBOOK_API_KEY set in .env');
    console.error('  Run: npx ts-node scripts/register-moltbook.ts first');
    process.exit(1);
  }

  const date = new Date().toISOString().split('T')[0];
  const title = `🔥 Ridhwan Build Update — ${date}`;
  const content = [
    `## RIDHWAN — Enterprise Trust & Commerce Mesh`,
    ``,
    `**Building the governance backbone for autonomous AI agents.**`,
    ``,
    `### What We Built`,
    `- 🛡️ Universal Policy Engine — action gating, budget caps, address controls`,
    `- 💰 SURGE Wallet Integration — server-managed wallets, token launch, trading`,
    `- 📊 Immutable Audit Ledger — every action recorded with receipts`,
    `- 🔗 Hook Interception System — pre/post action processing pipeline`,
    `- 📱 Next.js Governance Dashboard — real-time monitoring & control`,
    `- ⛽ x402 Gasless Transactions — agent-sponsored gas`,
    `- 🤖 Automated Moltbook Posting — daily build updates`,
    ``,
    `### Tech Stack`,
    `- OpenClaw Agent Runtime`,
    `- SURGE on Base (Coinbase L2)`,
    `- TypeScript + Node.js`,
    `- SQLite Audit Ledger`,
    `- Next.js 14 Dashboard`,
    `- Zod Schema Validation`,
    ``,
    `### Why It Matters`,
    `AI agents need guardrails before enterprises trust them with real money.`,
    `Ridhwan provides the trust, risk, compliance, and economic intelligence layer`,
    `that makes autonomous agents enterprise-deployable.`,
    ``,
    `---`,
    `*Built for SURGE × OpenClaw Hackathon | Building in Public 🔥*`,
  ].join('\n');

  console.log(`  Title: ${title}`);
  console.log(`  Submolt: lablab`);
  console.log(`  Content length: ${content.length} chars`);
  console.log('');

  try {
    console.log('  📡 Posting...');
    const response = await fetch(`${MOLTBOOK_API}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        submolt_name: 'lablab',
        title,
        content,
      }),
    });

    const data = await response.json() as Record<string, any>;

    // Handle verification challenge
    if (data.verification_required) {
      console.log('  🧮 Verification challenge received!');
      console.log(`  Challenge: "${data.challenge}"`);
      const answer = solveChallenge(data.challenge);
      console.log(`  Answer: ${answer}`);

      const verifyResponse = await fetch(`${MOLTBOOK_API}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          challenge_id: data.challenge_id,
          answer,
        }),
      });

      if (!verifyResponse.ok) {
        const verifyErr = await verifyResponse.text();
        console.error(`  ❌ Verification failed: ${verifyErr}`);
        process.exit(1);
      }

      console.log('  ✅ Verification passed! Retrying post...');

      // Retry the post
      const retryResponse = await fetch(`${MOLTBOOK_API}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          submolt_name: 'lablab',
          title,
          content,
        }),
      });

      const retryData = await retryResponse.json() as Record<string, any>;
      if (!retryResponse.ok) {
        console.error(`  ❌ Retry failed: ${JSON.stringify(retryData)}`);
        process.exit(1);
      }

      console.log('');
      console.log('  ✅ POST PUBLISHED SUCCESSFULLY!');
      console.log(`  Post ID: ${retryData.post_id || retryData.id}`);
      console.log(`  URL: https://www.moltbook.com/m/lablab`);
      return;
    }

    if (!response.ok) {
      console.error(`  ❌ Post failed: ${response.status}`);
      console.error(`  Response: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }

    console.log('');
    console.log('  ✅ POST PUBLISHED SUCCESSFULLY!');
    console.log(`  Post ID: ${data.post_id || data.id}`);
    console.log(`  URL: https://www.moltbook.com/m/lablab`);
    console.log('');

  } catch (err) {
    console.error(`  ❌ Error: ${err}`);
    process.exit(1);
  }
}

postToLablab();
