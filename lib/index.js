// dsh-web-search —— pi-web-access (https://github.com/nicobailon/pi-web-access) ported to the DSH static host.
// The network layer uses native Node fetch (the remote dynamic-plugin version had
// to go through shell+curl because the dynamic sandbox has no network access).
// Capabilities:
//   1. Multi-provider search with automatic fallback:
//      SearXNG (SEARXNG_BASE_URL) → Tavily (TAVILY_API_KEY) → Brave (BRAVE_API_KEY)
//      → DuckDuckGo (zero-config keyless fallback)
//   2. URL content extraction (HTML→text / pretty JSON / binary flag)
//   3. web seam: registers the 'web-access' search and fetch providers. The fetch seam
//      had no provider at all, so this registration also makes web_fetch usable.
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import {
  DeepSeekSearchProvider, DEEPSEEK_DEFAULT_API_VERSION, DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_DEFAULT_MAX_TOKENS, DEEPSEEK_DEFAULT_MAX_USES, DEEPSEEK_DEFAULT_MODEL,
} from '@deepseek-ai/dsh-web-search-deepseek'

const UA = 'Mozilla/5.0 (compatible; dsh-web-search/1.0; +https://github.com/nicobailon/pi-web-access)'
const msg = (e) => (e && e.message ? String(e.message) : String(e))
/** Default search engine toggle: the piwa chain is active while this credential exists; otherwise delegate to the official DeepSeek search. */
const PIWA_ENABLED_REF = 'PIWA_SEARCH_ENABLED'

// ---- Keys: process env first, then the credentials service ----
const getKey = async (ctx, name) => {
  if (process.env[name]) return process.env[name]
  const creds = ctx.get('credentials')
  if (creds !== undefined) {
    try {
      const r = await creds.resolve(credentialRef(name))
      if (r && r.value) return String(r.value)
    } catch { /* ignore */ }
  }
  return undefined
}

// ---- HTTP: native fetch with timeout / truncation / redirects / cancellation ----
async function httpRequest(opts) {
  const { url, method = 'GET', headers = {}, bodyJson, timeoutMs = 30000, maxBytes = 250000, signal } = opts
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('request timeout after ' + timeoutMs + 'ms')), timeoutMs)
  const onOuter = () => { if (!ctrl.signal.aborted) ctrl.abort(signal.reason || new Error('cancelled')) }
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason || new Error('cancelled'))
    else signal.addEventListener('abort', onOuter, { once: true })
  }
  try {
    const res = await fetch(url, {
      method,
      headers: Object.assign({ 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }, headers),
      body: bodyJson !== undefined ? JSON.stringify(bodyJson) : undefined,
      redirect: 'follow',
      signal: ctrl.signal,
    })
    const ctype = (res.headers.get('content-type') || '').split(';')[0].toLowerCase()
    let size = 0
    const chunks = []
    let truncated = false
    if (res.body) {
      const reader = res.body.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(Buffer.from(value))
            size += value.length
            if (size > maxBytes) { truncated = true; break }
          }
        }
      } finally {
        if (truncated) try { await reader.cancel() } catch { /* ignore */ }
      }
    }
    const bodyText = Buffer.concat(chunks).toString('utf8')
    return { statusCode: res.status, contentType: ctype, finalUrl: res.url, bodyText, size, truncated }
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onOuter)
  }
}

// ---- HTML extraction ----
const decodeEntities = (s) => {
  let out = String(s)
  out = out.replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return m } })
  out = out.replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(parseInt(d, 10)) } catch { return m } })
  out = out.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  out = out.replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
  out = out.replace(/&ldquo;/gi, '\u201c').replace(/&rdquo;/gi, '\u201d')
  return out
}
const htmlToText = (html) => {
  let s = String(html)
  const main = /<\s*(main|article)\b[^>]*>([\s\S]*?)<\/\s*(main|article)>/i.exec(s)
  if (main && main[2]) s = main[2]
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<(br|hr)\s*\/?>/gi, '\n')
  s = s.replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|table|blockquote|pre)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/\n[ \t]+/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

