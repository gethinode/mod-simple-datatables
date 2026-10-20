const assert = require('node:assert/strict')
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { createServer } = require('node:http')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const test = require('node:test')

const chrome = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean).find(existsSync)
assert.ok(chrome, 'Chrome is required; set CHROME_BIN if needed')
const output = resolve('exampleSite/public')
const fixtureDir = mkdtempSync(join(tmpdir(), 'datatable-controls-'))
const fixture = join(fixtureDir, 'index.html')
let fixtureURL

// Exercise native controls, not just the options builder. Breaking label escaping, moving
// page size back above the list, or leaving the search at intrinsic width must fail here.
const probe = () => {
  const result = {}
  try {
    document.documentElement.dataset.bsTheme = new URLSearchParams(location.search).get('theme')
    result.viewportWidth = innerWidth
    const tbl = document.querySelector('#list')
    const wrap = tbl.closest('.datatable-wrapper')
    const input = wrap.querySelector('input')
    const select = wrap.querySelector('select')
    const bounds = el => el.getBoundingClientRect()
    result.fullWidth = bounds(input).width >= bounds(wrap).width - 2
    result.selectorBelow = !!select.closest('.datatable-bottom')
    result.placeholder = input.placeholder
    result.label = input.closest('label').textContent.trim()
    result.safe = !input.closest('label').querySelector('img')
    result.other = document.querySelector('#other').closest('.datatable-wrapper').querySelector('input').placeholder
    const compact = document.querySelector('#compact').closest('.datatable-wrapper')
    result.compactTop = !!compact.querySelector('.datatable-top select')
    result.defaultPlaceholder = compact.querySelector('input').placeholder
    const custom = document.querySelector('#custom').closest('.datatable-wrapper')
    result.compactLabel = custom.querySelector('label:has(input)').textContent.trim()
    result.compactPlaceholder = custom.querySelector('input').placeholder
    result.compactSafe = !custom.querySelector('img')
    result.overflow = document.documentElement.scrollWidth > innerWidth
    const footer = wrap.querySelector('.datatable-bottom')
    const info = footer.querySelector('.datatable-info')
    const label = footer.querySelector('.datatable-dropdown label')
    const typography = element => {
      const style = getComputedStyle(element)
      return ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'lineHeight'].map(key => style[key])
    }
    result.infoStyle = typography(info)
    result.labelStyle = typography(label)
    result.infoCentered = Math.abs((bounds(info).left + bounds(info).right) / 2 - (bounds(footer).left + bounds(footer).right) / 2) < 1
    const nav = wrap.querySelector('.datatable-bottom nav')
    const visibleButtons = Array.from(nav.querySelectorAll('button')).filter(button => bounds(button).width > 0 && getComputedStyle(button).visibility !== 'hidden')
    result.pagerCentered = Math.abs((bounds(visibleButtons[0]).left + bounds(visibleButtons.at(-1)).right) / 2 - (bounds(footer).left + bounds(footer).right) / 2) < 1
    result.navFits = bounds(nav).left >= 0 && bounds(nav).right <= innerWidth
    result.minTarget = Math.min(...Array.from(nav.querySelectorAll('button'))
      .filter(button => bounds(button).width > 0)
      .map(button => bounds(button).height))
    select.value = '10'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    result.pageSize = tbl.tBodies[0].rows.length
    select.value = '5'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    nav.querySelector('[data-page="16"]').click()
    result.lastInfo = info.textContent.trim()
    input.value = '75'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    result.search = Array.from(tbl.tBodies[0].rows).map(row => row.textContent)
    result.searchInfo = info.textContent.trim()
    const options = window.hinodeDatatables.options(tbl)
    const template = options.template({ ...options, scrollY: '10rem' }, tbl)
    result.templateHasInlineStyle = !!new DOMParser().parseFromString(template, 'text/html').querySelector('[style]')
    document.querySelector('[data-filter-value="news"]').click()
    const fallbackRows = Array.from(document.querySelectorAll('#fallback tbody tr'))
    result.fallbackFiltered = fallbackRows.filter(row => bounds(row).height > 0).map(row => row.textContent)
    document.querySelector('[data-filter-value=""]').click()
    result.fallbackRestored = fallbackRows.every(row => bounds(row).height > 0)
  } catch (error) {
    result.error = error.stack
  }
  // CSP violations are dispatched asynchronously after the mutations that caused them.
  setTimeout(() => {
    result.inlineStyles = Array.from(document.querySelectorAll('.datatable-wrapper [style], #fallback [style]'))
      .map(element => element.getAttribute('style'))
    result.cspViolations = window.cspViolations
    document.querySelector('#result').textContent = JSON.stringify(result)
  }, 50)
}
const table = (id, extra = '') => `
  <table id="${id}" class="table data-table" data-table-paging="true"
    data-table-searchable="true" data-table-sortable="true"
    data-table-paging-option-perPage="5" ${extra}>
    <thead><tr><th>Name</th><th>Category</th></tr></thead>
    <tbody>${Array.from({ length: 76 }, (_, i) =>
      `<tr><td>Article ${i + 1}</td><td>${i % 2 ? 'News' : 'Notes'}</td></tr>`
    ).join('')}</tbody>
  </table>`
