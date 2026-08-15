# AGENTS.md

Guidance for AI agents (and humans) working on this repository.

## What this is

`dsh-web-search` is a static bundle plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
it registers a `web-access` search/fetch provider into the harness `web` seam (so the built-in
`web_search` / `web_fetch` tools are powered by this plugin) and provides a settings card.
It is a port of [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access).

## Layout

- `package.json` — DSH bundle metadata: `dsh.bundle.patch` (host composition row) + `dsh.client` (browser half)
- `cordis.patch.yml` — sets `web.searchProvider: web-access` and inserts the host plugin row
- `dsh.plugin.json` — ecosystem plugin manifest (id / version / client main)
- `lib/index.js` — host half: fetch-based HTTP layer, search providers + fallback chain,
  content extraction, the `get_search_content` tool, and the `web-access` providers
- `lib/client.js` — browser half: settings card (`settings.plugin.item` slot)
- `tests/parse.test.mjs` — unit tests for the pure parsing/extraction helpers

## Key facts

- The host runs plain Node: native `fetch`, `Buffer`, no sandbox restrictions.
- The browser half is a `window.__ModuleLoader__.load({ id, factory })` bundle; `exports.apply`,
  `exports.inject` are required; React is `require('react')`.
- Keys resolve from env vars first, then the harness `credentials` service
  (credential refs: `SEARXNG_BASE_URL`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, `PIWA_SEARCH_ENABLED`).
- `PIWA_SEARCH_ENABLED` presence toggles the default engine: on = fallback chain,
  off = delegation to the official DeepSeek search provider.
- Model-facing text (tool descriptions, errors) must stay English; UI strings live in the
  client locale dictionary.

## Dev workflow

- Syntax check: `node --check lib/index.js lib/client.js`
- Unit tests: `node --test tests/`
- Install locally: `dsh plugin --profile web add .` (from the repo root), then restart DSH.
  Host-side changes need a DSH restart; client bundle changes apply on page refresh
  (served from disk); tool registrations apply per session.
- CI runs the checks above on push/PR.

## Conventions

- English only in code, comments and model-facing text (Chinese docs live in README.md).
- Keep the pure helpers (htmlToText, parseDdg, …) side-effect free and exported — tests depend on it.
- Update `README.md` / `README.en.md` and `dsh.plugin.json` version when behavior changes.
