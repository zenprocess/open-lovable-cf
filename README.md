# AI UI Builder

AI-powered React UI sandbox — fork of [open-lovable-cf](https://github.com/zenprocess/open-lovable-cf) with E2B sandbox execution, multi-provider AI routing, and Claude Code integration.

Built on Next.js App Router. Runs standalone or embedded in the QuiClaude workspace.

---

## Quick Start

```bash
cd ui-builder
pnpm install
cp .env.example .env.local  # then fill in your keys
pnpm dev                     # http://localhost:3000
```

Minimum required keys: `E2B_API_KEY` and one AI provider key (`GEMINI_API_KEY` recommended).

---

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/generate-ai-code-stream` | Stream AI-generated React code |
| `POST /api/apply-ai-code` | Apply AI edits to sandbox files |
| `POST /api/apply-ai-code-stream` | Stream AI edits |
| `POST /api/create-ai-sandbox` | Spin up an E2B sandbox |
| `POST /api/create-ai-sandbox-v2` | Sandbox v2 (package auto-install) |
| `POST /api/kill-sandbox` | Terminate sandbox |
| `POST /api/load-project` | Load project files into sandbox |
| `POST /api/get-sandbox-files` | List files in sandbox |
| `POST /api/detect-and-install-packages` | Auto-detect and install npm deps |
| `POST /api/install-packages` | Install packages in sandbox |
| `POST /api/create-zip` | Package sandbox as zip |
| `POST /api/analyze-edit-intent` | Pre-edit intent analysis |
| `POST /api/extract-brand-styles` | Extract styles via Firecrawl |
| `GET  /api/conversation-state` | Retrieve conversation state |
| `GET  /api/check-vite-errors` | Check Vite build errors |
| `POST /api/monitor-vite-logs` | Stream Vite dev logs |
| `POST /api/project-instructions` | Set per-project AI instructions |

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `E2B_API_KEY` | Yes | E2B sandbox API key |
| `GEMINI_API_KEY` | Yes* | Google Gemini (default AI provider) |
| `ANTHROPIC_API_KEY` | Optional | Claude provider |
| `OPENAI_API_KEY` | Optional | OpenAI provider |
| `GROQ_API_KEY` | Optional | Groq provider |
| `FIRECRAWL_API_KEY` | Optional | Brand style extraction |

*One AI provider key is required. Gemini is the default.