const customText = 'Search &quot;articles&quot; &amp; &lt;img src=x onerror=alert(1)&gt; $1 &#39;today&#39;'
writeFileSync(fixture, `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/main.css">
  <link rel="stylesheet" href="/fixture.css">
  </head><body>
    <div class="host">${table('list', `data-table-controls-layout="list"
      data-table-search-label="${customText}" data-table-search-placeholder="${customText}"`)}</div>
    <div class="host">${table('compact')}</div>
    <div class="host">${table('other', 'data-table-controls-layout="list" data-table-search-placeholder="Search releases…"')}</div>
    <div class="host">${table('custom', `data-table-search-label="${customText}" data-table-search-placeholder="${customText}"`)}</div>
    <div data-filter-container="fallback">
      <button data-filter-table="fallback" data-filter-value="">All</button>
      <button data-filter-table="fallback" data-filter-value="news">News</button>
      <table id="fallback" data-filter-col="0"><tbody><tr><td>News</td></tr><tr><td>Notes</td></tr></tbody></table>
    </div>
    <script src="/probe.js"></script>
    <script src="/main.js"></script>
    <output id="result"></output>
  </body></html>`)

// Serve every fixture asset externally under an enforced policy. File URLs and inline
// test scripts/styles would bypass the production constraint this regression must cover.
const fixtureCSS = 'body{padding:16px}.host{max-width:900px}.form-select,.form-control{transition:none!important}'
const fixtureJS = `window.cspViolations = [];
  document.addEventListener('securitypolicyviolation', event => {
    window.cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
  });
  window.addEventListener('load', () => setTimeout(${probe.toString()}, 30));`
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  const assets = {
    '/': ['text/html', () => readFileSync(fixture)],
    '/main.css': ['text/css', () => readFileSync(join(output, 'css/main.css'))],
    '/main.js': ['text/javascript', () => readFileSync(join(output, 'js/main.bundle.js'))],
    '/fixture.css': ['text/css', () => fixtureCSS],
    '/probe.js': ['text/javascript', () => fixtureJS]
  }
  const asset = assets[pathname]
  if (!asset) { response.writeHead(404); response.end(); return }
  response.writeHead(200, {
    'Content-Type': `${asset[0]}; charset=utf-8`,
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; font-src 'self'; base-uri 'none'"
  })
  response.end(asset[1]())
})
test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  fixtureURL = `http://127.0.0.1:${server.address().port}/`
})

// Chrome clamps --window-size below 500px on some platforms. Use its debugging pipe
// to set the actual CSS viewport, without adding a browser-driver dependency.
const runBrowser = async (width, theme) => {
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-pipe',
    `--user-data-dir=${join(fixtureDir, `profile-${width}-${theme}`)}`
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] })
  let sequence = 0
  let buffer = ''
  const pending = new Map()
  child.stdio[4].setEncoding('utf8')
  child.stdio[4].on('data', chunk => {
    buffer += chunk
    let end
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      const handler = pending.get(message.id)
      if (handler) {
        pending.delete(message.id)
        if (message.error) handler.reject(new Error(message.error.message))
        else handler.resolve(message.result)
      }
    }
  })
  const fail = error => {
    for (const handler of pending.values()) handler.reject(error)
    pending.clear()
  }
  child.on('error', fail)
  child.on('exit', code => fail(new Error(`Chrome exited before responding: ${code}`)))
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0')
  })
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    await send('Emulation.setDeviceMetricsOverride', {
      width, height: 1000, deviceScaleFactor: 1, mobile: false
    }, sessionId)
    await send('Page.navigate', {
      url: `${fixtureURL}?theme=${theme}`
    }, sessionId)
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const { result } = await send('Runtime.evaluate', {
        expression: 'document.querySelector("#result")?.textContent || ""',
        returnByValue: true
      }, sessionId)
      if (result.value) return JSON.parse(result.value)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error('Browser fixture did not report results')
  } finally {
    child.kill()
    if (child.exitCode === null) await once(child, 'exit')
  }
}

test.after(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve))
  rmSync(fixtureDir, { recursive: true, force: true })
})
for (const width of [1400, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`list controls fit a ${width}px viewport in ${theme} mode and retain search and paging`, { timeout: 30000 }, async () => {
    const result = await runBrowser(width, theme)
    assert.equal(result.error, undefined)
    assert.equal(result.templateHasInlineStyle, false, 'the list template must not emit inline style attributes')
    assert.deepEqual(result.inlineStyles, [], 'managed table controls and filtering must not generate inline styles')
    assert.deepEqual(result.cspViolations, [], 'controls must work with inline styles and scripts prohibited')
    assert.deepEqual(result.fallbackFiltered, ['News'])
    assert.equal(result.fallbackRestored, true)
    assert.equal(result.viewportWidth, width, "test must exercise the requested viewport")
    assert.deepEqual(result.infoStyle, result.labelStyle, 'count matches the page-size label typography')
    if (width >= 576) assert.equal(result.infoCentered, true, 'count is centered in the desktop footer')
    else assert.equal(result.pagerCentered, true, 'visible pager buttons are centered on mobile')
    assert.equal(result.lastInfo, '76 van 76', 'a last page with one record has a single index')
    assert.equal(result.searchInfo, '1 van 1', 'a single search result has a single index')
    assert.equal(result.fullWidth, true, 'search spans the list')
    assert.equal(result.selectorBelow, true, 'page-size selector follows the results')
    const literal = 'Search "articles" & <img src=x onerror=alert(1)> $1 \'today\''
    assert.equal(result.placeholder, literal)
    assert.equal(result.label, literal)
    assert.equal(result.safe, true)
    assert.equal(result.compactLabel, literal)
    assert.equal(result.compactPlaceholder, literal)
    assert.equal(result.compactSafe, true)
    assert.equal(result.other, 'Search releases…', 'labels do not leak between tables')
    assert.equal(result.compactTop, true, 'compact tables retain their selector above')
    assert.ok(result.defaultPlaceholder, 'default translations remain available')
    assert.equal(result.overflow, false, 'controls do not cause page overflow')
    assert.equal(result.navFits, true)
    assert.ok(result.minTarget >= 44, 'pager has touch-sized targets')
    assert.equal(result.pageSize, 10)
    assert.deepEqual(result.search, ['Article 75Notes'])
  })
}
