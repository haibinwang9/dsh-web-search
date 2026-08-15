// dsh-web-search —— pure parsing/extraction helpers (zero dependencies).
// Kept side-effect free and standalone so unit tests run without the harness:
// the host plugin (./index.js) imports these, tests import this file directly.

/** Decode common HTML entities, including numeric code points and CJK quotes. */
export const decodeEntities = (s) => {
  let out = String(s)
  out = out.replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return m } })
  out = out.replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(parseInt(d, 10)) } catch { return m } })
  out = out.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  out = out.replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
  out = out.replace(/&ldquo;/gi, '\u201c').replace(/&rdquo;/gi, '\u201d')
  return out
}

/** Convert HTML to readable plain text (prefers main/article, strips scripts/styles). */
export const htmlToText = (html) => {
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

/** Unwrap a DuckDuckGo redirect href to the real URL (null when not resolvable). */
export const decodeDdgUrl = (href) => {
  const m = /[?&]uddg=([^&]+)/.exec(href || '')
  let u = ''
  try { u = m ? decodeURIComponent(m[1]) : (href || '') } catch { return null }
  if (/^https?:\/\//i.test(u)) return u
  if (/^https?:\/\//i.test(href || '')) return href
  return null
}

/** Parse DuckDuckGo HTML search results into {url, title, snippet} sources. */
export const parseDdg = (html, max) => {
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
