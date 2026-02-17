# OpenClaw Framework Reference — RIDHWAN

> Source: docs.openclaw.ai

## Overview
OpenClaw is a **self-hosted AI agent gateway** that connects agents to external channels (WhatsApp, Telegram, Discord, iMessage, API) while providing hooks, cron, memory, and skills.

- **License:** MIT
- **Runtime:** Node.js 22+ required
- **Dashboard:** Control UI at port 18789

## Install
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw gateway --port 18789
```

Config stored at: `~/.openclaw/openclaw.json`
Dashboard: http://127.0.0.1:18789/

## Directory Structure
```
~/openclaw/
├── me.md             # Agent persona
├── skills/           # Agent skills (SKILL.md + handler)
├── hooks/            # Event-driven automation
├── cron/             # Scheduled tasks (jobs.json)
├── memory/           # Markdown knowledge files (vector-indexed)
└── .openclaw/        # Framework internals
```

## Skills System
Skills are structured Markdown instructions for AI agents. Each skill = a folder with `SKILL.md` and optionally a handler.

### SKILL.md Format
```markdown
---
name: my-skill
description: What it does
version: 1.0.0
auth:
  type: api-key
  header: X-API-Key
---
# Skill Instructions
...
```

### Installing SURGE Skill
```bash
mkdir -p ~/openclaw/skills/surge
curl -s https://raw.githubusercontent.com/SURGE-xyz/skills/main/surge-openclaw/SKILL.md > ~/openclaw/skills/surge/SKILL.md
```

### Installing Moltbook Skill
```bash
mkdir -p ~/.moltbot/skills/moltbook
curl -s https://www.moltbook.com/skill.md > ~/.moltbot/skills/moltbook/SKILL.md
curl -s https://www.moltbook.com/heartbeat.md > ~/.moltbot/skills/moltbook/HEARTBEAT.md
curl -s https://www.moltbook.com/messaging.md > ~/.moltbot/skills/moltbook/MESSAGING.md
curl -s https://www.moltbook.com/rules.md > ~/.moltbot/skills/moltbook/RULES.md
```

## Hooks System
Hooks let agents respond to events. Each hook = folder with `HOOK.md` + `handler.ts`.

## Cron System
Scheduled tasks via `cron/jobs.json`.

## Memory System
Markdown files in `memory/` are vector-indexed for semantic retrieval.

## Multi-Channel Support
- WhatsApp
- Telegram
- Discord
- iMessage
- Signal
- Web (WebChat)
- API

## Multi-Agent Routing
Route messages to different agents based on content/channel.

## Key Features
- Plugin channels
- Session management
- Model failover
- OAuth support
- Sub-agents
- Elevated mode (admin)
- Voice support

---

*Last updated: February 2026*
