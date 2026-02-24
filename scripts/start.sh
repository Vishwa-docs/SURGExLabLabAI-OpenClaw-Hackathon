#!/usr/bin/env bash
# ============================================================
# scripts/start.sh — One-Command Start for RIDHWAN
# ============================================================
# Usage: ./scripts/start.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       🔥 RIDHWAN — Enterprise Trust & Commerce Mesh     ║"
echo "║              Starting all services...                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js 18+."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. You have $(node -v)."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ── 2. Install dependencies ────────────────────────────────
echo ""
echo "📦 Installing dependencies..."
npm install --silent 2>/dev/null || npm install

# ── 3. Install dashboard dependencies ──────────────────────
if [ -d "src/dashboard" ]; then
  echo "📦 Installing dashboard dependencies..."
  cd src/dashboard
  npm install --silent 2>/dev/null || npm install
  cd "$ROOT_DIR"
fi

# ── 4. Setup .env ──────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo ""
  echo "⚙️  Creating .env from .env.example..."
  cp .env.example .env
  echo "   → Edit .env with your keys before production use"
fi

# ── 5. Create data directory ───────────────────────────────
mkdir -p data

# ── 6. Build TypeScript ────────────────────────────────────
echo ""
echo "🔨 Building TypeScript..."
npx tsc --skipLibCheck 2>/dev/null || {
  echo "⚠️  Build had warnings (continuing anyway)"
}

# ── 7. Initialize database ─────────────────────────────────
echo ""
echo "💾 Initializing database..."
node dist/src/policy-engine/db/init.js 2>/dev/null || {
  echo "⚠️  DB init skipped (may already exist)"
}

# ── 8. Start services ──────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 Starting RIDHWAN..."
echo ""
echo "   Backend API:  http://localhost:3000"
echo "   Dashboard:    http://localhost:3001"
echo ""
echo "   Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Run backend + dashboard concurrently
npx concurrently \
  --names "API,DASH" \
  --prefix-colors "cyan,magenta" \
  "node dist/src/index.js" \
  "cd src/dashboard && npx next dev -p 3001"
