# dsh-web-search

[中文](README.md) · [English](README.en.md)

[![npm version](https://img.shields.io/npm/v/dsh-web-search.svg)](https://www.npmjs.com/package/dsh-web-search)
[![License: MIT](https://img.shields.io/npm/l/dsh-web-search.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/haibinwang9/dsh-web-search/ci.yml)](https://github.com/haibinwang9/dsh-web-search/actions)

> **Ported from [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access)** (MIT) for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): the search fallback chain, the DuckDuckGo parser and the content-extraction logic come from that project, adapted to use native Node `fetch`. Thanks to the original author.

## What it does

**One plugin that completes the DeepSeek Harness's web capabilities:**

- 🔍 **Multi-engine search with automatic fallback** — powers the built-in `web_search` tool: SearXNG → Tavily → Brave → **keyless DuckDuckGo fallback**. Unconfigured providers are skipped; **it works with no keys at all**.
- 📄 **URL content extraction** — the `get_search_content` tool fetches any page and converts HTML to readable plain text (prefers the main content, strips scripts/styles), pretty-prints JSON, and flags binary content.
- 🎚️ **One-click default search engine switch** — settings toggle: on = use this plugin's fallback chain, off = delegate to the official DeepSeek search.
- 🛠️ **Completes the fetch seam** — registers both search and fetch providers, which also makes the built-in `web_fetch` usable (the fetch seam normally has no provider).
- ⚙️ **All configuration in the settings page** — the three keys (SearXNG / Tavily / Brave) are managed as cards in the harness credentials service; no config files to edit.

## Install

**From npm (recommended):**

```sh
dsh plugin --profile web add dsh-web-search
```

**From source:**

```sh
git clone https://github.com/haibinwang9/dsh-web-search.git
cd dsh-web-search && dsh plugin --profile web add .
```

Restart DSH after installing, then configure keys/toggle at **Settings → Plugins → Web access**.

## Configuration

| Field | Credential ref | Notes |
|---|---|---|
| Use this plugin as the default search engine | `PIWA_SEARCH_ENABLED` | On = fallback chain; off = official DeepSeek search |
| SearXNG base URL | `SEARXNG_BASE_URL` | e.g. `https://search.example.com` |
| Tavily API Key | `TAVILY_API_KEY` | https://app.tavily.com |
| Brave API Key | `BRAVE_API_KEY` | https://brave.com/search/api/ |

Resolution order: environment variables → harness credentials service (also writable via `~/.dsh/.credentials.yaml`).

## Tools

| Tool | Description |
|---|---|
| `web_search` | Built-in search tool, powered by this plugin's fallback chain |
| `get_search_content` | Fetch a URL and extract its readable text content |

## How it works

```
web_search ──▶ ctx.web.search() ──▶ 'web-access' provider
                                         │
                      PIWA_SEARCH_ENABLED? ── yes ──▶ SearXNG → Tavily → Brave → DuckDuckGo
                                         │
                                         └── no ──▶ official DeepSeek search
```

## License

MIT — search and content-extraction logic adapted from [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) (MIT).
