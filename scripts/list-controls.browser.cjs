const assert = require('node:assert/strict')
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
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
  } catch (error) {
    result.error = error.stack
  }
  document.querySelector('#result').textContent = JSON.stringify(result)
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
  <link rel="stylesheet" href="${pathToFileURL(join(output, 'css/main.css'))}">
  <style>
    body { padding: 16px; }
    .host { max-width: 900px; }
    .form-select, .form-control { transition: none !important; }
  </style>
  </head><body>
    <div class="host">${table('list', `data-table-controls-layout="list"
      data-table-search-label="${customText}" data-table-search-placeholder="${customText}"`)}</div>
    <div class="host">${table('compact')}</div>
    <div class="host">${table('other', 'data-table-controls-layout="list" data-table-search-placeholder="Search releases…"')}</div>
    <div class="host">${table('custom', `data-table-search-label="${customText}" data-table-search-placeholder="${customText}"`)}</div>
    <script src="${pathToFileURL(join(output, 'js/main.bundle.js'))}"></script>
    <output id="result"></output>
    <script>window.addEventListener('load', () => setTimeout(${probe.toString()}, 30))</script>
  </body></html>`)

// Chrome clamps --window-size below 500px on some platforms. Use its debugging pipe
// to set the actual CSS viewport, without adding a browser-driver dependency.
const runBrowser = async (width, theme) => {
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-pipe',
    '--allow-file-access-from-files',
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
      url: `${pathToFileURL(fixture).href}?theme=${theme}`
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

test.after(() => rmSync(fixtureDir, { recursive: true, force: true }))
for (const width of [1400, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`list controls fit a ${width}px viewport in ${theme} mode and retain search and paging`, { timeout: 30000 }, async () => {
    const result = await runBrowser(width, theme)
    assert.equal(result.error, undefined)
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
