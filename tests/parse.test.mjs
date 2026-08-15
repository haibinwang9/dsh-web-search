import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeEntities, htmlToText, decodeDdgUrl, parseDdg } from '../lib/parse.js'

test('decodeEntities handles common entities and code points', () => {
  assert.equal(decodeEntities('a&nbsp;b &amp; c &lt;x&gt;'), 'a b & c <x>')
  assert.equal(decodeEntities('&#65;&#x42;'), 'AB')
  assert.equal(decodeEntities('&ldquo;hi&rdquo;'), '\u201chi\u201d')
})

test('htmlToText strips markup and keeps readable text', () => {
  const html = '<html><head><style>.x{}</style><script>var a=1</script></head>' +
    '<body><article><h1>Title</h1><p>Hello <b>world</b></p>' +
    '<table><tr><td>a</td><td>b</td></tr></table></article></body></html>'
  const text = htmlToText(html)
  assert.ok(text.includes('Title'))
  assert.ok(text.includes('Hello world'))
  assert.ok(!text.includes('<'))
  assert.ok(!text.includes('var a=1'))
  assert.ok(!text.includes('.x{}'))
})

test('htmlToText prefers main/article content', () => {
  const html = '<div>nav noise</div><main><p>the real content</p></main><footer>footer</footer>'
  const text = htmlToText(html)
  assert.ok(text.includes('the real content'))
  assert.ok(!text.includes('nav noise'))
})

test('decodeDdgUrl unwraps uddg redirects', () => {
  const href = '//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&rut=abc'
  assert.equal(decodeDdgUrl(href), 'https://example.com/a?b=1')
  assert.equal(decodeDdgUrl('https://plain.example.com/x'), 'https://plain.example.com/x')
  assert.equal(decodeDdgUrl(null), null)
})

test('parseDdg extracts result links with titles and snippets', () => {
  const html = [
    '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F1">First <b>Result</b></a>',
    '<a class="result__snippet">snippet text</a>',
    '<a class="result__a" href="https://example.com/2">Second</a>',
    '<a class="other" href="https://example.com/no">Skip me</a>',
  ].join('')
  const out = parseDdg(html, 5)
  assert.equal(out.length, 2)
  assert.equal(out[0].title, 'First Result')
  assert.equal(out[0].url, 'https://example.com/1')
  assert.equal(out[0].snippet, 'snippet text')
  assert.equal(out[1].url, 'https://example.com/2')
})

test('parseDdg honors the max limit', () => {
  const html = '<a class="result__a" href="https://a.com">1</a>' +
    '<a class="result__a" href="https://b.com">2</a>' +
    '<a class="result__a" href="https://c.com">3</a>'
  assert.equal(parseDdg(html, 2).length, 2)
})