// ---- DuckDuckGo (zero-config, keyless) ----
const decodeDdgUrl = (href) => {
  const m = /[?&]uddg=([^&]+)/.exec(href || '')
  let u = ''
  try { u = m ? decodeURIComponent(m[1]) : (href || '') } catch { return null }
  if (/^https?:\/\//i.test(u)) return u
  if (/^https?:\/\//i.test(href || '')) return href
  return null
}
const parseDdg = (html, max) => {
  const sources = []
  const anchorRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = anchorRe.exec(html)) !== null) {
    if (sources.length >= max) break
    const href = m[1] || ''
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    const url = decodeDdgUrl(href)
    if (!url || !title) continue
    const rest = html.slice(anchorRe.lastIndex, anchorRe.lastIndex + 4000)
    const sn = /<[a-z]+[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i.exec(rest)
    const snippet = sn ? decodeEntities(sn[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : ''
    sources.push({ url, title, snippet })
  }
  return sources
}

// ---- Search providers ----
async function searxngSearch(ctx, query, maxResults, signal) {
  const base = await getKey(ctx, 'SEARXNG_BASE_URL')
  if (!base) throw new Error('SEARXNG_BASE_URL not configured')
  const r = await httpRequest({ url: base.replace(/\/+$/, '') + '/search?q=' + encodeURIComponent(query) + '&format=json', headers: { accept: 'application/json' }, maxBytes: 100000, timeoutMs: 25000, signal })
  if (r.statusCode !== 200) throw new Error('SearXNG HTTP ' + r.statusCode)
  let data
  try { data = JSON.parse(r.bodyText) } catch (e) { throw new Error('SearXNG invalid JSON: ' + msg(e)) }
  const sources = ((data.results || []).filter((x) => x && x.url).slice(0, maxResults)).map((x) => ({ url: x.url, title: x.title || x.url, snippet: x.content || '' }))
  if (sources.length === 0) throw new Error('SearXNG returned no results')
  const answers = (data.answers || []).filter((a) => typeof a === 'string' && a.trim())
  return { provider: 'searxng', content: answers.length > 0 ? answers.join('\n') : undefined, sources }
}
async function tavilySearch(ctx, query, maxResults, signal) {
  const key = await getKey(ctx, 'TAVILY_API_KEY')
  if (!key) throw new Error('TAVILY_API_KEY not configured')
  const r = await httpRequest({
    url: 'https://api.tavily.com/search', method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    bodyJson: { query, max_results: Math.min(maxResults, 20), include_answer: 'basic', search_depth: 'basic' },
    maxBytes: 200000, timeoutMs: 25000, signal,
  })
  if (r.statusCode !== 200) throw new Error('Tavily API ' + r.statusCode + ': ' + r.bodyText.slice(0, 300))
  let data
  try { data = JSON.parse(r.bodyText) } catch (e) { throw new Error('Tavily invalid JSON: ' + msg(e)) }
  const sources = ((data.results || []).filter((x) => x && x.url).slice(0, maxResults)).map((x) => ({ url: x.url, title: x.title || 'Source', snippet: (x.content || '').replace(/\s+/g, ' ').trim() }))
  return { provider: 'tavily', content: typeof data.answer === 'string' && data.answer ? data.answer : undefined, sources }
}
async function braveSearch(ctx, query, maxResults, signal) {
  const key = await getKey(ctx, 'BRAVE_API_KEY')
  if (!key) throw new Error('BRAVE_API_KEY not configured')
  const r = await httpRequest({ url: 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=' + maxResults, headers: { 'x-subscription-token': key }, maxBytes: 100000, timeoutMs: 25000, signal })
  if (r.statusCode !== 200) throw new Error('Brave API ' + r.statusCode + ': ' + r.bodyText.slice(0, 300))
  let data
  try { data = JSON.parse(r.bodyText) } catch (e) { throw new Error('Brave invalid JSON: ' + msg(e)) }
  const sources = ((((data.web || {}).results) || []).filter((x) => x && x.url).slice(0, maxResults)).map((x) => ({ url: x.url, title: x.title || 'Source', snippet: x.description || '' }))
  return { provider: 'brave', content: undefined, sources }
}
async function ddgSearch(query, maxResults, signal) {
  const r = await httpRequest({ url: 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), headers: { accept: 'text/html' }, maxBytes: 200000, timeoutMs: 25000, signal })
  if (r.statusCode !== 200) throw new Error('DuckDuckGo HTTP ' + r.statusCode)
  const sources = parseDdg(r.bodyText, maxResults)
  if (sources.length === 0) throw new Error('DuckDuckGo returned no parseable results')
  return { provider: 'duckduckgo', content: undefined, sources }
}
// Fallback chain (mirrors pi-web-access)
async function searchAll(ctx, query, maxResults, signal) {
  const n = Math.max(1, Math.min(Math.floor(maxResults || 5) || 5, 20))
  const attempts = [
    { name: 'SearXNG', fn: () => searxngSearch(ctx, query, n, signal) },
    { name: 'Tavily', fn: () => tavilySearch(ctx, query, n, signal) },
    { name: 'Brave', fn: () => braveSearch(ctx, query, n, signal) },
    { name: 'DuckDuckGo', fn: () => ddgSearch(query, n, signal) },
  ]
  const errors = []
  for (const a of attempts) {
    try { return await a.fn() } catch (e) { errors.push(a.name + ': ' + msg(e)) }
  }
  throw new Error('pi-web-access: all search providers failed: ' + errors.join(' | '))
}

// ---- Content extraction ----
async function extractUrl(url, signal) {
  const r = await httpRequest({ url, maxBytes: 250000, timeoutMs: 45000, signal })
  const ct = (r.contentType || '').toLowerCase()
  let content = ''
  let kind = 'text'
  if (/html|xml/.test(ct)) {
    content = htmlToText(r.bodyText); kind = 'html'
  } else if (/json/.test(ct)) {
    try { content = JSON.stringify(JSON.parse(r.bodyText), null, 2) } catch { content = r.bodyText }
  } else if (/^text\//.test(ct) || ct === '') {
    content = r.bodyText
  } else {
    content = '[binary content type "' + r.contentType + '", size ' + r.size + ' bytes — not extracted]'
  }
  if (!content.trim() && r.bodyText && r.bodyText.trim()) content = r.bodyText
  return { url: r.finalUrl || url, statusCode: r.statusCode, content, kind, truncated: r.truncated, size: r.size }
}

export const name = 'web-access'
export const inject = ['tools']

export function apply(ctx) {
  // ---- web seam providers (the fetch seam was empty; this registration makes web_fetch usable) ----
  const web = ctx.get('web')
  if (web !== undefined) {
    // Official DeepSeek provider, used for delegation while the toggle is off (same pattern as dsh-web-search-tavily)
    const deepseek = new DeepSeekSearchProvider(() => ({
      resolveApiKey: async () => getKey(ctx, 'DEEPSEEK_API_KEY'),
      apiKeyEnv: credentialRef('DEEPSEEK_API_KEY'),
      baseURL: DEEPSEEK_DEFAULT_BASE_URL,
      model: DEEPSEEK_DEFAULT_MODEL,
      apiVersion: DEEPSEEK_DEFAULT_API_VERSION,
      maxTokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
      maxUses: DEEPSEEK_DEFAULT_MAX_USES,
    }))
    const piwaEnabled = async () => (await getKey(ctx, PIWA_ENABLED_REF)) !== undefined
    ctx.effect(() => web.registerSearchProvider({
      id: 'web-access',
      available: () => true,
      async search(request, signal) {
        if (!(await piwaEnabled())) return deepseek.search(request, signal)
        const r = await searchAll(ctx, request.query, request.maxResults || 5, signal)
        const out = { sources: r.sources, truncated: false }
        if (r.content !== undefined) out.content = r.content
        return out
      },
    }), 'piwa: search provider')
    ctx.effect(() => web.registerFetchProvider({
      id: 'web-access',
      available: () => true,
      async fetch(request, signal) {
        const r = await extractUrl(request.url, signal)
        return { url: r.url, statusCode: r.statusCode, body: { kind: r.kind, content: r.content }, truncated: r.truncated }
      },
    }), 'piwa: fetch provider')
    console.log('piwa: providers registered (search + fetch; delegates to official DeepSeek while the toggle is off)')
  }

  // ---- Tools (named like the pi agent's injected tools: web_search is taken over by the piwa provider, so only get_search_content is registered here) ----
  const renderExtract = (v) => ('URL: ' + v.url + '\nStatus: ' + v.statusCode + (v.truncated ? ' (truncated)' : '') + '\n\n' + v.content).slice(0, 20000)

  const extractTool = defineTool({
    name: 'get_search_content',
    description: 'Fetch a specific HTTP(S) URL and extract its readable text content (HTML→plain text, JSON pretty-printed, binary flagged). Use this to read the full content of a link returned by web_search. Cite the URL as a markdown link when you use its content.',
    parameters: {
      url: { type: 'string', required: true, description: 'The HTTP(S) URL to fetch and extract' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          statusCode: { type: 'integer', required: true },
          content: { type: 'string', required: true },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{ type: 'text', text: renderExtract(value) }],
    },
    async execute(args, exec) {
      const r = await extractUrl(args.url, exec && exec.signal)
      return { url: r.url, statusCode: r.statusCode, content: r.content, truncated: r.truncated }
    },
  })
  ctx.tools.register(extractTool)
  console.log('piwa: provider took over web_search; get_search_content registered')
}

// Pure helpers, exported for unit tests (see tests/parse.test.mjs).
export { decodeEntities, htmlToText, decodeDdgUrl, parseDdg }
